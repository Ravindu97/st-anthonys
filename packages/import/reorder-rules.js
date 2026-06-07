/**
 * Bulk import reorder rules from CSV.
 * Columns: sku, category_code, min_qty, reorder_qty, lead_time_days
 * @param {import('pg').PoolClient} client
 * @param {string} content
 */
export async function importReorderRulesCsv(client, content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) {
    throw new Error('CSV needs header + at least one row');
  }

  const parseLine = (line) =>
    line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const skuIdx = header.indexOf('sku');
  const catIdx = header.indexOf('category_code');
  const minIdx = header.indexOf('min_qty');
  const reorderIdx = header.indexOf('reorder_qty');
  const leadIdx = header.indexOf('lead_time_days');

  if (skuIdx < 0 || catIdx < 0 || minIdx < 0 || reorderIdx < 0) {
    throw new Error('Required columns: sku, category_code, min_qty, reorder_qty');
  }

  let imported = 0;
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const sku = cols[skuIdx];
    const categoryCode = cols[catIdx];
    const minQty = Number(cols[minIdx]);
    const reorderQty = Number(cols[reorderIdx]);
    const leadTime = leadIdx >= 0 ? Number(cols[leadIdx] ?? 0) : 0;

    if (!sku || !categoryCode || !Number.isFinite(minQty) || !Number.isFinite(reorderQty)) {
      errors.push(`Row ${i + 1}: invalid data`);
      continue;
    }

    const { rows: items } = await client.query(
      `SELECT si.id AS stock_item_id, loc.id AS location_id
       FROM stock_item_aliases a
       JOIN stock_items si ON si.id = a.item_id
       JOIN stock_categories cat ON cat.id = si.category_id
       JOIN locations loc ON loc.stock_category_id = cat.id AND loc.location_type = 'main'
       WHERE a.alias = $1 AND cat.code = $2
       LIMIT 1`,
      [sku, categoryCode]
    );

    if (items.length === 0) {
      errors.push(`Row ${i + 1}: SKU ${sku} not found for ${categoryCode}`);
      continue;
    }

    await client.query(
      `INSERT INTO reorder_rules (
         stock_item_id, location_id, min_qty, reorder_qty, lead_time_days
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (stock_item_id, location_id) DO UPDATE SET
         min_qty = EXCLUDED.min_qty,
         reorder_qty = EXCLUDED.reorder_qty,
         lead_time_days = EXCLUDED.lead_time_days,
         is_active = true,
         updated_at = now()`,
      [items[0].stock_item_id, items[0].location_id, minQty, reorderQty, leadTime]
    );
    imported++;
  }

  return { imported, errors };
}
