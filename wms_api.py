"""REST resources: warehouses, suppliers, items, inventory, purchase orders (+lines), sales orders (+lines).
POST stores exactly what the caller sends. Ids, numbers, line numbers, totals and quantities are NOT generated.
Only audit columns fall back to the server user/time when the caller omits them."""
import re, sqlite3
from flask import jsonify, request

E = lambda *v: ("e", list(v))
YN = E("Y", "N")
AUD = dict(created_by="s", creation_date="d", last_updated_by="s", last_update_date="d")

SUP = dict(supplier_id="n", supplier_number="s", fusion_vendor_id="n", supplier_name="s", supplier_alt_name="s",
           supplier_status=E("ACTIVE", "INACTIVE", "HOLD"), supplier_type="s", primary_contact_name="s",
           contact_email="s", contact_phone="s", tax_registration_num="s", payment_terms_code="s", currency_code="s",
           supplier_site_code="s", address_line1="s", address_line2="s", city="s", state="s", zip_postal_code="s",
           country="s", **AUD)
WH = dict(warehouse_id="n", warehouse_code="s", warehouse_name="s", business_unit_id="n",
          status=E("ACTIVE", "INACTIVE"), address_line1="s", address_line2="s", city="s", state="s",
          zip_postal_code="s", country="s", **AUD)
ITEM = dict(item_id="n", inventory_item_id="n", warehouse_id="n", item_number="s", item_name="s", description="s", primary_uom="s", secondary_uom="s",
            item_category="s", upc_barcode="s", unit_weight="n", weight_uom="s", unit_volume="n",
            is_lot_controlled=YN, is_serial_controlled=YN, min_stock_level="n", max_stock_level="n",
            item_status=E("ACTIVE", "INACTIVE", "DISCONTINUED"), **AUD)
BAL = dict(balance_id="n", warehouse_id="n", item_id="n", inventory_item_id="n", item_number="s", zone="s", aisle="s", shelf="s", bin="s", qty_on_hand="n",
           qty_allocated="n", qty_available="n", lot_number="s", expiration_date="d", serial_number="s",
           last_counted_date="d", **AUD)
