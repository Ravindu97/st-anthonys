-- Analytics v2: include POS sales in margin view

CREATE OR REPLACE VIEW v_margin_by_sku AS
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
    stock_item_id,
    AVG(unit_rate) AS avg_sell_rate,
    COUNT(*)::int AS sale_line_count
  FROM (
    SELECT sdl.stock_item_id, sdl.unit_rate
    FROM sales_document_lines sdl
    JOIN sales_documents sd ON sd.id = sdl.document_id
    WHERE sd.doc_kind = 'order'
      AND sd.status NOT IN ('draft', 'cancelled')
    UNION ALL
    SELECT ptl.stock_item_id, ptl.unit_rate
    FROM pos_transaction_lines ptl
    JOIN pos_transactions pt ON pt.id = ptl.transaction_id
  ) combined
  GROUP BY stock_item_id
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
