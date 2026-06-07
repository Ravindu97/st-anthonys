-- Vendor-aligned suppliers for PO auto-matching (ORANGE, SWISSTEK, etc.)

INSERT INTO suppliers (company_id, code, name, payment_terms_days)
SELECT c.id, cat.code, cat.name || ' — Principal', 60
FROM companies c
JOIN stock_categories cat ON cat.company_id = c.id
WHERE cat.code IN ('ORANGE', 'SWISSTEK')
ON CONFLICT (company_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  payment_terms_days = EXCLUDED.payment_terms_days,
  updated_at = now();
