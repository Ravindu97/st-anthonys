-- Phase 1: reorder rules, purchase suggestions, stock movement ledger

CREATE TYPE stock_movement_type AS ENUM (
  'adjustment',
  'import',
  'sale',
  'purchase_receipt',
  'transfer'
);

CREATE TYPE purchase_suggestion_status AS ENUM (
  'draft',
  'approved',
  'converted',
  'cancelled'
);

CREATE TABLE reorder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  min_qty NUMERIC(18, 4) NOT NULL DEFAULT 10,
  reorder_qty NUMERIC(18, 4) NOT NULL DEFAULT 10,
  lead_time_days INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stock_item_id, location_id),
  CONSTRAINT reorder_rules_min_qty_check CHECK (min_qty >= 0),
  CONSTRAINT reorder_rules_reorder_qty_check CHECK (reorder_qty > 0)
);

CREATE INDEX idx_reorder_rules_location ON reorder_rules (location_id);

CREATE TABLE purchase_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  reorder_rule_id UUID REFERENCES reorder_rules (id) ON DELETE SET NULL,
  current_qty NUMERIC(18, 4) NOT NULL,
  min_qty NUMERIC(18, 4) NOT NULL,
  suggested_qty NUMERIC(18, 4) NOT NULL,
  status purchase_suggestion_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES app_users (id) ON DELETE SET NULL
);

CREATE INDEX idx_purchase_suggestions_status ON purchase_suggestions (status, created_at DESC);
CREATE INDEX idx_purchase_suggestions_item ON purchase_suggestions (stock_item_id, location_id);

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE CASCADE,
  movement_type stock_movement_type NOT NULL,
  quantity_delta NUMERIC(18, 4) NOT NULL,
  rate NUMERIC(18, 2),
  value_delta NUMERIC(18, 2),
  reference_type TEXT,
  reference_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_item ON stock_movements (stock_item_id, created_at DESC);
CREATE INDEX idx_stock_movements_location ON stock_movements (location_id, created_at DESC);
