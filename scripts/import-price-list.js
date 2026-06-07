#!/usr/bin/env node
import { importPriceListCsv } from '../packages/import/price-list.js';
import { getPool } from './lib/db.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((a) => !a.startsWith('--'));

const csvPath = positional[0];
const priceLevelName = positional[1] ?? 'Retail';
const categoryCode = positional[2] ?? 'ORANGE';

if (!csvPath) {
  console.error(
    'Usage: npm run import:price-list -- [--dry-run] <csv> [priceLevel] [categoryCode]'
  );
  process.exit(1);
}

const pool = getPool();
try {
  const { rows } = await pool.query(
    `SELECT id FROM companies WHERE tally_company_name LIKE 'ST. Anthonys%' LIMIT 1`
  );
  if (rows.length === 0) {
    console.error('Company not found. Run db:seed first.');
    process.exit(1);
  }

  const result = await importPriceListCsv({
    csvPath,
    companyId: rows[0].id,
    priceLevelName,
    categoryCode,
    dryRun,
  });

  console.log(
    dryRun ? '[DRY RUN] ' : '',
    `Imported ${result.imported} price tiers into price list.`,
    result.errors.length ? `${result.errors.length} errors.` : ''
  );
  if (result.errors.length) console.table(result.errors.slice(0, 20));
} finally {
  await pool.end();
}
