# Warehouse Manager
Sections: Dashboard · Warehouses · Suppliers · Items · Inventory · Purchase Orders · Sales Orders · API Reference

    pip install -r requirements.txt
    python app.py

Env vars: WMS_USER, WMS_PASS, WMS_DB (sqlite path).
There is no login API / token. Every REST call uses HTTP Basic auth (username + password), e.g. `curl -u admin:admin123 http://127.0.0.1:5000/api/items`.
Send header `X-Created-By: OIC` on API calls to stamp created_by / last_updated_by.

Note: POST stores exactly what is sent; all ids/keys come from the caller. 

Files: app.py (auth), wms_api.py (suppliers, items, inventory, POs, SOs), schema.sql, static/ (UI).
Tables follow your WMS_* spec (Oracle types mapped to SQLite). Swap SQLite for Oracle by changing the db() helper and DDL types.

## UI features (API logic unchanged)
- Live mode: tables and dashboard auto-refresh (5s / 10s / 30s / paused); changed rows flash; the status badge shows Live / Paused / Offline.
- Dashboard: KPI cards, PO and SO status breakdown, latest orders, quick-add buttons.
- Table controls: search, status chips, sortable columns, rows per page, row checkboxes, bulk delete, CSV export (all matches or selected).
- Row actions: View (details drawer with lines and raw JSON), Edit, Delete (confirm dialog), change status straight from the status pill.
- Forms: Fill sample button and line-item editor; Import JSON from paste, file or sample.
- Theme: Auto / Light / Dark (remembered). Responsive, with a slide-out menu on mobile.
- Shortcuts: `/` search, `n` new, `r` refresh, `1`-`8` switch section, `?` help, `Esc` close.

## Relations (warehouse → item → inventory)
- `wms_warehouses` (Fusion `ORGANIZATION_ID` = `warehouse_id`) → `/api/warehouses`.
- `wms_item_master`: one row per item per warehouse. `warehouse_id` → warehouses, `inventory_item_id` = Fusion `INVENTORY_ITEM_ID`. Unique on (warehouse_id, inventory_item_id) and (warehouse_id, item_number).
- `wms_inventory_balances`: `warehouse_id` → warehouses, `item_id` → item row of that same warehouse (item_number / inventory_item_id are checked against it).
- Missing parent → 422; item in another warehouse → 422; deleting a warehouse/item that is still referenced → 409. Load order: warehouses, then items, then inventory.
- Existing wms.db files must be deleted (columns and unique keys changed).
