"""One-off: copy an existing SQLite wms.db into MongoDB.
Usage: python migrate_sqlite_to_mongo.py path/to/wms.db   (uses WMS_MONGO_URI / WMS_DB like the app)"""
import sqlite3, sys
from app import db, init_db

TABLES = ["wms_warehouses", "wms_suppliers", "wms_item_master", "wms_inventory_balances",
          "wms_po_header", "wms_po_lines", "wms_so_header", "wms_so_lines"]
init_db()
src = sqlite3.connect(sys.argv[1]); src.row_factory = sqlite3.Row
for t in TABLES:
    rows = [dict(r) for r in src.execute(f"SELECT * FROM {t}")]
    if rows:
        db()[t].insert_many(rows)
    print(f"{t}: {len(rows)} rows")
