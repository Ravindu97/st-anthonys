-- Seed Tally-aligned masters for ST. Anthonys Distributor

INSERT INTO companies (id, name, tally_company_name)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'ST. Anthonys Distributor',
  'ST. Anthonys Distributor (2024 -2025)'
)
ON CONFLICT (tally_company_name) DO NOTHING;

INSERT INTO company_periods (company_id, label, starts_on, ends_on)
SELECT
  c.id,
  'FY 2026',
  '2026-01-01'::date,
  '2026-12-31'::date
FROM companies c
WHERE c.tally_company_name = 'ST. Anthonys Distributor (2024 -2025)'
ON CONFLICT (company_id, starts_on, ends_on) DO NOTHING;

INSERT INTO units (code, name, decimals) VALUES
  ('BAR', 'Bar', 0),
  ('INCH', 'Inch', 2),
  ('KG', 'Kilogram', 3),
  ('LENTH', 'Length', 2),
  ('MTR', 'Meter', 2),
  ('NOS', 'Numbers', 0),
  ('ROLL', 'Roll', 0),
  ('TON', 'Ton', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO stock_categories (company_id, code, name, tally_name)
SELECT c.id, v.code, v.name, v.name
FROM companies c
CROSS JOIN (VALUES
  ('ALKATHENE_PIPE', 'ALKATHENE PIPE'),
  ('ANTON', 'ANTON'),
  ('EL_TORO', 'EL-TORO'),
  ('GTB_STEEL', 'GTB STEEL'),
  ('HCL_BRUSHES', 'HCL BRUSHES'),
  ('JL_ROOFING', 'JL ROOFING'),
  ('LANWA_CEMENT', 'LANWA CEMENT'),
  ('LANWA_STEEL', 'LANWA STEEL'),
  ('LAUGFS', 'LAUGFS'),
  ('MELWA_STEEL', 'MELWA STEEL'),
  ('NIPPON', 'NIPPON'),
  ('ORANGE', 'ORANGE'),
  ('OTHERS', 'OTHERS'),
  ('PLYWOOD_SHEET', 'PLYWOOD SHEET'),
  ('SR_STEEL', 'SR STEEL'),
  ('SWISSTEK', 'SWISSTEK'),
  ('THINNER', 'THINNER'),
  ('ULTRATECH_CEMENT', 'ULTRATECH CEMENT'),
  ('WATERTEC', 'WATERTEC')
) AS v(code, name)
WHERE c.tally_company_name = 'ST. Anthonys Distributor (2024 -2025)'
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO price_levels (company_id, name)
SELECT c.id, 'Wholesale'
FROM companies c
WHERE c.tally_company_name = 'ST. Anthonys Distributor (2024 -2025)'
ON CONFLICT (company_id, name) DO NOTHING;

-- ORANGE locations (from Tally location master)
INSERT INTO locations (company_id, stock_category_id, name, tally_name, location_type)
SELECT
  c.id,
  cat.id,
  v.name,
  v.tally_name,
  v.location_type::location_type
FROM companies c
JOIN stock_categories cat ON cat.company_id = c.id AND cat.code = 'ORANGE'
CROSS JOIN (VALUES
  ('ORANGE MAIN LOCATION', 'ORANGE MAIN LOCATION', 'main'),
  ('DAMAGE GOODS - ORANGE', 'DAMAGE GOODS - ORANGE', 'damage'),
  ('DAMAGE ORANGE LOC - 01', 'DAMAGE ORANGE LOC - 01', 'damage'),
  ('DAMAGE ORANGE LOC - 02', 'DAMAGE ORANGE LOC - 02', 'damage'),
  ('DAMAGE ORANGE LOC - 03', 'DAMAGE ORANGE LOC - 03', 'damage'),
  ('ORANGE LOC-01', 'ORANGE LOC-01', 'other'),
  ('ORANGE LOC-01 LORRY', 'ORANGE LOC-01 LORRY', 'lorry'),
  ('ORANGE LOC-02', 'ORANGE LOC-02', 'other')
) AS v(name, tally_name, location_type)
WHERE c.tally_company_name = 'ST. Anthonys Distributor (2024 -2025)'
ON CONFLICT (company_id, tally_name) DO NOTHING;

-- Placeholder locations for other categories (import-ready)
INSERT INTO locations (company_id, stock_category_id, name, tally_name, location_type)
SELECT c.id, cat.id, cat.name || ' MAIN LOCATION', cat.name || ' MAIN LOCATION', 'main'
FROM companies c
JOIN stock_categories cat ON cat.company_id = c.id AND cat.code <> 'ORANGE'
WHERE c.tally_company_name = 'ST. Anthonys Distributor (2024 -2025)'
ON CONFLICT (company_id, tally_name) DO NOTHING;
