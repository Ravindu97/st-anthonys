-- Phase 5: analytics views and delivery scheduling

CREATE TYPE delivery_status AS ENUM (
  'scheduled',
  'in_transit',
  'delivered',
  'cancelled'
);

CREATE TABLE delivery_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  sales_document_id UUID NOT NULL REFERENCES sales_documents (id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  driver_name TEXT,
  vehicle_ref TEXT,
  status delivery_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock velocity: movements in last 90 days per item/location
CREATE VIEW v_stock_velocity AS
SELECT
  sm.stock_item_id,
  sm.location_id,
  COUNT(*)::int AS movement_count,
  COALESCE(SUM(ABS(sm.quantity_delta)), 0) AS total_qty_moved,
  MAX(sm.created_at) AS last_movement_at
FROM stock_movements sm
WHERE sm.created_at >= now() - interval '90 days'
GROUP BY sm.stock_item_id, sm.location_id;

-- Dead stock: items with qty > 0 but no movement in 60 days
CREATE VIEW v_dead_stock AS
WITH latest_bal AS (
  SELECT DISTINCT ON (ib.stock_item_id, inv.location_id)
    ib.stock_item_id,
    inv.location_id,
    ib.quantity,
    ib.value,
    ib.rate
  FROM inventory_balances ib
  JOIN inventory_snapshots inv ON inv.id = ib.snapshot_id
  ORDER BY ib.stock_item_id, inv.location_id, inv.created_at DESC
)
SELECT
  lb.stock_item_id,
  lb.location_id,
  lb.quantity,
  lb.value,
  lb.rate,
  sv.last_movement_at,
  EXTRACT(DAY FROM now() - COALESCE(sv.last_movement_at, '1970-01-01'::timestamptz))::int AS days_since_movement
FROM latest_bal lb
LEFT JOIN v_stock_velocity sv
  ON sv.stock_item_id = lb.stock_item_id AND sv.location_id = lb.location_id
WHERE COALESCE(lb.quantity, 0) > 0
  AND (sv.last_movement_at IS NULL OR sv.last_movement_at < now() - interval '60 days');

-- Margin estimate per SKU from latest balance rate vs avg sell rate
CREATE VIEW v_margin_by_sku AS
WITH latest_bal AS (
  SELECT DISTINCT ON (ib.stock_item_id)
    ib.stock_item_id,
    ib.rate AS cost_rate,
    ib.quantity,
    ib.value
  FROM inventory_balances ib
  JOIN inventory_snapshots inv ON inv.id = ib.snapshot_id
  ORDER BY ib.stock_item_id, inv.created_at DESC
),
sell_rates AS (
  SELECT
    sdl.stock_item_id,
    AVG(sdl.unit_rate) AS avg_sell_rate,
    COUNT(*)::int AS sale_line_count
  FROM sales_document_lines sdl
  JOIN sales_documents sd ON sd.id = sdl.document_id
  WHERE sd.doc_kind = 'order'
    AND sd.status NOT IN ('draft', 'cancelled')
  GROUP BY sdl.stock_item_id
)
SELECT
  si.id AS stock_item_id,
  si.name AS item_name,
  cat.name AS category_name,
  lb.cost_rate,
  sr.avg_sell_rate,
  sr.sale_line_count,
  CASE
    WHEN lb.cost_rate IS NOT NULL AND sr.avg_sell_rate IS NOT NULL AND lb.cost_rate > 0
    THEN ROUND(((sr.avg_sell_rate - lb.cost_rate) / lb.cost_rate) * 100, 2)
    ELSE NULL
  END AS margin_pct,
  lb.quantity,
  lb.value
FROM stock_items si
JOIN stock_categories cat ON cat.id = si.category_id
LEFT JOIN latest_bal lb ON lb.stock_item_id = si.id
LEFT JOIN sell_rates sr ON sr.stock_item_id = si.id;
