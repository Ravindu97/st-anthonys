/**
 * Import Tally-style price list CSV into price_lists / price_list_tiers.
 *
 * Expected columns: sku (or unit code), item_name (optional), from_qty, rate, discount_pct (optional)
 */

import { getPool } from '../../scripts/lib/db.js';

/**
 * @param {object} opts
 * @param {string} opts.csvPath
 * @param {string} opts.companyId
 * @param {string} opts.priceLevelName
 * @param {string} opts.categoryCode - scope category for the price list
 * @param {string} [opts.applicableFrom] - YYYY-MM-DD
 * @param {boolean} [opts.dryRun]
 */
export async function importPriceListCsv(opts) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const content = fs.readFileSync(path.resolve(opts.csvPath), 'utf8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const skuIdx = header.findIndex((h) => ['sku', 'unit_code', 'alias', 'code'].includes(h));
  const fromQtyIdx = header.findIndex((h) => ['from_qty', 'fromqty', 'min_qty'].includes(h));
  const rateIdx = header.findIndex((h) => ['rate', 'price', 'selling_rate'].includes(h));
  const discountIdx = header.findIndex((h) => ['discount_pct', 'discount', 'discount%'].includes(h));

  if (skuIdx < 0 || rateIdx < 0) {
    throw new Error('CSV must include sku/unit_code and rate columns');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: catRows } = await client.query(
      `SELECT id FROM stock_categories WHERE company_id = $1 AND code = $2`,
      [opts.companyId, opts.categoryCode]
    );
    if (catRows.length === 0) throw new Error(`Category not found: ${opts.categoryCode}`);

    const { rows: plRows } = await client.query(
      `SELECT id FROM price_levels WHERE company_id = $1 AND name = $2`,
      [opts.companyId, opts.priceLevelName]
    );
    if (plRows.length === 0) throw new Error(`Price level not found: ${opts.priceLevelName}`);
    const priceLevelId = plRows[0].id;
    const categoryId = catRows[0].id;
    const applicableFrom = opts.applicableFrom ?? new Date().toISOString().slice(0, 10);

    const { rows: listRows } = await client.query(
      `INSERT INTO price_lists (
         company_id, price_level_id, scope_type, scope_category_id, applicable_from
       ) VALUES ($1, $2, 'category', $3, $4)
       RETURNING id`,
      [opts.companyId, priceLevelId, categoryId, applicableFrom]
    );
    const priceListId = listRows[0].id;

    let imported = 0;
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const sku = cols[skuIdx]?.trim();
      const rate = parseFloat(cols[rateIdx]);
      const fromQty = fromQtyIdx >= 0 ? parseFloat(cols[fromQtyIdx]) || 0 : 0;
      const discount = discountIdx >= 0 ? parseFloat(cols[discountIdx]) || 0 : 0;

      if (!sku || Number.isNaN(rate)) {
        errors.push({ line: i + 1, error: 'Missing sku or rate' });
        continue;
      }

      const { rows: items } = await client.query(
        `SELECT si.id FROM stock_items si
         JOIN stock_item_aliases sia ON sia.item_id = si.id
         WHERE sia.alias = $1 AND si.category_id = $2
         LIMIT 1`,
        [sku, categoryId]
      );
      if (items.length === 0) {
        errors.push({ line: i + 1, sku, error: 'Item not found' });
        continue;
      }

      const { rows: pli } = await client.query(
        `INSERT INTO price_list_items (price_list_id, stock_item_id)
         VALUES ($1, $2)
         ON CONFLICT (price_list_id, stock_item_id) DO UPDATE SET price_list_id = EXCLUDED.price_list_id
         RETURNING id`,
        [priceListId, items[0].id]
      );

      await client.query(
        `INSERT INTO price_list_tiers (price_list_item_id, from_qty, rate, discount_pct)
         VALUES ($1, $2, $3, $4)`,
        [pli[0].id, fromQty, rate, discount]
      );
      imported++;
    }

    if (opts.dryRun) {
      await client.query('ROLLBACK');
      return { imported, errors, dryRun: true, priceListId: null };
    }

    await client.query('COMMIT');
    return { imported, errors, dryRun: false, priceListId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((s) => s.replace(/^"|"$/g, '').trim());
}
