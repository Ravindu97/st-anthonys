/**
 * Post-import reorder scan — mirrors apps/erp syncPurchaseSuggestions for CLI use.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} [companyId]
 */
export async function syncPurchaseSuggestionsAfterImport(db, companyId) {
  const client = 'connect' in db ? await db.connect() : db;
  const release = 'connect' in db;

  function computeSuggestedQty(currentQty, reorderQty) {
    const gap = Math.max(0, reorderQty - currentQty);
    return gap > 0 ? gap : reorderQty;
  }

  const companyFilter = companyId ? 'AND c.id = $1' : '';
  const params = companyId ? [companyId] : [];

  const cte = `
    WITH latest AS (
      SELECT DISTINCT ON (inv.location_id)
        inv.id AS snapshot_id,
        inv.location_id,
        inv.created_at AS snapshot_imported_at,
        loc.company_id,
        loc.name AS location_name,
        loc.location_type,
        cat.id AS category_id,
        cat.code AS category_code,
        cat.name AS category_name,
        LOWER(cat.code) AS vendor_slug
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      JOIN stock_categories cat ON cat.id = loc.stock_category_id
      JOIN companies c ON c.id = loc.company_id
      WHERE loc.location_type = 'main' ${companyFilter}
      ORDER BY inv.location_id, inv.created_at DESC
    ),
    balances AS (
      SELECT
        l.company_id,
        l.location_id,
        l.snapshot_imported_at,
        ib.stock_item_id,
        COALESCE(ib.quantity, 0) AS current_qty,
        ib.rate,
        rr.id AS reorder_rule_id,
        COALESCE(rr.min_qty, rcd.default_min_qty) AS effective_min_qty,
        COALESCE(rr.reorder_qty, rcd.default_reorder_qty) AS effective_reorder_qty,
        (rr.id IS NOT NULL) AS has_rule,
        (rcd.id IS NOT NULL) AS has_category_default
      FROM latest l
      JOIN inventory_balances ib ON ib.snapshot_id = l.snapshot_id
      LEFT JOIN reorder_rules rr
        ON rr.stock_item_id = ib.stock_item_id
        AND rr.location_id = l.location_id
        AND rr.is_active = true
      LEFT JOIN reorder_category_defaults rcd
        ON rcd.category_id = l.category_id
        AND rcd.location_type = l.location_type
    )
  `;

  try {
    await client.query('BEGIN');

    const { rows: belowReorder } = await client.query(
      `
      ${cte}
      SELECT *
      FROM balances b
      WHERE b.effective_min_qty IS NOT NULL
        AND b.current_qty < b.effective_min_qty
        AND (b.has_rule OR b.has_category_default)
      `,
      params
    );

    let created = 0;
    let updated = 0;
    let cancelled = 0;

    for (const row of belowReorder) {
      const currentQty = Number(row.current_qty);
      const minQty = Number(row.effective_min_qty);
      const reorderQty = Number(row.effective_reorder_qty);
      const suggestedQty = computeSuggestedQty(currentQty, reorderQty);
      const rate = row.rate != null ? Number(row.rate) : null;
      const estimatedValue = suggestedQty * (rate ?? 0);

      const { rows: existing } = await client.query(
        `SELECT id, status FROM purchase_suggestions
         WHERE stock_item_id = $1 AND location_id = $2
           AND status IN ('draft', 'approved')
         LIMIT 1`,
        [row.stock_item_id, row.location_id]
      );

      if (existing.length > 0) {
        if (existing[0].status === 'draft') {
          await client.query(
            `UPDATE purchase_suggestions SET
               current_qty = $2, min_qty = $3, suggested_qty = $4,
               rate_at_scan = $5, estimated_value = $6,
               snapshot_imported_at = $7, updated_at = now()
             WHERE id = $1`,
            [
              existing[0].id,
              currentQty,
              minQty,
              suggestedQty,
              rate,
              estimatedValue,
              row.snapshot_imported_at,
            ]
          );
          updated++;
        }
        continue;
      }

      await client.query(
        `INSERT INTO purchase_suggestions (
           company_id, stock_item_id, location_id, reorder_rule_id,
           current_qty, min_qty, suggested_qty, status,
           rate_at_scan, estimated_value, snapshot_imported_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10)`,
        [
          row.company_id,
          row.stock_item_id,
          row.location_id,
          row.reorder_rule_id,
          currentQty,
          minQty,
          suggestedQty,
          rate,
          estimatedValue,
          row.snapshot_imported_at,
        ]
      );
      created++;
    }

    const { rows: recovered } = await client.query(
      `
      ${cte}
      SELECT ps.id
      FROM purchase_suggestions ps
      JOIN balances b
        ON b.stock_item_id = ps.stock_item_id AND b.location_id = ps.location_id
      WHERE ps.status = 'draft'
        ${companyId ? 'AND ps.company_id = $1' : ''}
        AND b.effective_min_qty IS NOT NULL
        AND b.current_qty >= b.effective_min_qty
      `,
      params
    );

    for (const r of recovered) {
      await client.query(
        `UPDATE purchase_suggestions SET status = 'cancelled',
           dismissed_note = 'Stock recovered above min', updated_at = now()
         WHERE id = $1`,
        [r.id]
      );
      cancelled++;
    }

    if (companyId) {
      await client.query(
        `INSERT INTO reorder_scan_runs (
           company_id, items_below_min, suggestions_created, suggestions_updated, suggestions_cancelled
         ) VALUES ($1, $2, $3, $4, $5)`,
        [companyId, belowReorder.length, created, updated, cancelled]
      );
    }

    await client.query('COMMIT');
    return { created, updated, cancelled, scanned: belowReorder.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    if (release) client.release();
  }
}
