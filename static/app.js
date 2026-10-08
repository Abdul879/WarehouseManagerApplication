const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const F = (n, l, t = "text", x = {}) => ({ n, l, t, ...x });
const st = { token: sessionStorage.getItem("wms_basic"), user: sessionStorage.getItem("wms_user"), res: null, page: 1, limit: 10, editId: null };

/* ---------- resource config: drives tabs, tables, forms and API docs ---------- */
const S = (n, l, opts) => F(n, l, "select", { opts: ["", ...opts] });
const YN = (n, l) => S(n, l, ["Y", "N"]);
const ID = (n, l) => F(n, l, "number", { req: 1, pk: 1 });
const AUD = { created_by: "admin", creation_date: "2026-10-07 10:00:00", last_updated_by: "admin", last_update_date: "2026-10-07 10:00:00" };
const RES = [
  { key: "warehouses", title: "Warehouses", one: "warehouse", api: "/api/warehouses", pk: "warehouse_id", num: "warehouse_code", search: "Search code, name, city, country",
    status: "status", statusOpts: ["ACTIVE", "INACTIVE"], filters: ["business_unit_id", "country"], audit: AUD,
    note: "Fusion inventory organization (ORGANIZATION_ID = warehouse_id). Items and inventory balances link to it by warehouse_id.",
    cols: [["warehouse_code", "Code"], ["warehouse_name", "Name"], ["business_unit_id", "BU"], ["city", "City"], ["state", "State"], ["country", "Country"], ["status", "Status", "pill"]],
    fields: [ID("warehouse_id", "Warehouse ID"), F("warehouse_code", "Warehouse code", "text", { req: 1, ph: "WH1" }), F("warehouse_name", "Warehouse name"), F("business_unit_id", "Business unit ID", "number"), S("status", "Status", ["ACTIVE", "INACTIVE"]), F("address_line1", "Address line 1"), F("address_line2", "Address line 2"), F("city", "City"), F("state", "State"), F("zip_postal_code", "ZIP / postal code"), F("country", "Country", "text", { ph: "IN" })],
    sample: { warehouse_id: 300000001, warehouse_code: "WH1", warehouse_name: "Hyderabad Main DC", business_unit_id: 300000099, status: "ACTIVE", address_line1: "12 Industrial Area", city: "Hyderabad", state: "Telangana", zip_postal_code: "500032", country: "IN" },
    put: { status: "INACTIVE" } },
  { key: "suppliers", title: "Suppliers", one: "supplier", api: "/api/suppliers", pk: "supplier_id", num: "supplier_number", search: "Search number, name, contact, city, site",
    status: "supplier_status", statusOpts: ["ACTIVE", "INACTIVE", "HOLD"], filters: ["supplier_type", "country", "fusion_vendor_id"], audit: AUD,
    note: "One API holds the supplier master and the dispatch address/site fields. You supply supplier_id and supplier_number; nothing is generated.",
    cols: [["supplier_number", "Number"], ["supplier_name", "Name"], ["supplier_type", "Type"], ["primary_contact_name", "Contact"], ["contact_phone", "Phone"], ["city", "City"], ["country", "Country"], ["payment_terms_code", "Terms"], ["supplier_status", "Status", "pill"]],
    fields: [ID("supplier_id", "Supplier ID"), F("supplier_number", "Supplier number", "text", { req: 1 }), F("fusion_vendor_id", "Fusion vendor ID", "number"), F("supplier_name", "Supplier name"), F("supplier_alt_name", "Alternate / DBA name"), S("supplier_status", "Status", ["ACTIVE", "INACTIVE", "HOLD"]), F("supplier_type", "Supplier type", "text", { ph: "MANUFACTURER" }), F("primary_contact_name", "Primary contact"), F("contact_email", "Contact email", "email"), F("contact_phone", "Contact phone"), F("tax_registration_num", "Tax registration no."), F("payment_terms_code", "Payment terms code", "text", { ph: "NET_30" }), F("currency_code", "Currency", "text", { ph: "INR" }), F("supplier_site_code", "Supplier site code", "text", { ph: "US_PLANT_1" }), F("address_line1", "Address line 1"), F("address_line2", "Address line 2"), F("city", "City"), F("state", "State"), F("zip_postal_code", "ZIP / postal code"), F("country", "Country", "text", { ph: "IN" })],
    sample: { supplier_id: 1001, supplier_number: "SUP-10045", fusion_vendor_id: 300000123456, supplier_name: "Acme Traders Pvt Ltd", supplier_alt_name: "Acme", supplier_status: "ACTIVE", supplier_type: "DISTRIBUTOR", primary_contact_name: "Ravi Kumar", contact_email: "ravi@acme.com", contact_phone: "+91 98480 00000", tax_registration_num: "36ABCDE1234F1Z5", payment_terms_code: "NET_30", currency_code: "INR", supplier_site_code: "HYD_DC_1", address_line1: "12 Industrial Area", address_line2: "Unit 4", city: "Hyderabad", state: "Telangana", zip_postal_code: "500032", country: "IN" },
    put: { supplier_status: "HOLD", contact_phone: "+91 99999 11111" } },
  { key: "items", title: "Items", one: "item", api: "/api/items", pk: "item_id", num: "item_number", search: "Search SKU, name, category, barcode",
    status: "item_status", statusOpts: ["ACTIVE", "INACTIVE", "DISCONTINUED"], filters: ["item_category", "warehouse_id", "inventory_item_id"], audit: AUD,
    note: "One row per item per warehouse. inventory_item_id is the Fusion INVENTORY_ITEM_ID; warehouse_id links to Warehouses. Inventory balances link back here by item_id.",
    cols: [["item_number", "SKU"], ["inventory_item_id", "Inv. item ID"], ["warehouse_id", "Warehouse"], ["item_name", "Name"], ["item_category", "Category"], ["primary_uom", "UOM"], ["upc_barcode", "Barcode"], ["min_stock_level", "Min"], ["max_stock_level", "Max"], ["item_status", "Status", "pill"]],
    fields: [ID("item_id", "Item ID"), F("inventory_item_id", "Inventory item ID (Fusion)", "number", { req: 1 }), F("warehouse_id", "Warehouse ID", "number", { req: 1 }), F("item_number", "Item number (SKU)", "text", { req: 1 }), F("item_name", "Item name"), F("description", "Description", "text", { wide: 1 }), F("primary_uom", "Primary UOM"), F("secondary_uom", "Secondary UOM"), F("item_category", "Category"), F("upc_barcode", "UPC barcode"), F("unit_weight", "Unit weight", "number"), F("weight_uom", "Weight UOM"), F("unit_volume", "Unit volume", "number"), YN("is_lot_controlled", "Lot controlled"), YN("is_serial_controlled", "Serial controlled"), F("min_stock_level", "Min stock level", "number"), F("max_stock_level", "Max stock level", "number"), S("item_status", "Status", ["ACTIVE", "INACTIVE", "DISCONTINUED"])],
    sample: { item_id: 2001, inventory_item_id: 300000555001, warehouse_id: 300000001, item_number: "SKU-10029", item_name: "Hex Bolt M8", description: "Zinc plated hex bolt M8x40", primary_uom: "EACH", item_category: "Hardware", upc_barcode: "8901234567890", unit_weight: 0.02, weight_uom: "KG", is_lot_controlled: "N", is_serial_controlled: "N", min_stock_level: 100, max_stock_level: 5000, item_status: "ACTIVE" },
    put: { item_status: "INACTIVE", max_stock_level: 8000 } },
  { key: "inventory", title: "Inventory", one: "balance", api: "/api/inventory", pk: "balance_id", num: "item_number", search: "Search SKU, zone, bin, lot, serial",
    status: null, filters: ["warehouse_id", "item_id", "inventory_item_id", "item_number", "zone"], audit: AUD,
    note: "warehouse_id links to Warehouses and item_id links to the Items row of that same warehouse (checked on save). qty_available is stored exactly as you send it; it is not calculated.",
    cols: [["item_number", "SKU"], ["item_id", "Item ID"], ["warehouse_id", "Warehouse"], ["zone", "Zone"], ["aisle", "Aisle"], ["shelf", "Shelf"], ["bin", "Bin"], ["qty_on_hand", "On hand"], ["qty_allocated", "Allocated"], ["qty_available", "Available"], ["lot_number", "Lot"]],
    fields: [ID("balance_id", "Balance ID"), F("warehouse_id", "Warehouse ID", "number", { req: 1 }), F("item_id", "Item ID", "number", { req: 1 }), F("inventory_item_id", "Inventory item ID (Fusion)", "number"), F("item_number", "Item number", "text", { req: 1 }), F("zone", "Zone"), F("aisle", "Aisle"), F("shelf", "Shelf"), F("bin", "Bin"), F("qty_on_hand", "Qty on hand", "number"), F("qty_allocated", "Qty allocated", "number"), F("qty_available", "Qty available", "number"), F("lot_number", "Lot number"), F("expiration_date", "Expiration date", "date"), F("serial_number", "Serial number"), F("last_counted_date", "Last counted", "date")],
    sample: { balance_id: 3001, warehouse_id: 300000001, item_id: 2001, inventory_item_id: 300000555001, item_number: "SKU-10029", zone: "ZONE-A", aisle: "AISLE-04", shelf: "LEVEL-02", bin: "BIN-12", qty_on_hand: 40, qty_allocated: 3, qty_available: 37, lot_number: "LOT-2026-09", expiration_date: "2027-09-30" },
    put: { qty_on_hand: 35, qty_available: 32 } },
  { key: "purchase-orders", title: "Purchase Orders", one: "purchase order", api: "/api/purchase-orders", pk: "po_header_id", num: "po_number", search: "Search PO, supplier, buyer",
    status: "po_status", statusOpts: ["OPEN", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED"], filters: ["supplier_id", "fusion_header_id"], audit: AUD,
    note: "Send the header with an optional lines array. po_line_id and line_number come from you; po_header_id on each line is taken from the header. total_amount is stored as sent. A PUT that includes lines replaces all existing lines.",
    cols: [["po_number", "PO number"], ["supplier_name", "Supplier"], ["order_date", "Ordered"], ["expected_delivery_date", "Expected"], ["line_count", "Lines"], ["total_amount", "Total"], ["currency_code", "Cur."], ["po_status", "Status", "pill"]],
    fields: [ID("po_header_id", "PO header ID"), F("po_number", "PO number", "text", { req: 1 }), F("fusion_header_id", "Fusion header ID", "number"), F("supplier_id", "Supplier ID"), F("supplier_name", "Supplier name"), F("supplier_site", "Supplier site"), F("buyer_name", "Buyer"), F("order_date", "Order date", "date"), F("expected_delivery_date", "Expected delivery", "date"), F("payment_terms", "Payment terms"), F("currency_code", "Currency", "text", { ph: "INR" }), F("total_amount", "Total amount", "number"), S("po_status", "Status", ["OPEN", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED"]), F("comments", "Comments", "textarea", { wide: 1 })],
    lines: { pk: "po_line_id", fields: [F("po_line_id", "Line ID", "number", { req: 1 }), F("line_number", "Line #", "number", { req: 1 }), F("item_number", "Item #", "text", { req: 1 }), F("item_description", "Description"), F("uom", "UOM"), F("qty_ordered", "Qty ordered", "number"), F("qty_received", "Received", "number"), F("qty_rejected", "Rejected", "number"), F("unit_price", "Unit price", "number"), S("line_status", "Status", ["AWAITING_RECEIPT", "PARTIAL", "CLOSED"])],
      sample: [{ po_line_id: 40001, line_number: 1, item_number: "SKU-10029", item_description: "Hex Bolt M8", uom: "EACH", qty_ordered: 500, qty_received: 0, qty_rejected: 0, unit_price: 1.25, line_status: "AWAITING_RECEIPT" }, { po_line_id: 40002, line_number: 2, item_number: "SKU-10030", uom: "BOX", qty_ordered: 20, unit_price: 40 }] },
    sample: { po_header_id: 4001, po_number: "PO-2026-0001", fusion_header_id: 300000123456, supplier_id: "SUP-10045", supplier_name: "Acme Traders Pvt Ltd", supplier_site: "HYD_DC_1", buyer_name: "Anita Rao", order_date: "2026-10-01", expected_delivery_date: "2026-10-15", payment_terms: "NET_30", currency_code: "INR", po_status: "OPEN", total_amount: 1425 },
    put: { po_status: "PARTIALLY_RECEIVED" } },
  { key: "sales-orders", title: "Sales Orders", one: "sales order", api: "/api/sales-orders", pk: "so_header_id", num: "so_number", search: "Search SO, customer, city, carrier",
    status: "so_status", statusOpts: ["AWAITING_PICK", "PICKING", "PACKED", "SHIPPED", "CANCELLED"], filters: ["customer_id", "fusion_so_header_id"], audit: AUD,
    note: "Send the header with an optional lines array. so_line_id and line_number come from you; so_header_id on each line is taken from the header. A PUT that includes lines replaces all existing lines.",
    cols: [["so_number", "SO number"], ["customer_name", "Customer"], ["shipping_city", "City"], ["carrier_code", "Carrier"], ["required_ship_date", "Ship by"], ["line_count", "Lines"], ["so_status", "Status", "pill"]],
    fields: [ID("so_header_id", "SO header ID"), F("so_number", "SO number", "text", { req: 1 }), F("fusion_so_header_id", "Fusion SO header ID", "number"), F("customer_id", "Customer ID"), F("customer_name", "Customer name"), F("shipping_address_line1", "Shipping address", "text", { wide: 1 }), F("shipping_city", "City"), F("shipping_state", "State"), F("shipping_zip", "ZIP / postal code"), F("shipping_country", "Country"), F("carrier_code", "Carrier", "text", { ph: "DHL" }), F("shipping_method", "Shipping method", "text", { ph: "GROUND" }), F("order_date", "Order date", "date"), F("required_ship_date", "Required ship date", "date"), S("so_status", "Status", ["AWAITING_PICK", "PICKING", "PACKED", "SHIPPED", "CANCELLED"])],
    lines: { pk: "so_line_id", fields: [F("so_line_id", "Line ID", "number", { req: 1 }), F("line_number", "Line #", "number", { req: 1 }), F("item_number", "Item #", "text", { req: 1 }), F("uom", "UOM"), F("qty_requested", "Qty requested", "number"), F("qty_picked", "Picked", "number"), F("qty_shipped", "Shipped", "number"), F("pick_zone_preference", "Pick zone"), F("line_status", "Status", "text", { ph: "RELEASED" })],
      sample: [{ so_line_id: 50001, line_number: 1, item_number: "SKU-10029", uom: "EACH", qty_requested: 12, qty_picked: 0, qty_shipped: 0, pick_zone_preference: "ZONE-A", line_status: "RELEASED" }] },
    sample: { so_header_id: 5001, so_number: "SO-2026-0001", fusion_so_header_id: 300000654321, customer_id: "CUST-77", customer_name: "Zenith Retail", shipping_address_line1: "5 MG Road", shipping_city: "Pune", shipping_state: "Maharashtra", shipping_zip: "411001", shipping_country: "India", carrier_code: "DHL", shipping_method: "GROUND", order_date: "2026-10-02", required_ship_date: "2026-10-09", so_status: "AWAITING_PICK" },
    put: { so_status: "PICKING" } }
];

/* ===================== UI layer (logic/API calls unchanged) ===================== */
const svg = p => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  warehouses: svg('<path d="M3 21V9l9-6 9 6v12M7 21v-7h10v7M7 17h10"/>'),
  suppliers: svg('<path d="M1 6h13v11H1zM14 10h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
  items: svg('<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>'),
  inventory: svg('<path d="M3 4h18v5H3zM5 9v11h14V9M10 13h4"/>'),
  "purchase-orders": svg('<path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6"/>'),
  "sales-orders": svg('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'),
  api: svg('<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>'),
  auto: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18z" fill="currentColor"/>'),
  light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>'),
  dark: svg('<path d="M21 13a9 9 0 11-10-10 7 7 0 0010 10z"/>'),
  refresh: svg('<path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 4M12 17h.01"/>'),
  menu: svg('<path d="M3 6h18M3 12h18M3 18h18"/>')
};
const GROUPS = [["Overview", ["dashboard"]], ["Master data", ["warehouses", "suppliers", "items"]], ["Operations", ["inventory", "purchase-orders", "sales-orders"]], ["Developer", ["api"]]];
const KEYS = GROUPS.flatMap(g => g[1]);
const label = k => k === "dashboard" ? "Dashboard" : k === "api" ? "API Reference" : RES.find(r => r.key === k).title;
const isList = () => st.res && st.view !== "dashboard" && st.view !== "api";
const copyText = async t => {
  try { await navigator.clipboard.writeText(t); }
  catch { const a = document.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;opacity:0"; document.body.append(a); a.select(); const ok = document.execCommand("copy"); a.remove(); if (!ok) return toast("Copy failed", "err"); }
  toast("Copied");
};
const human = s => String(s).replace(/_/g, " ");

const prefs = (() => { try { return JSON.parse(localStorage.getItem("wms_prefs")) || {}; } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem("wms_prefs", JSON.stringify({ every: st.every, limit: st.limit })); } catch { } };
Object.assign(st, { every: prefs.every ?? 10000, limit: prefs.limit || 10, sort: null, sel: new Set(), status: "", rows: [], view: "dashboard", flash: new Set(), busy: false });

function toast(msg, type = "ok") {
  const t = document.createElement("div"); t.className = "toast " + type; t.textContent = msg; $("#toasts").append(t);
  setTimeout(() => t.classList.add("out"), 2800); setTimeout(() => t.remove(), 3250);
}
function setLive(ok) {
  const l = $("#live"); l.classList.toggle("bad", !ok); l.classList.toggle("off", ok && !st.every);
  $("#liveTxt").textContent = !ok ? "Offline" : (st.every ? "Live" : "Paused") + " · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
async function api(path, { method = "GET", body } = {}) {
  let res;
  try { res = await fetch(path, { method, headers: { "Content-Type": "application/json", ...(st.token ? { Authorization: "Basic " + st.token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { setLive(false); throw new Error("Cannot reach the server"); }
  setLive(true);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && st.token) signOut();
  if (!res.ok) { const e = new Error(data.error || "Request failed"); e.data = data; throw e; }
  return data;
}
const fmt = o => Object.entries(o).map(([k, v]) => `${k}: ${v && typeof v === "object" ? fmt(v) : v}`).join("; ");

function confirmBox(msg, ok = "Delete") {
  return new Promise(res => {
    const d = $("#cfm"); $("#cfmMsg").textContent = msg; $("#cfmOk").textContent = ok;
    const done = v => { d.close(); res(v); };
    $("#cfmOk").onclick = () => done(true); $("#cfmNo").onclick = () => done(false); d.oncancel = () => res(false); d.showModal();
  });
}

/* ---------- theme ---------- */
const THEMES = ["auto", "light", "dark"];
function applyTheme(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { localStorage.setItem("wms_theme", t); } catch { }
  $("#themeBtn").innerHTML = ICON[t]; $("#themeBtn").title = "Theme: " + t + " (click to change)"; st.theme = t;
}
$("#themeBtn").onclick = () => applyTheme(THEMES[(THEMES.indexOf(st.theme) + 1) % 3]);

/* ---------- auth: HTTP Basic on every call (no login API, no token) ---------- */
const basic = (u, p) => btoa(unescape(encodeURIComponent(u + ":" + p)));
function showApp() {
  $("#login").hidden = true; $("#app").hidden = false;
  $("#userName").textContent = $("#docUser").textContent = st.user; $("#avatar").textContent = st.user[0].toUpperCase();
  const k = location.hash.slice(2); selectTab(KEYS.includes(k) ? k : "dashboard"); schedule();
}
function signOut() {
  sessionStorage.removeItem("wms_basic"); sessionStorage.removeItem("wms_user"); st.token = st.user = null; clearTimeout(liveTimer);
  setDrawer(false); $("#app").hidden = true; $("#login").hidden = false;
}
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#loginErr").textContent = "";
  const f = Object.fromEntries(new FormData(e.target));
  st.token = basic(f.username, f.password); st.user = f.username;
  try { await api("/api/suppliers?limit=1"); sessionStorage.setItem("wms_basic", st.token); sessionStorage.setItem("wms_user", st.user); e.target.reset(); showApp(); }
  catch (err) { st.token = st.user = null; $("#loginErr").textContent = err.message.startsWith("Unauthorized") ? "Invalid username or password" : err.message; }
});
$("#pwToggle").onclick = () => { const i = $("#loginForm [name=password]"); i.type = i.type === "password" ? "text" : "password"; $("#pwToggle").textContent = i.type === "password" ? "Show" : "Hide"; };
$("#logout").onclick = signOut;

/* ---------- navigation ---------- */
$("#nav").innerHTML = GROUPS.map(([g, ks]) => `<div class="nav-group">${g}</div>` + ks.map((k, i) => `<button data-tab="${k}">${ICON[k]}<span>${label(k)}</span><em class="badge" id="b-${k}"></em></button>`).join("")).join("");
$("#nav").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) selectTab(b.dataset.tab); });
$("#menuBtn").innerHTML = ICON.menu; $("#refreshBtn").innerHTML = ICON.refresh; $("#helpBtn").innerHTML = ICON.help;
const syncScrim = () => $("#scrim").classList.toggle("show", $("#side").classList.contains("open") || $("#drawer").classList.contains("open"));
$("#menuBtn").onclick = () => { $("#side").classList.toggle("open"); syncScrim(); };
$("#scrim").onclick = () => { $("#side").classList.remove("open"); setDrawer(false); };
function setDrawer(open) { $("#drawer").classList.toggle("open", open); $("#drawer").inert = !open; syncScrim(); }
const closeDrawer = () => setDrawer(false);
$("#drClose").onclick = closeDrawer;
window.addEventListener("hashchange", () => { const k = location.hash.slice(2); if (st.token && KEYS.includes(k) && k !== st.view) selectTab(k); });

function selectTab(key) {
  st.view = key; if (location.hash !== "#/" + key) history.replaceState(null, "", "#/" + key);
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("active", b.dataset.tab === key));
  $("#side").classList.remove("open"); closeDrawer();
  $("#tab-dash").hidden = key !== "dashboard"; $("#view").hidden = !RES.some(r => r.key === key); $("#tab-api").hidden = key !== "api";
  $("#crumbs").innerHTML = `Warehouse / <b>${label(key)}</b>`;
  if (key === "dashboard") return loadDash();
  if (key === "api") return;
  const r = st.res = RES.find(x => x.key === key);
  Object.assign(st, { page: 1, sort: null, status: "", rows: [], flash: new Set(), ctx: null }); st.sel.clear();
  $("#title").textContent = r.title; $("#subtitle").textContent = r.note || ""; $("#subtitle").hidden = !r.note;
  $("#addBtn").textContent = "+ Add " + r.one; $("#q").value = ""; $("#q").placeholder = r.search; $("#limit").value = st.limit;
  renderChips(); renderHead(); load();
}
function renderChips() {
  const r = st.res, box = $("#chips"); box.hidden = !r.status; if (!r.status) return;
  box.innerHTML = ["", ...r.statusOpts].map(s => `<button class="chip${st.status === s ? " on" : ""}" data-st="${s}">${s ? human(s) : "All"}</button>`).join("");
}
$("#chips").addEventListener("click", e => { const b = e.target.closest("[data-st]"); if (!b) return; st.status = b.dataset.st; st.page = 1; st.sel.clear(); renderChips(); load(); });
$("#limit").onchange = () => { st.limit = +$("#limit").value; st.page = 1; savePrefs(); load(); };
function renderHead() {
  const r = st.res;
  $("#thead").innerHTML = `<tr><th class="chk"><input type="checkbox" id="selAll" aria-label="Select all"></th>${r.cols.map(c => `<th class="sortable" data-sort="${c[0]}">${c[1]}<span class="arr">${st.sort?.key === c[0] ? (st.sort.dir > 0 ? "▲" : "▼") : ""}</span></th>`).join("")}<th></th></tr>`;
}
$("#thead").addEventListener("click", e => {
  const th = e.target.closest("[data-sort]"); if (!th) return;
  const k = th.dataset.sort; st.sort = st.sort?.key === k ? (st.sort.dir > 0 ? { key: k, dir: -1 } : null) : { key: k, dir: 1 };
  renderHead(); renderRows();
});
$("#thead").addEventListener("change", e => {
  if (e.target.id !== "selAll") return;
  st.rows.forEach(x => e.target.checked ? st.sel.add(String(x[st.res.pk])) : st.sel.delete(String(x[st.res.pk]))); renderRows();
});

/* ---------- list ---------- */
const pillClass = v => { v = String(v).toLowerCase(); return ["active", "fully_received", "shipped", "packed"].includes(v) ? "active" : ["open", "awaiting_pick", "picking", "partially_received", "hold"].includes(v) ? "warn" : ["cancelled", "discontinued"].includes(v) ? "bad" : "inactive"; };
const dash = '<span class="muted">—</span>';
const skeleton = () => Array.from({ length: 5 }, () => `<tr class="sk"><td colspan="${st.res.cols.length + 2}"><i></i></td></tr>`).join("");
function renderRows() {
  const r = st.res; let rows = [...st.rows];
  if (st.sort) {
    const { key, dir } = st.sort, nil = v => v == null || v === "";
    rows.sort((a, b) => { const x = a[key], y = b[key]; if (nil(x) && nil(y)) return 0; if (nil(x)) return 1; if (nil(y)) return -1; return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir; });
  }
  $("#rows").innerHTML = rows.map(row => {
    const id = row[r.pk], on = st.sel.has(String(id));
    const cells = r.cols.map((c, i) => {
      const v = row[c[0]];
      if (c[2] === "pill" && c[0] === r.status) return `<td><select class="qs pill ${pillClass(v)}" data-qs="${id}" title="Change status">${v ? "" : '<option value="" selected>—</option>'}${r.statusOpts.map(o => `<option value="${o}" ${o === v ? "selected" : ""}>${human(o)}</option>`).join("")}</select></td>`;
      if (c[2] === "pill") return `<td><span class="pill ${pillClass(v)}">${esc(v)}</span></td>`;
      if (v == null || v === "") return `<td>${dash}</td>`;
      return `<td>${i === 0 ? `<a class="lnk" data-view="${id}">${esc(v)}</a>` : esc(v)}</td>`;
    }).join("");
    return `<tr data-id="${id}" class="${st.flash.has(String(id)) ? "flash" : ""} ${on ? "sel" : ""}"><td class="chk"><input type="checkbox" data-sel="${id}" ${on ? "checked" : ""} aria-label="Select row"></td>${cells}
      <td class="row-actions"><button data-view="${id}">View</button><button data-edit="${id}">Edit</button><button class="del" data-del="${id}">Delete</button></td></tr>`;
  }).join("");
  const filtered = $("#q").value || st.status;
  $("#empty").hidden = rows.length > 0;
  $("#empty").innerHTML = filtered ? `No ${r.title.toLowerCase()} match your filters.<br><button class="btn sm" id="clearF">Clear filters</button>` : `No ${r.title.toLowerCase()} yet.<br>Add one, import JSON, or push data through the API.`;
  syncBulk();
}
function syncBulk() {
  const r = st.res, ids = st.rows.map(x => String(x[r.pk])), n = ids.filter(i => st.sel.has(i)).length, all = $("#selAll");
  if (all) { all.checked = n > 0 && n === ids.length; all.indeterminate = n > 0 && n < ids.length; }
  $("#bulk").hidden = st.sel.size === 0; $("#bulkN").textContent = `${st.sel.size} selected`;
}
async function load(silent) {
  const r = st.res, p = new URLSearchParams({ page: st.page, limit: st.limit, q: $("#q").value, status: st.status });
  const ctx = [r.key, st.page, st.limit, $("#q").value, st.status].join("|");
  if (!silent) $("#rows").innerHTML = skeleton();
  try {
    const d = await api(r.api + "?" + p);
    if (st.res !== r) return;
    const prev = st.prev, now = new Map(d.data.map(x => [String(x[r.pk]), JSON.stringify(x)]));
    st.flash = new Set(silent && st.ctx === ctx && prev ? [...now].filter(([k, v]) => prev.get(k) !== v).map(([k]) => k) : []);
    st.prev = now; st.ctx = ctx; st.rows = d.data; st.total = d.total;
    if (d.total && !d.data.length && st.page > 1) { st.page = Math.max(1, Math.ceil(d.total / st.limit)); return load(); }
    renderRows();
    const pages = Math.max(1, Math.ceil(d.total / d.limit));
    $("#count").textContent = `${d.total ? (d.page - 1) * d.limit + 1 : 0}–${Math.min(d.page * d.limit, d.total)} of ${d.total}`;
    $("#pageInfo").textContent = `Page ${d.page} / ${pages}`;
    $("#prev").disabled = d.page <= 1; $("#next").disabled = d.page * d.limit >= d.total;
    if (!$("#q").value && !st.status) $("#b-" + r.key).textContent = d.total;
  } catch (e) { if (!silent) { toast(e.message, "err"); $("#rows").innerHTML = ""; } }
}
let timer; $("#q").oninput = () => { clearTimeout(timer); timer = setTimeout(() => { st.page = 1; st.sel.clear(); load(); }, 250); };
$("#prev").onclick = () => { st.page--; load(); }; $("#next").onclick = () => { st.page++; load(); };
$("#empty").addEventListener("click", e => { if (e.target.id === "clearF") { $("#q").value = ""; st.status = ""; st.page = 1; renderChips(); load(); } });

$("#rows").addEventListener("click", async e => {
  const b = e.target.closest("[data-view],[data-edit],[data-del]");
  if (b) {
    const { view, edit, del } = b.dataset;
    if (view) openView(view); else if (edit) openForm(edit); else if (del) delOne(del);
    return;
  }
  if (e.target.closest("input,select,a")) return;
  const tr = e.target.closest("tr[data-id]"); if (tr) openView(tr.dataset.id);
});
$("#rows").addEventListener("change", async e => {
  const t = e.target, r = st.res;
  if (t.dataset.sel !== undefined) { t.checked ? st.sel.add(t.dataset.sel) : st.sel.delete(t.dataset.sel); t.closest("tr").classList.toggle("sel", t.checked); syncBulk(); }
  else if (t.dataset.qs !== undefined) {
    try { await api(`${r.api}/${t.dataset.qs}`, { method: "PUT", body: { [r.status]: t.value } }); toast(`Status set to ${human(t.value)}`); }
    catch (err) { toast(err.message, "err"); }
    load(true);
  }
});
async function delOne(id) {
  const r = st.res; if (!await confirmBox(`Delete this ${r.one}? This cannot be undone.`)) return;
  try { await api(`${r.api}/${id}`, { method: "DELETE" }); toast("Deleted"); st.sel.delete(String(id)); closeDrawer(); load(); } catch (err) { toast(err.message, "err"); }
}
$("#bulk").addEventListener("click", async e => {
  const a = e.target.dataset.bulk, r = st.res; if (!a) return;
  if (a === "clear") { st.sel.clear(); renderRows(); }
  if (a === "export") exportCsv(true);
  if (a === "delete") {
    const ids = [...st.sel]; if (!await confirmBox(`Delete ${ids.length} selected ${r.one}${ids.length > 1 ? "s" : ""}? This cannot be undone.`, `Delete ${ids.length}`)) return;
    let ok = 0, bad = 0; for (const id of ids) { try { await api(`${r.api}/${id}`, { method: "DELETE" }); ok++; } catch { bad++; } }
    st.sel.clear(); toast(`Deleted ${ok}${bad ? `, ${bad} failed` : ""}`, bad ? "err" : "ok"); load();
  }
});

/* ---------- export CSV ---------- */
async function exportCsv(onlySel) {
  const r = st.res; let rows = [];
  try {
    if (onlySel) rows = st.rows.filter(x => st.sel.has(String(x[r.pk])));
    else {
      const p = new URLSearchParams({ limit: 200, q: $("#q").value, status: st.status }); let page = 1, total = 1;
      while (rows.length < total && page <= 50) { p.set("page", page++); const d = await api(r.api + "?" + p); total = d.total; if (!d.data.length) break; rows.push(...d.data); }
    }
  } catch (e) { return toast(e.message, "err"); }
  if (!rows.length) return toast("Nothing to export", "err");
  const keys = [...new Set(rows.flatMap(Object.keys))], q = v => { if (v == null) return ""; v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = [keys.join(","), ...rows.map(x => keys.map(k => q(x[k])).join(","))].join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" })); a.download = `${r.key}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast(`Exported ${rows.length} row(s)`);
}
$("#exportBtn").onclick = () => exportCsv(false);

/* ---------- details drawer ---------- */
async function openView(id) {
  const r = st.res; let d;
  try { d = (await api(`${r.api}/${id}`)).data; } catch (e) { return toast(e.message, "err"); }
  st.viewId = id; st.viewData = d;
  const lab = Object.fromEntries(r.fields.map(f => [f.n, f.l])), keys = [...r.fields.map(f => f.n), ...Object.keys(r.audit)].filter(k => k in d);
  $("#drKind").textContent = r.one.toUpperCase(); $("#drTitle").textContent = d[r.num] ?? id;
  let h = `<dl class="kv">${keys.map(k => `<dt>${esc(lab[k] || human(k))}</dt><dd>${d[k] == null || d[k] === "" ? dash : k === r.status ? `<span class="pill ${pillClass(d[k])}">${esc(d[k])}</span>` : esc(d[k])}</dd>`).join("")}</dl>`;
  if (r.lines) {
    h += `<div><h4>Lines (${d.lines?.length || 0})</h4>${d.lines?.length ? `<div class="table-wrap"><table><thead><tr>${r.lines.fields.map(f => `<th>${f.l}</th>`).join("")}</tr></thead><tbody>${d.lines.map(l => `<tr>${r.lines.fields.map(f => `<td>${l[f.n] == null ? "" : esc(l[f.n])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : '<p class="muted">No lines.</p>'}</div>`;
  }
  h += `<details><summary>Raw JSON</summary><pre>${J(d)}</pre></details>`;
  $("#drBody").innerHTML = h; setDrawer(true);
}
$("#drEdit").onclick = () => { const id = st.viewId; closeDrawer(); openForm(id); };
$("#drCopy").onclick = () => copyText(JSON.stringify(st.viewData, null, 2));
$("#drDel").onclick = () => delOne(st.viewId);

/* ---------- add / edit form ---------- */
const ctl = (f, v = "", ro = false) => {
  const a = `name="${f.n}" ${f.req ? "required" : ""} ${ro ? "readonly" : ""} ${f.ph ? `placeholder="${esc(f.ph)}"` : ""}`;
  if (f.t === "select") return `<select ${a}>${f.opts.map(o => `<option value="${o}" ${o === (v ?? "") ? "selected" : ""}>${o || "—"}</option>`).join("")}</select>`;
  if (f.t === "textarea") return `<textarea ${a} rows="2">${esc(v)}</textarea>`;
  return `<input ${a} type="${f.t}" ${f.t === "number" ? 'step="any" min="0"' : ""} value="${esc(f.t === "date" ? String(v ?? "").slice(0, 10) : v)}">`;
};
function lineRow(L, v = {}) {
  return `<tr>${L.fields.map(f => `<td>${ctl(f, v[f.n] ?? "")}</td>`).join("")}<td><button type="button" class="btn sm danger" data-rm title="Remove line">✕</button></td></tr>`;
}
async function openForm(id) {
  const r = st.res; st.editId = id || null; $("#formErr").textContent = "";
  let d = {}; if (id) { try { d = (await api(`${r.api}/${id}`)).data; } catch (e) { return toast(e.message, "err"); } }
  $("#dlgTitle").textContent = (id ? "Edit " : "Add ") + r.one; $("#fillSample").hidden = !!id;
  $("#grid").innerHTML = r.fields.map(f => `<label class="${f.wide ? "wide" : ""}">${f.l}${f.req ? " *" : ""}${ctl(f, d[f.n] ?? "", !!id && !!f.pk)}</label>`).join("");
  $("#linesBox").hidden = !r.lines;
  if (r.lines) {
    $("#lhead").innerHTML = `<tr>${r.lines.fields.map(f => `<th>${f.l}</th>`).join("")}<th></th></tr>`;
    const ls = d.lines?.length ? d.lines : [{}]; $("#lrows").innerHTML = ls.map(l => lineRow(r.lines, l)).join("");
  }
  $("#dlg").showModal();
}
const read = (root, fields, editing) => {
  const o = {};
  for (const f of fields) {
    if (editing && f.pk) continue;
    const el = root.querySelector(`[name="${f.n}"]`); let v = el.value.trim();
    if (v === "") { if (editing && !f.auto && !f.req) o[f.n] = null; continue; }
    o[f.n] = f.t === "number" ? Number(v) : v;
  }
  return o;
};
$("#addBtn").onclick = () => openForm(null);
$("#addLine").onclick = () => $("#lrows").insertAdjacentHTML("beforeend", lineRow(st.res.lines));
$("#lrows").addEventListener("click", e => { if (e.target.dataset.rm !== undefined && $("#lrows").children.length > 1) e.target.closest("tr").remove(); });
$("#cancel").onclick = () => $("#dlg").close();
$("#fillSample").onclick = () => {
  const r = st.res;
  r.fields.forEach(f => { const el = $("#grid").querySelector(`[name="${f.n}"]`), v = r.sample[f.n]; if (el && v != null) el.value = f.t === "date" ? String(v).slice(0, 10) : v; });
  if (r.lines) $("#lrows").innerHTML = r.lines.sample.map(l => lineRow(r.lines, l)).join("");
};
$("#copyForm").onclick = () => {
  const r = st.res, body = read($("#grid"), r.fields, !!st.editId);
  if (r.lines) body.lines = [...$("#lrows").children].map(tr => read(tr, r.lines.fields, false)).filter(l => Object.keys(l).length);
  copyText(JSON.stringify(body, null, 2));
};
$("#impCopy").onclick = () => copyText($("#impText").value.trim() || JSON.stringify([withLines(st.res, st.res.sample)], null, 2));
$("#form").addEventListener("submit", async e => {
  e.preventDefault(); const r = st.res, editing = !!st.editId;
  const body = read($("#grid"), r.fields, editing);
  if (r.lines) body.lines = [...$("#lrows").children].map(tr => read(tr, r.lines.fields, false)).filter(l => Object.keys(l).length);
  try { await api(editing ? `${r.api}/${st.editId}` : r.api, { method: editing ? "PUT" : "POST", body }); $("#dlg").close(); toast("Saved"); load(); }
  catch (err) { $("#formErr").textContent = err.data?.details ? fmt(err.data.details) : err.message; }
});

/* ---------- import ---------- */
$("#importBtn").onclick = () => { const r = st.res; $("#impTitle").textContent = `Import ${r.title.toLowerCase()} from JSON`; $("#impUrl").textContent = `POST ${r.api}/bulk`; $("#impText").placeholder = JSON.stringify([withLines(r, r.sample)], null, 1).slice(0, 400) + "…"; $("#impMsg").textContent = ""; $("#imp").showModal(); };
$("#impCancel").onclick = () => $("#imp").close();
$("#impSample").onclick = () => { $("#impText").value = JSON.stringify([withLines(st.res, st.res.sample)], null, 2); };
$("#impPick").onclick = () => $("#impFile").click();
$("#impFile").onchange = async e => { const f = e.target.files[0]; if (f) $("#impText").value = await f.text(); e.target.value = ""; };
$("#impForm").addEventListener("submit", async e => {
  e.preventDefault(); let body;
  try { body = JSON.parse($("#impText").value); } catch { $("#impMsg").textContent = "That is not valid JSON."; return; }
  try { const d = await api(st.res.api + "/bulk", { method: "POST", body }); $("#imp").close(); $("#impText").value = ""; toast(`Imported ${d.created_count} record(s)`); load(); }
  catch (err) { const d = err.data; $("#impMsg").textContent = d?.failed ? `${d.failed_count} failed. First problem (row ${d.failed[0].index + 1}): ${fmt(d.failed[0].error)}` : err.message; }
});

/* ---------- dashboard ---------- */
async function loadDash(silent) {
  const h = new Date().getHours(), R = k => RES.find(r => r.key === k);
  $("#hello").textContent = `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${st.user}`;
  $("#today").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const [sup, itm, inv, po, so] = ["suppliers", "items", "inventory", "purchase-orders", "sales-orders"].map(R);
  const cnt = (r, s) => api(`${r.api}?limit=1${s ? "&status=" + s : ""}`).then(d => d.total);
  const whP = cnt(R("warehouses"));
  try {
    const [supT, supA, itmT, itmA, invT, poS, soS, poR, soR] = await Promise.all([cnt(sup), cnt(sup, "ACTIVE"), cnt(itm), cnt(itm, "ACTIVE"), cnt(inv),
      Promise.all(po.statusOpts.map(s => cnt(po, s))), Promise.all(so.statusOpts.map(s => cnt(so, s))), api(po.api + "?limit=5"), api(so.api + "?limit=5")]);
    if (st.view !== "dashboard") return;
    const poT = poS.reduce((a, b) => a + b, 0), soT = soS.reduce((a, b) => a + b, 0);
    [["suppliers", supT], ["items", itmT], ["inventory", invT], ["purchase-orders", poT], ["sales-orders", soT]].forEach(([k, n]) => $("#b-" + k).textContent = n);
    const whT = await whP;
    const stat = (go, l, n, sub) => `<button class="stat" data-go="${go}"><span>${l}</span><strong>${n}</strong><em>${sub}</em></button>`;
    const pipe = (r, c) => { const t = c.reduce((a, b) => a + b, 0); return `<div class="seg" role="img" aria-label="${r.title} by status">${r.statusOpts.map((s, i) => c[i] ? `<i class="${pillClass(s)}" style="flex:${c[i]}" title="${human(s)}: ${c[i]}"></i>` : "").join("")}</div><div class="legend">${r.statusOpts.map((s, i) => `<div><i class="${pillClass(s)}"></i>${human(s)}<b>${c[i]}</b></div>`).join("")}</div>`; };
    const recent = (r, d) => `<ul class="recent">${d.data.length ? d.data.map(x => `<li><button data-go="${r.key}" data-open="${x[r.pk]}"><code>${esc(x[r.num])}</code><span>${esc(x.supplier_name || x.customer_name || "")}</span><span class="pill ${pillClass(x[r.status])}">${esc(human(x[r.status] || "—"))}</span></button></li>`).join("") : '<li class="muted">No records yet. Add one or push data through the API.</li>'}</ul>`;
    $("#dashBody").innerHTML = `
      <div class="dtop"><button class="btn primary" data-new="sales-orders">New sales order</button><button class="btn" data-new="purchase-orders">New purchase order</button><button class="btn" data-new="items">Add item</button><button class="btn" data-new="inventory">Add inventory</button></div>
      <div class="focus">
        <button class="fcard" data-go="sales-orders"><div><div class="t">Orders awaiting pick</div><div class="s">${soS[1]} picking · ${soS[2]} packed</div></div><strong>${soS[0]}</strong></button>
        <button class="fcard po" data-go="purchase-orders"><div><div class="t">Open purchase orders</div><div class="s">${poS[1]} partially received</div></div><strong>${poS[0]}</strong></button>
      </div>
      <div class="stats">
        ${stat("warehouses", "Warehouses", whT, "locations")}${stat("suppliers", "Suppliers", supT, `${supA} active`)}${stat("items", "Items", itmT, `${itmA} active`)}${stat("inventory", "Inventory records", invT, "bin and lot balances")}${stat("sales-orders", "Shipped orders", soS[3], `${soS[4]} cancelled`)}
      </div>
      <div class="panels">
        <div class="panel"><h3>Purchase orders <span class="muted">${poT} total</span></h3>${pipe(po, poS)}</div>
        <div class="panel"><h3>Sales orders <span class="muted">${soT} total</span></h3>${pipe(so, soS)}</div>
      </div>
      <div class="panels">
        <div class="panel"><h3>Latest purchase orders <button class="mini" data-go="purchase-orders">View all</button></h3>${recent(po, poR)}</div>
        <div class="panel"><h3>Latest sales orders <button class="mini" data-go="sales-orders">View all</button></h3>${recent(so, soR)}</div>
      </div>`;
  } catch (e) { if (!silent) toast(e.message, "err"); }
}
$("#dashBody").addEventListener("click", e => {
  const b = e.target.closest("[data-go],[data-new]"); if (!b) return;
  const { go, open, new: nw } = b.dataset;
  if (nw) { selectTab(nw); openForm(null); } else { selectTab(go); if (open) openView(open); }
});

/* ---------- live refresh ---------- */
let liveTimer;
async function refresh(silent) {
  if (st.busy || !st.token) return; st.busy = true; $("#refreshBtn").classList.add("spin");
  try { if (st.view === "dashboard") await loadDash(true); else if (isList()) await load(true); }
  finally { st.busy = false; $("#refreshBtn").classList.remove("spin"); }
}
function schedule() {
  clearTimeout(liveTimer); if (!st.token) return;
  liveTimer = setTimeout(async () => { if (st.every && !document.hidden && !document.querySelector("dialog[open]")) await refresh(true); schedule(); }, st.every || 3000);
}
$("#every").value = st.every; if ($("#every").value !== String(st.every)) $("#every").value = "10000";
$("#every").onchange = () => { st.every = +$("#every").value; savePrefs(); setLive(true); schedule(); };
$("#refreshBtn").onclick = async () => { await refresh(); toast("Refreshed"); };
document.addEventListener("visibilitychange", () => { if (!document.hidden && st.token && st.every) refresh(true); });

/* ---------- keyboard shortcuts ---------- */
$("#helpBtn").onclick = () => $("#help").showModal();
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || !st.token) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) { if (e.key === "Escape") e.target.blur(); return; }
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "Escape") closeDrawer();
  else if (e.key === "/" && isList()) { e.preventDefault(); $("#q").focus(); }
  else if (e.key === "n" && isList()) openForm(null);
  else if (e.key === "r") refresh().then(() => toast("Refreshed"));
  else if (e.key === "?") $("#help").showModal();
  else if (/^[1-8]$/.test(e.key)) selectTab(KEYS[+e.key - 1]);
});

const J = o => esc(JSON.stringify(o, null, 2));
const withLines = (r, s) => r.lines ? { ...s, lines: r.lines.sample } : s;
function full(r, withL = true) {
  const o = { ...r.sample, ...(r.audit || {}) };
  if (r.lines && withL) o.lines = r.lines.sample.map(l => ({ ...l, [r.pk]: r.sample[r.pk] }));
  if (r.lines && !withL) o.line_count = r.lines.sample.length;
  return o;
}
function endpoints(r) {
  const f = r.filters.concat(r.status ? ["status"] : []).map(x => `${x}=…`);
  const q = "?q=text&" + (f.length ? f.join("&") + "&" : "") + "page=1&limit=20";
  const okRow = withLines(r, r.sample), bad = { [r.pk]: r.sample[r.pk] + 1 }, sing = r.one;
  return [
    { m: "GET", p: r.api, d: `List ${r.title.toLowerCase()}`, q, res: { success: true, total: 1, page: 1, limit: 20, data: [full(r, false)] } },
    { m: "GET", p: r.api + "/{id}", d: `Get one ${sing} by ${r.pk}` + (r.lines ? " with its lines" : ""), res: { success: true, data: full(r) } },
    { m: "POST", p: r.api, d: `Store a ${sing}`, req: okRow, res: { success: true, data: full(r) }, code: "201 Created", note: "Stores exactly what you send. " + (r.note || "") + ` Required: ${[...Object.keys(r.sample).filter(k => r.fields.find(f => f.n === k && f.req))].join(", ")}. A duplicate key returns 409.` },
    { m: "POST", p: r.api + "/bulk", d: `Store many ${r.title.toLowerCase()} (data dump)`, req: [okRow, bad], note: "Valid records are saved; invalid ones are reported in failed[] with their position in your array.",
      res: { success: false, created_count: 1, failed_count: 1, created: [full(r)], failed: [{ index: 1, error: { [r.num]: `${r.num} is required` } }] }, code: "201 Created (422 if every record fails)" },
    { m: "PUT", p: r.api + "/{id}", d: `Update a ${sing}`, req: r.put, note: `Send only the fields to change. ${r.pk} cannot be changed.` + (r.lines ? " Include lines to replace all existing lines." : ""), res: { success: true, data: { ...full(r), ...r.put } } },
    { m: "DELETE", p: r.api + "/{id}", d: `Delete a ${sing}` + (r.lines ? " and its lines" : ""), res: { success: true, message: "Record 1 deleted" } }
  ];
}

function ep(e, base) {
  const url = base + e.p.replace("{id}", "1") + (e.q || "");
  const auth = ` \\\n  -u "USERNAME:PASSWORD"`;
  const body = e.req ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(e.req)}'` : "";
  const errEx = e.m === "GET" || e.m === "DELETE" ? { success: false, error: "Record not found" } : { success: false, error: "Validation failed", details: { [e.num || "field"]: "… is required" } };
  return `<details class="ep"><summary><span class="m ${e.m}">${e.m}</span><span class="path">${esc(e.p)}</span><span class="desc">${esc(e.d)}</span></summary><div class="body">
    ${e.note ? `<p class="muted" style="margin:0">${esc(e.note)}</p>` : ""}
    ${e.q ? `<div><h4>Query parameters <button class="mini" data-copy>Copy</button></h4><pre>${esc(e.q)}</pre></div>` : ""}
    <div><h4>Request body ${e.req ? '<button class="mini" data-copy>Copy</button>' : ""}</h4><pre>${e.req ? J(e.req) : "(none)"}</pre></div>
    <div><h4>Response ${esc(e.code || "200 OK")} <button class="mini" data-copy>Copy</button></h4><pre>${J(e.res)}</pre></div>
    <div><h4>Error response (example) <button class="mini" data-copy>Copy</button></h4><pre>${J(errEx)}</pre></div>
    <div><h4>curl <button class="mini" data-copy>Copy</button></h4><pre>${esc(`curl -X ${e.m} "${url}"${auth}${body}`)}</pre></div></div></details>`;
}
function renderDocs() {
  const base = location.origin; $("#baseUrl").textContent = base;
  $("#docs").innerHTML = `<p class="muted">POST and PUT store exactly what you send. Ids, numbers, line numbers, totals and quantities are never generated. Only created_by / creation_date / last_updated_by / last_update_date are filled in when you leave them out.</p>` +
    RES.map(r => `<h3 class="group">${r.title}</h3>${endpoints(r).map(e => ep(e, base)).join("")}`).join("");
}
$("#copyBase").onclick = () => copyText(location.origin);
$("#docs").addEventListener("click", e => { const b = e.target.closest("[data-copy]"); if (b) { e.preventDefault(); copyText(b.closest("div").querySelector("pre").textContent); const t = b.textContent; b.textContent = "Copied"; setTimeout(() => b.textContent = t, 1200); } });
$("#docQ").oninput = () => {
  const q = $("#docQ").value.toLowerCase().trim(); let grp = null, any = false;
  for (const el of $("#docs").children) {
    if (el.matches("h3")) { if (grp) grp.hidden = !any; grp = el; any = false; }
    else if (el.matches("details")) { const m = !q || el.textContent.toLowerCase().includes(q); el.hidden = !m; any ||= m; }
  }
  if (grp) grp.hidden = !any;
};
document.querySelector("#tab-api").addEventListener("click", e => { const b = e.target.closest("[data-exp]"); if (b) $("#docs").querySelectorAll("details").forEach(d => d.open = b.dataset.exp === "1"); });

/* ---------- start ---------- */
applyTheme(localStorage.getItem("wms_theme") || "auto");
renderDocs();
if (st.token) showApp();
