-- Default ERP masters: price levels, POS register, sample supplier

INSERT INTO price_levels (company_id, name)
SELECT c.id, v.name
FROM companies c
CROSS JOIN (VALUES ('Retail'), ('Contractor'), ('Builder')) AS v(name)
WHERE c.tally_company_name = 'ST. Anthonys Distributor (2024 -2025)'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO pos_registers (company_id, name, location_id, price_level_id)
SELECT
  c.id,
  'Main Counter',
  loc.id,
  pl.id
FROM companies c
JOIN stock_categories cat ON cat.company_id = c.id AND cat.code = 'ORANGE'
JOIN locations loc ON loc.stock_category_id = cat.id AND loc.location_type = 'main'
JOIN price_levels pl ON pl.company_id = c.id AND pl.name = 'Retail'
WHERE c.tally_company_name = 'ST. Anthonys Distributor (2024 -2025)'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO suppliers (company_id, code, name, payment_terms_days)
SELECT c.id, 'GEN-SUP', 'General Supplier', 30
FROM companies c
WHERE c.tally_company_name = 'ST. Anthonys Distributor (2024 -2025)'
ON CONFLICT (company_id, code) DO NOTHING;
