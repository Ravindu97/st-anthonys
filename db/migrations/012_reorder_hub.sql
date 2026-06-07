-- Reorder Hub: snapshot context, category defaults, scan audit

ALTER TABLE purchase_suggestions
  ADD COLUMN IF NOT EXISTS rate_at_scan NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS snapshot_imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_adjusted_qty NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS dismissed_note TEXT;

CREATE TABLE IF NOT EXISTS reorder_category_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES stock_categories (id) ON DELETE CASCADE,
  location_type location_type NOT NULL DEFAULT 'main',
  default_min_qty NUMERIC(18, 4) NOT NULL,
  default_reorder_qty NUMERIC(18, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, location_type),
  CONSTRAINT reorder_category_defaults_min_check CHECK (default_min_qty >= 0),
  CONSTRAINT reorder_category_defaults_reorder_check CHECK (default_reorder_qty > 0)
);

CREATE TABLE IF NOT EXISTS reorder_scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  items_below_min INT NOT NULL DEFAULT 0,
  suggestions_created INT NOT NULL DEFAULT 0,
  suggestions_updated INT NOT NULL DEFAULT 0,
  suggestions_cancelled INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_reorder_scan_runs_company ON reorder_scan_runs (company_id, scanned_at DESC);

-- Seed category defaults for active import vendors
INSERT INTO reorder_category_defaults (category_id, location_type, default_min_qty, default_reorder_qty)
SELECT cat.id, 'main'::location_type, 5, 20
FROM stock_categories cat
WHERE cat.code IN ('ORANGE', 'SWISSTEK')
ON CONFLICT (category_id, location_type) DO NOTHING;
