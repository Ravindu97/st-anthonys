import { getPool } from './lib/db.js';

const EXPECTED_FOOTER_VALUE = 47485709.26;
const TOLERANCE = 1.0;

async function main() {
  const pool = getPool();
  try {
    const { rows: snaps } = await pool.query(
      `SELECT inv.id, inv.period_starts_on, inv.period_ends_on, loc.tally_name AS location
       FROM inventory_snapshots inv
       JOIN locations loc ON loc.id = inv.location_id
       WHERE loc.tally_name = 'ORANGE MAIN LOCATION'
       ORDER BY inv.created_at DESC
       LIMIT 1`
    );
    if (snaps.length === 0) {
      console.error('No ORANGE MAIN LOCATION snapshot found. Run import first.');
      process.exit(1);
    }
    const snapshotId = snaps[0].id;

    const { rows: totals } = await pool.query(
      `SELECT
         COALESCE(SUM(value), 0) AS leaf_value_sum,
         COALESCE(SUM(quantity), 0) AS leaf_qty_sum,
         COUNT(*) AS balance_count
       FROM inventory_balances WHERE snapshot_id = $1`,
      [snapshotId]
    );

    const { rows: runs } = await pool.query(
      `SELECT row_counts FROM import_runs
       WHERE id = (SELECT import_run_id FROM inventory_snapshots WHERE id = $1)`,
      [snapshotId]
    );
    const footerValue = runs[0]?.row_counts?.footer_value ?? null;

    const { rows: akoya } = await pool.query(
      `SELECT total_quantity, total_value, item_count
       FROM v_group_balances
       WHERE snapshot_id = $1 AND group_name = 'AKOYA'`,
      [snapshotId]
    );

    const { rows: casablanca } = await pool.query(
      `SELECT total_quantity, total_value, item_count
       FROM v_group_balances
       WHERE snapshot_id = $1 AND group_name = 'CASABLANCA'`,
      [snapshotId]
    );

    const leafSum = Number(totals[0].leaf_value_sum);
    const diff = Math.abs(leafSum - EXPECTED_FOOTER_VALUE);

    console.log('=== ORANGE Location Summary Validation ===');
    console.log(`Snapshot: ${snapshotId}`);
    console.log(`Location: ${snaps[0].location}`);
    console.log(`Period: ${snaps[0].period_starts_on} .. ${snaps[0].period_ends_on}`);
    console.log(`Leaf balance rows: ${totals[0].balance_count}`);
    console.log(`Leaf value sum: ${leafSum.toFixed(2)}`);
    console.log(`Tally Grand Total: ${footerValue}`);
    console.log(`Expected Grand Total: ${EXPECTED_FOOTER_VALUE.toFixed(2)}`);
    console.log(`Difference: ${diff.toFixed(2)}`);
    console.log('');
    console.log('AKOYA (computed from v_group_balances):');
    if (akoya.length) {
      console.log(
        `  qty=${akoya[0].total_quantity} value=${Number(akoya[0].total_value).toFixed(2)} items=${akoya[0].item_count}`
      );
      console.log('  Tally rollup: qty=2806 value=2624444.55');
    } else {
      console.log('  NOT FOUND');
    }
    console.log('');
    console.log('CASABLANCA (computed):');
    if (casablanca.length) {
      console.log(
        `  qty=${casablanca[0].total_quantity} value=${Number(casablanca[0].total_value).toFixed(2)} items=${casablanca[0].item_count}`
      );
      console.log('  Tally rollup: qty=5140 value=3466484.08');
    } else {
      console.log('  NOT FOUND');
    }

    let failed = false;
    if (diff > TOLERANCE) {
      console.error('\nFAIL: Leaf value sum does not match Grand Total within tolerance.');
      failed = true;
    }
    if (!akoya.length || !casablanca.length) {
      console.error('\nFAIL: Expected groups missing.');
      failed = true;
    }

    if (failed) process.exit(1);
    console.log('\nPASS: Validation succeeded.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
