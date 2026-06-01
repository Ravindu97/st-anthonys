import { getPool } from './lib/db.js';

const EXPECTED_FOOTER_VALUE = 20227162.21;
const TOLERANCE = 1.0;

async function main() {
  const pool = getPool();
  try {
    const { rows: snaps } = await pool.query(
      `SELECT inv.id, inv.period_starts_on, inv.period_ends_on, loc.tally_name AS location
       FROM inventory_snapshots inv
       JOIN locations loc ON loc.id = inv.location_id
       JOIN stock_categories cat ON cat.id = loc.stock_category_id
       WHERE cat.code = 'SWISSTEK'
       ORDER BY inv.created_at DESC
       LIMIT 1`
    );
    if (snaps.length === 0) {
      console.error('No SWISSTEK snapshot found. Run SWISSTEK import first.');
      process.exit(1);
    }
    const snapshotId = snaps[0].id;

    const { rows: totals } = await pool.query(
      `SELECT COALESCE(SUM(value), 0) AS leaf_value_sum, COUNT(*) AS balance_count
       FROM inventory_balances WHERE snapshot_id = $1`,
      [snapshotId]
    );

    const { rows: runs } = await pool.query(
      `SELECT row_counts FROM import_runs
       WHERE id = (SELECT import_run_id FROM inventory_snapshots WHERE id = $1)`,
      [snapshotId]
    );
    const footerValue = Number(runs[0]?.row_counts?.footer_value ?? 0);
    const leafSum = Number(totals[0].leaf_value_sum);
    const diff = Math.abs(leafSum - EXPECTED_FOOTER_VALUE);

    console.log('=== SWISSTEK Location Summary Validation ===');
    console.log(`Snapshot: ${snapshotId}`);
    console.log(`Location: ${snaps[0].location}`);
    console.log(`Balances: ${totals[0].balance_count}`);
    console.log(`Leaf value sum: ${leafSum.toFixed(2)}`);
    console.log(`Tally footer: ${footerValue.toFixed(2)}`);
    console.log(`Expected: ${EXPECTED_FOOTER_VALUE.toFixed(2)}`);
    console.log(`Difference: ${diff.toFixed(2)}`);

    if (diff > TOLERANCE) {
      console.error('FAIL');
      process.exit(1);
    }
    console.log('PASS');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