PO = dict(po_header_id="n", po_number="s", fusion_header_id="n", supplier_id="s", supplier_name="s", supplier_site="s",
          buyer_name="s", order_date="d", expected_delivery_date="d", payment_terms="s", currency_code="s",
          po_status=E("OPEN", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED"), total_amount="n", comments="s", **AUD)
POL = dict(po_line_id="n", po_header_id="n", line_number="n", item_number="s", item_description="s", uom="s",
           qty_ordered="n", qty_received="n", qty_rejected="n", unit_price="n",
           line_status=E("AWAITING_RECEIPT", "PARTIAL", "CLOSED"))
SO = dict(so_header_id="n", so_number="s", fusion_so_header_id="n", customer_id="s", customer_name="s",
          shipping_address_line1="s", shipping_city="s", shipping_state="s", shipping_zip="s", shipping_country="s",
          carrier_code="s", shipping_method="s", order_date="d", required_ship_date="d",
          so_status=E("AWAITING_PICK", "PICKING", "PACKED", "SHIPPED", "CANCELLED"), **AUD)
SOL = dict(so_line_id="n", so_header_id="n", line_number="n", item_number="s", uom="s", qty_requested="n",
           qty_picked="n", qty_shipped="n", pick_zone_preference="s", line_status="s")

RES = {
    "warehouses": dict(table="wms_warehouses", pk="warehouse_id", fields=WH, req=["warehouse_id", "warehouse_code"],
                       status="status", filters=["business_unit_id", "country"],
                       search=["warehouse_code", "warehouse_name", "city", "state", "country"],
                       children=[("wms_item_master", "warehouse_id", "items"),
                                 ("wms_inventory_balances", "warehouse_id", "inventory balances")]),
    "suppliers": dict(table="wms_suppliers", pk="supplier_id", fields=SUP, req=["supplier_id", "supplier_number"],
                      status="supplier_status", filters=["supplier_type", "country", "fusion_vendor_id"],
                      search=["supplier_number", "supplier_name", "supplier_alt_name", "primary_contact_name",
                              "contact_email", "city", "supplier_site_code"]),
    "items": dict(table="wms_item_master", pk="item_id", fields=ITEM, req=["item_id", "inventory_item_id", "warehouse_id", "item_number"],
                  status="item_status", filters=["item_category", "warehouse_id", "inventory_item_id"],
                  refs=[("warehouse_id", "wms_warehouses", "warehouse_id")],
                  children=[("wms_inventory_balances", "item_id", "inventory balances")],
                  search=["item_number", "item_name", "description", "item_category", "upc_barcode"]),
    "inventory": dict(table="wms_inventory_balances", pk="balance_id", fields=BAL, req=["balance_id", "warehouse_id", "item_id", "item_number"],
                      status=None, filters=["warehouse_id", "item_id", "inventory_item_id", "item_number", "zone"],
                      refs=[("warehouse_id", "wms_warehouses", "warehouse_id"), ("item_id", "wms_item_master", "item_id")],
                      item_link=True,
                      search=["item_number", "zone", "aisle", "shelf", "bin", "lot_number", "serial_number"]),
    "purchase-orders": dict(table="wms_po_header", pk="po_header_id", fields=PO, req=["po_header_id", "po_number"],
                            status="po_status", filters=["supplier_id", "fusion_header_id"],
                            search=["po_number", "supplier_name", "supplier_id", "buyer_name"],
                            lines=dict(table="wms_po_lines", pk="po_line_id", fields=POL,
                                       req=["po_line_id", "line_number", "item_number"])),
    "sales-orders": dict(table="wms_so_header", pk="so_header_id", fields=SO, req=["so_header_id", "so_number"],
                         status="so_status", filters=["customer_id", "fusion_so_header_id"],
                         search=["so_number", "customer_name", "customer_id", "shipping_city", "carrier_code"],
                         lines=dict(table="wms_so_lines", pk="so_line_id", fields=SOL,
                                    req=["so_line_id", "line_number", "item_number"])),
}


def num(v):
    if isinstance(v, bool):
        raise ValueError
    if isinstance(v, int):
        return v
    s = str(v).strip()
    if re.fullmatch(r"-?\d+", s):
        return int(s)          # exact for big Fusion ids
    f = float(s)
    return int(f) if f.is_integer() else f


def validate(fields, d, req, partial=False):
    e = {}
    for k in req:
        blank = d.get(k) is None or str(d.get(k)).strip() == ""
        if (blank and not partial) or (blank and k in d):
            e[k] = f"{k} is required"
    for k, t in fields.items():
        v = d.get(k)
        if v is None or v == "":
            continue
        if t == "n":
            try:
                num(v)
            except (TypeError, ValueError):
                e[k] = "must be a number"
        elif t == "d":
            if not re.match(r"^\d{4}-\d{2}-\d{2}", str(v)):
                e[k] = "must be a date like 2026-10-07 (or an ISO timestamp)"
        elif isinstance(t, tuple) and str(v).strip().upper() not in t[1]:
            e[k] = "must be one of " + ", ".join(t[1])
    return e


def clean(fields, d):
    r = {}
    for k, t in fields.items():
        if k not in d:
            continue
        v, enum = d[k], isinstance(t, tuple)
        if v is None or v == "":
            if not enum:
                r[k] = None
            continue
        r[k] = num(v) if t == "n" else str(v).strip().upper() if enum else str(v).strip()
    return r


def register(app, db, auth, err, who):
    def ref_errors(R, d, current=None):
        """Foreign-key checks. d = incoming fields; current = the stored row (on update) used to fill fields not sent."""
        e, m = {}, {**(current or {}), **{k: v for k, v in d.items() if v not in (None, "")}}
        for col, tbl, pk in R.get("refs", []):
            if col in d and d[col] not in (None, "") and not e.get(col):
                try:
                    ok = db().execute(f"SELECT 1 FROM {tbl} WHERE {pk}=?", (num(d[col]),)).fetchone()
                except (TypeError, ValueError):
                    continue                                # type error already reported by validate()
                if not ok:
                    e[col] = f"{col} {d[col]} does not exist in {tbl}"
        if R.get("item_link") and not e and any(k in d for k in ("item_id", "warehouse_id", "item_number", "inventory_item_id")):
            try:
                it = db().execute("SELECT * FROM wms_item_master WHERE item_id=?", (num(m.get("item_id")),)).fetchone()
            except (TypeError, ValueError):
                it = None
            if it:
                if m.get("warehouse_id") is not None and int(num(m["warehouse_id"])) != it["warehouse_id"]:
                    e["warehouse_id"] = f"item {it['item_id']} belongs to warehouse {it['warehouse_id']}, not {m['warehouse_id']}"
                if m.get("item_number") and str(m["item_number"]).strip() != it["item_number"]:
                    e["item_number"] = f"item_id {it['item_id']} has item_number {it['item_number']}"
                if m.get("inventory_item_id") not in (None, "") and int(num(m["inventory_item_id"])) != it["inventory_item_id"]:
                    e["inventory_item_id"] = f"item_id {it['item_id']} has inventory_item_id {it['inventory_item_id']}"
        return e

    def now():
        return db().execute("SELECT datetime('now')").fetchone()[0]

    def one(R, i):
        r = db().execute(f"SELECT * FROM {R['table']} WHERE {R['pk']}=?", (i,)).fetchone()
        if not r:
            return None
        r = dict(r)
        if R.get("lines"):
            L = R["lines"]
            r["lines"] = [dict(x) for x in db().execute(
                f"SELECT * FROM {L['table']} WHERE {R['pk']}=? ORDER BY line_number, {L['pk']}", (i,))]
        return r

    def ins(table, row):
        db().execute(f"INSERT INTO {table} ({','.join(row)}) VALUES ({','.join('?' * len(row))})", list(row.values()))

    def check_lines(R, lines):
        if lines is None:
            return {}
        if not isinstance(lines, list):
            return {"lines": "must be an array"}
        e = {}
        for n, l in enumerate(lines):
            le = validate(R["lines"]["fields"], l, R["lines"]["req"]) if isinstance(l, dict) else {"_": "not an object"}
            if le:
                e[f"lines[{n}]"] = le
        return e

    def save_lines(R, i, lines):
        L = R["lines"]
        for l in lines or []:
            lr = clean(L["fields"], l)
            lr[R["pk"]] = i                      # link to the parent header being saved
            ins(L["table"], lr)

    def create_one(R, d):
        """returns (id, errors, http_code)"""
        if not isinstance(d, dict):
            return None, {"_": "not an object"}, 422
        e = validate(R["fields"], d, R["req"])
        if R.get("lines"):
            e.update(check_lines(R, d.get("lines")))
        if not e:
            e.update(ref_errors(R, d))
        if e:
            return None, e, 422
        row = clean(R["fields"], d)
        row["created_by"] = row.get("created_by") or who()
        row["last_updated_by"] = row.get("last_updated_by") or row["created_by"]
        row["creation_date"] = row.get("creation_date") or now()
        row["last_update_date"] = row.get("last_update_date") or row["creation_date"]
        row = {k: v for k, v in row.items() if k in R["fields"]}
        db().execute("SAVEPOINT rec")
        try:
            ins(R["table"], row)
            if R.get("lines"):
                save_lines(R, row[R["pk"]], d.get("lines"))
        except sqlite3.IntegrityError as ex:
            db().execute("ROLLBACK TO rec"); db().execute("RELEASE rec")
            return None, {"_": f"Duplicate or invalid key: {ex}"}, 409
        db().execute("RELEASE rec")
        return row[R["pk"]], None, 201

    def fail(e, code):
        return err("Validation failed" if code == 422 else "Duplicate record", code, e)

    def make(R):
        def lst():
            where, args = [], []
            q = request.args.get("q", "").strip()
            if q:
                where.append("(" + " OR ".join(f"{c} LIKE ?" for c in R["search"]) + ")"); args += [f"%{q}%"] * len(R["search"])
            if R["status"] and request.args.get("status"):
                where.append(f"{R['status']}=?"); args.append(request.args["status"].upper())
            for c in R["filters"]:
                if request.args.get(c):
                    where.append(f"{c}=?"); args.append(request.args[c])
            w = ("WHERE " + " AND ".join(where)) if where else ""
            page = max(int(request.args.get("page", 1) or 1), 1)
            limit = min(max(int(request.args.get("limit", 20) or 20), 1), 200)
            extra = f", (SELECT COUNT(*) FROM {R['lines']['table']} l WHERE l.{R['pk']}=h.{R['pk']}) AS line_count" if R.get("lines") else ""
            total = db().execute(f"SELECT COUNT(*) c FROM {R['table']} h {w}", args).fetchone()["c"]
            rows = db().execute(f"SELECT h.*{extra} FROM {R['table']} h {w} ORDER BY {R['pk']} DESC LIMIT ? OFFSET ?",
                                args + [limit, (page - 1) * limit]).fetchall()
            return jsonify(success=True, total=total, page=page, limit=limit, data=[dict(r) for r in rows])

        def get(i):
            r = one(R, i)
            return jsonify(success=True, data=r) if r else err("Record not found", 404)

        def create():
            d = request.get_json(silent=True)
            if not isinstance(d, dict):
                return err("Body must be a JSON object")
            i, e, code = create_one(R, d)
            if e:
                return fail(e, code)
            db().commit()
            return jsonify(success=True, data=one(R, i)), 201

        def bulk():
            items = request.get_json(silent=True)
            if not isinstance(items, list) or not items:
                return err("Body must be a non-empty JSON array")
            ok, bad = [], []
            for n, d in enumerate(items):
                i, e, _ = create_one(R, d)
                if e:
                    bad.append({"index": n, "error": e})
                else:
                    ok.append(one(R, i))
            db().commit()
            return jsonify(success=not bad, created_count=len(ok), failed_count=len(bad), created=ok, failed=bad), (201 if ok else 422)

        def update(i):
            if not one(R, i):
                return err("Record not found", 404)
            d = request.get_json(silent=True)
            if not isinstance(d, dict):
                return err("Body must be a JSON object")
            e = validate(R["fields"], d, [r for r in R["req"] if r != R["pk"]], partial=True)
            if R.get("lines") and "lines" in d:
                e.update(check_lines(R, d["lines"]))
            if not e:
                e.update(ref_errors(R, d, dict(db().execute(f"SELECT * FROM {R['table']} WHERE {R['pk']}=?", (i,)).fetchone())))
            if e:
                return fail(e, 422)
            row = clean(R["fields"], d)
            row.pop(R["pk"], None)                       # the key itself is never changed
            if not row and "lines" not in d:
                return err("No updatable fields supplied")
            row["last_updated_by"] = row.get("last_updated_by") or who()
            row["last_update_date"] = row.get("last_update_date") or now()
            db().execute("SAVEPOINT rec")
            try:
                if R.get("lines") and "lines" in d:      # lines sent => replace the existing lines
                    db().execute(f"DELETE FROM {R['lines']['table']} WHERE {R['pk']}=?", (i,))
                    save_lines(R, i, d["lines"])
                db().execute(f"UPDATE {R['table']} SET {','.join(f'{k}=?' for k in row)} WHERE {R['pk']}=?",
                             list(row.values()) + [i])
            except sqlite3.IntegrityError as ex:
                db().execute("ROLLBACK TO rec"); db().execute("RELEASE rec")
                return fail({"_": f"Duplicate or invalid key: {ex}"}, 409)
            db().execute("RELEASE rec"); db().commit()
            return jsonify(success=True, data=one(R, i))

        def delete(i):
            if not one(R, i):
                return err("Record not found", 404)
            for tbl, col, what in R.get("children", []):
                n = db().execute(f"SELECT COUNT(*) c FROM {tbl} WHERE {col}=?", (i,)).fetchone()["c"]
                if n:
                    return err(f"Cannot delete: {n} {what} still reference this record. Delete them first.", 409)
            if R.get("lines"):
                db().execute(f"DELETE FROM {R['lines']['table']} WHERE {R['pk']}=?", (i,))
            db().execute(f"DELETE FROM {R['table']} WHERE {R['pk']}=?", (i,))
            db().commit()
            return jsonify(success=True, message=f"Record {i} deleted")
        return lst, get, create, bulk, update, delete

    for p, R in RES.items():
        lst, get, create, bulk, update, delete = make(R)
        for rule, ep, fn, m in [(f"/api/{p}", "list", lst, "GET"), (f"/api/{p}/<int:i>", "get", get, "GET"),
                                (f"/api/{p}", "create", create, "POST"), (f"/api/{p}/bulk", "bulk", bulk, "POST"),
                                (f"/api/{p}/<int:i>", "update", update, "PUT"), (f"/api/{p}/<int:i>", "delete", delete, "DELETE")]:
            app.add_url_rule(rule, f"{p}_{ep}", auth(fn), methods=[m])
