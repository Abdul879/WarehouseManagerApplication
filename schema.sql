-- All keys/ids are supplied by the caller (Oracle Fusion / OIC). The API stores what it receives; nothing is generated.
-- Oracle types mapped to SQLite: NUMBER->INTEGER/REAL, VARCHAR2/DATE/TIMESTAMP->TEXT.

CREATE TABLE IF NOT EXISTS wms_suppliers (          -- master + address in one table / one API
  supplier_id INTEGER PRIMARY KEY, supplier_number TEXT NOT NULL UNIQUE, fusion_vendor_id INTEGER,
  supplier_name TEXT, supplier_alt_name TEXT, supplier_status TEXT, supplier_type TEXT,
  primary_contact_name TEXT, contact_email TEXT, contact_phone TEXT, tax_registration_num TEXT,
  payment_terms_code TEXT, currency_code TEXT,
  supplier_site_code TEXT, address_line1 TEXT, address_line2 TEXT, city TEXT, state TEXT, zip_postal_code TEXT, country TEXT,
  created_by TEXT, creation_date TEXT, last_updated_by TEXT, last_update_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_sup_fusion ON wms_suppliers(fusion_vendor_id);

CREATE TABLE IF NOT EXISTS wms_warehouses (          -- Fusion inventory organization (INV_ORGANIZATION_DEFINITIONS_V + HZ_LOCATIONS)
  warehouse_id INTEGER PRIMARY KEY,                   -- ORGANIZATION_ID
  warehouse_code TEXT NOT NULL UNIQUE, warehouse_name TEXT, business_unit_id INTEGER, status TEXT,
  address_line1 TEXT, address_line2 TEXT, city TEXT, state TEXT, zip_postal_code TEXT, country TEXT,
  created_by TEXT, creation_date TEXT, last_updated_by TEXT, last_update_date TEXT
);

CREATE TABLE IF NOT EXISTS wms_item_master (
  item_id INTEGER PRIMARY KEY,                        -- row id of this item in this warehouse
  inventory_item_id INTEGER NOT NULL,                 -- Fusion INVENTORY_ITEM_ID (same for the item in every warehouse)
  warehouse_id INTEGER NOT NULL REFERENCES wms_warehouses(warehouse_id),   -- Fusion ORGANIZATION_ID
  item_number TEXT NOT NULL, item_name TEXT, description TEXT,
  primary_uom TEXT, secondary_uom TEXT, item_category TEXT, upc_barcode TEXT,
  unit_weight REAL, weight_uom TEXT, unit_volume REAL, is_lot_controlled TEXT, is_serial_controlled TEXT,
  min_stock_level REAL, max_stock_level REAL, item_status TEXT,
  created_by TEXT, creation_date TEXT, last_updated_by TEXT, last_update_date TEXT,
  UNIQUE (warehouse_id, inventory_item_id), UNIQUE (warehouse_id, item_number)
);
CREATE INDEX IF NOT EXISTS idx_item_upc ON wms_item_master(upc_barcode);
CREATE INDEX IF NOT EXISTS idx_item_wh ON wms_item_master(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_item_inv ON wms_item_master(inventory_item_id);

CREATE TABLE IF NOT EXISTS wms_inventory_balances (
  balance_id INTEGER PRIMARY KEY,                     -- ONHAND_QUANTITIES_ID
  warehouse_id INTEGER NOT NULL REFERENCES wms_warehouses(warehouse_id),   -- ORGANIZATION_ID
  item_id INTEGER NOT NULL REFERENCES wms_item_master(item_id),            -- link to the item row of this warehouse
  inventory_item_id INTEGER,                          -- Fusion INVENTORY_ITEM_ID (copy for easy joins back to Fusion)
  item_number TEXT NOT NULL,
  zone TEXT, aisle TEXT, shelf TEXT, bin TEXT,
  qty_on_hand REAL, qty_allocated REAL, qty_available REAL,
  lot_number TEXT, expiration_date TEXT, serial_number TEXT, last_counted_date TEXT,
  created_by TEXT, creation_date TEXT, last_updated_by TEXT, last_update_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_bal_item ON wms_inventory_balances(item_number);
CREATE INDEX IF NOT EXISTS idx_bal_wh ON wms_inventory_balances(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_bal_itemid ON wms_inventory_balances(item_id);

CREATE TABLE IF NOT EXISTS wms_po_header (
  po_header_id INTEGER PRIMARY KEY, po_number TEXT NOT NULL UNIQUE, fusion_header_id INTEGER,
  supplier_id TEXT, supplier_name TEXT, supplier_site TEXT, buyer_name TEXT,
  order_date TEXT, expected_delivery_date TEXT, payment_terms TEXT, currency_code TEXT,
  po_status TEXT, total_amount REAL, comments TEXT,
  created_by TEXT, creation_date TEXT, last_updated_by TEXT, last_update_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_po_fusion ON wms_po_header(fusion_header_id);

CREATE TABLE IF NOT EXISTS wms_po_lines (
  po_line_id INTEGER PRIMARY KEY,
  po_header_id INTEGER NOT NULL REFERENCES wms_po_header(po_header_id) ON DELETE CASCADE,
  line_number INTEGER, item_number TEXT, item_description TEXT, uom TEXT,
  qty_ordered REAL, qty_received REAL, qty_rejected REAL, unit_price REAL, line_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_pol_header ON wms_po_lines(po_header_id);

CREATE TABLE IF NOT EXISTS wms_so_header (
  so_header_id INTEGER PRIMARY KEY, so_number TEXT NOT NULL UNIQUE, fusion_so_header_id INTEGER,
  customer_id TEXT, customer_name TEXT,
  shipping_address_line1 TEXT, shipping_city TEXT, shipping_state TEXT, shipping_zip TEXT, shipping_country TEXT,
  carrier_code TEXT, shipping_method TEXT, order_date TEXT, required_ship_date TEXT, so_status TEXT,
  created_by TEXT, creation_date TEXT, last_updated_by TEXT, last_update_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_so_fusion ON wms_so_header(fusion_so_header_id);

CREATE TABLE IF NOT EXISTS wms_so_lines (
  so_line_id INTEGER PRIMARY KEY,
  so_header_id INTEGER NOT NULL REFERENCES wms_so_header(so_header_id) ON DELETE CASCADE,
  line_number INTEGER, item_number TEXT, uom TEXT,
  qty_requested REAL, qty_picked REAL, qty_shipped REAL, pick_zone_preference TEXT, line_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_sol_header ON wms_so_lines(so_header_id);
