-- St. Anthony's Inventory — initial schema (Tally Prime GOLD aligned)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE location_type AS ENUM ('main', 'damage', 'lorry', 'other');
CREATE TYPE price_list_scope_type AS ENUM ('category', 'group');
CREATE TYPE import_row_kind AS ENUM ('header', 'group', 'item', 'footer', 'skip');
CREATE TYPE import_run_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE import_source AS ENUM (
  'tally_location_summary_csv',
  'tally_location_summary_xlsx'
);
CREATE TYPE external_entity_type AS ENUM (
  'company',
  'stock_category',
  'stock_group',
  'stock_item',
  'location',
  'price_list'
);

-- Organization
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tally_company_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tally_company_name)
);

CREATE TABLE company_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, starts_on, ends_on)
);

-- Units
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  decimals SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock masters
CREATE TABLE stock_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  tally_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code),
  UNIQUE (company_id, name)
);

CREATE TABLE stock_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES stock_categories (id) ON DELETE CASCADE,
  parent_group_id UUID REFERENCES stock_groups (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  tally_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);

CREATE TABLE stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES stock_groups (id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES stock_categories (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  tally_name TEXT NOT NULL,
  base_unit_id UUID NOT NULL REFERENCES units (id),
  alt_unit_id UUID REFERENCES units (id),
  notes TEXT,
  duty_rate_pct NUMERIC(8, 4),
  allow_discount BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, tally_name)
);

CREATE TABLE stock_item_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, alias),
  UNIQUE (company_id, alias)
);

CREATE INDEX idx_stock_item_aliases_alias ON stock_item_aliases (alias);

-- Locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  stock_category_id UUID REFERENCES stock_categories (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  tally_name TEXT NOT NULL,
  location_type location_type NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, tally_name)
);

-- Pricing
CREATE TABLE price_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  price_level_id UUID NOT NULL REFERENCES price_levels (id) ON DELETE RESTRICT,
  scope_type price_list_scope_type NOT NULL,
  scope_category_id UUID REFERENCES stock_categories (id) ON DELETE CASCADE,
  scope_group_id UUID REFERENCES stock_groups (id) ON DELETE CASCADE,
  applicable_from DATE NOT NULL,
  tally_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT price_lists_scope_check CHECK (
    (scope_type = 'category' AND scope_category_id IS NOT NULL AND scope_group_id IS NULL)
    OR (scope_type = 'group' AND scope_group_id IS NOT NULL AND scope_category_id IS NULL)
  )
);

CREATE TABLE price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES price_lists (id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (price_list_id, stock_item_id)
);

CREATE TABLE price_list_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_item_id UUID NOT NULL REFERENCES price_list_items (id) ON DELETE CASCADE,
  from_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  less_than_qty NUMERIC(18, 4),
  rate NUMERIC(18, 2) NOT NULL,
  discount_pct NUMERIC(8, 4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT price_list_tiers_qty_check CHECK (
    less_than_qty IS NULL OR less_than_qty > from_qty
  )
);

-- Import pipeline
CREATE TABLE import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  source import_source NOT NULL,
  file_name TEXT,
  file_hash TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status import_run_status NOT NULL DEFAULT 'pending',
  row_counts JSONB DEFAULT '{}'::jsonb,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL REFERENCES import_runs (id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  raw_particulars TEXT NOT NULL,
  row_kind import_row_kind NOT NULL,
  resolved_group_id UUID REFERENCES stock_groups (id) ON DELETE SET NULL,
  resolved_item_id UUID REFERENCES stock_items (id) ON DELETE SET NULL,
  quantity NUMERIC(18, 4),
  rate NUMERIC(18, 2),
  value NUMERIC(18, 2),
  parse_errors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_run_id, line_no)
);

-- Inventory snapshots
CREATE TABLE inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL REFERENCES import_runs (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  period_starts_on DATE NOT NULL,
  period_ends_on DATE NOT NULL,
  report_label TEXT,
  file_hash TEXT,
  source import_source NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (
    company_id,
    location_id,
    period_starts_on,
    period_ends_on,
    source,
    file_hash
  )
);

CREATE TABLE inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES inventory_snapshots (id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE CASCADE,
  quantity NUMERIC(18, 4),
  rate NUMERIC(18, 2),
  value NUMERIC(18, 2),
  computed_value NUMERIC(18, 2) GENERATED ALWAYS AS (
    CASE
      WHEN quantity IS NOT NULL AND rate IS NOT NULL THEN quantity * rate
      ELSE NULL
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, stock_item_id)
);

-- Tally sync metadata
CREATE TABLE external_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type external_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  system TEXT NOT NULL DEFAULT 'tally',
  external_id TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, system)
);

CREATE TABLE item_location_stats (
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  last_snapshot_id UUID REFERENCES inventory_snapshots (id) ON DELETE SET NULL,
  last_qty NUMERIC(18, 4),
  last_rate NUMERIC(18, 2),
  last_value NUMERIC(18, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stock_item_id, location_id)
);

-- Group rollups per snapshot
CREATE VIEW v_group_balances AS
SELECT
  ib.snapshot_id,
  sg.id AS stock_group_id,
  sg.name AS group_name,
  sc.id AS category_id,
  sc.name AS category_name,
  SUM(ib.quantity) AS total_quantity,
  SUM(ib.value) AS total_value,
  COUNT(ib.id) AS item_count
FROM inventory_balances ib
JOIN stock_items si ON si.id = ib.stock_item_id
JOIN stock_groups sg ON sg.id = si.group_id
JOIN stock_categories sc ON sc.id = si.category_id
GROUP BY ib.snapshot_id, sg.id, sg.name, sc.id, sc.name;

-- UI-friendly location summary (leaf rows)
CREATE VIEW v_location_summary AS
SELECT
  inv.id AS snapshot_id,
  ib.id AS balance_id,
  loc.id AS location_id,
  loc.name AS location_name,
  sc.id AS category_id,
  sc.name AS category_name,
  sg.id AS stock_group_id,
  sg.name AS stock_group_name,
  si.id AS stock_item_id,
  si.name AS item_name,
  si.tally_name,
  primary_alias.alias AS primary_sku,
  u.code AS unit_code,
  ib.quantity,
  ib.rate,
  ib.value,
  ib.computed_value,
  (ib.value IS NOT NULL AND ib.computed_value IS NOT NULL AND ib.value <> ib.computed_value) AS value_variance
FROM inventory_balances ib
JOIN inventory_snapshots inv ON inv.id = ib.snapshot_id
JOIN locations loc ON loc.id = inv.location_id
JOIN stock_items si ON si.id = ib.stock_item_id
JOIN stock_groups sg ON sg.id = si.group_id
JOIN stock_categories sc ON sc.id = si.category_id
JOIN units u ON u.id = si.base_unit_id
LEFT JOIN LATERAL (
  SELECT alias
  FROM stock_item_aliases
  WHERE item_id = si.id AND is_primary = true
  LIMIT 1
) primary_alias ON true;
