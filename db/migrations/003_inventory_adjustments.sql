-- Manual balance adjustments (singular updates via API)

CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES inventory_snapshots (id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE CASCADE,
  quantity NUMERIC(18, 4),
  rate NUMERIC(18, 2),
  value NUMERIC(18, 2),
  previous_quantity NUMERIC(18, 4),
  previous_rate NUMERIC(18, 2),
  previous_value NUMERIC(18, 2),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_adjustments_item ON inventory_adjustments (stock_item_id, created_at DESC);
CREATE INDEX idx_inventory_adjustments_snapshot ON inventory_adjustments (snapshot_id);
