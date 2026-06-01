-- SWISSTEK Tally location names (report uses "SWISSTEK", not "SWISSTEK MAIN LOCATION")
INSERT INTO locations (company_id, stock_category_id, name, tally_name, location_type)
SELECT c.id, cat.id, 'SWISSTEK', 'SWISSTEK', 'main'
FROM companies c
JOIN stock_categories cat ON cat.company_id = c.id AND cat.code = 'SWISSTEK'
WHERE c.tally_company_name = 'ST. Anthonys Distributor (2024 -2025)'
ON CONFLICT (company_id, tally_name) DO NOTHING;

INSERT INTO locations (company_id, stock_category_id, name, tally_name, location_type)
SELECT c.id, cat.id, 'DAMAGE GOODS - SWISSTEK', 'DAMAGE GOODS - SWISSTEK', 'damage'
FROM companies c
JOIN stock_categories cat ON cat.company_id = c.id AND cat.code = 'SWISSTEK'
WHERE c.tally_company_name = 'ST. Anthonys Distributor (2024 -2025)'
ON CONFLICT (company_id, tally_name) DO NOTHING;
