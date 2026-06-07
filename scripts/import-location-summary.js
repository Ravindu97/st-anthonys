import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDryRunResult,
  isDryRunComplete,
  ImportValidationError,
  runLocationSummaryImport,
  syncPurchaseSuggestionsAfterImport,
} from '@st-anthonys/import';
import { getPool, sha256File } from './lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const positional = argv.filter((a) => !a.startsWith('--'));
  return {
    dryRun,
    filePath:
      positional[0] ??
      path.join(__dirname, '../reference/orange product list 3.csv'),
    categoryCode: positional[1] ?? 'ORANGE',
    locationTallyName: positional[2] ?? null,
  };
}

async function main() {
  const { dryRun, filePath, categoryCode, locationTallyName } = parseArgs(
    process.argv.slice(2)
  );

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const fileHash = sha256File(filePath);

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await runLocationSummaryImport(client, {
      content,
      fileName: path.basename(filePath),
      fileHash,
      categoryCode,
      locationTallyName,
      dryRun,
    });

    await client.query('COMMIT');

    if (!dryRun && result.companyId) {
      const scan = await syncPurchaseSuggestionsAfterImport(pool, result.companyId);
      console.log(
        `  Reorder scan: ${scan.scanned} below min, ${scan.created} new, ${scan.updated} updated`
      );
    }

    console.log(dryRun ? 'Dry run completed (rolled back).' : 'Import completed.');
    console.log(`  Snapshot: ${result.snapshotId}`);
    console.log(`  Import run: ${result.importRunId}`);
    console.log(`  Items: ${result.rowCounts.items}, Groups: ${result.rowCounts.groups}`);
    console.log(`  Footer value (Tally): ${result.rowCounts.footer_value}`);
    console.log(`  Sum of leaf values: ${result.rowCounts.computed_total_value}`);
    console.log(`  Validation OK: ${result.rowCounts.validation_ok}`);
    if (result.report) {
      console.log(
        `  Created: ${result.report.itemsCreated}, Updated: ${result.report.itemsUpdated}`
      );
    }
  } catch (err) {
    if (isDryRunComplete(err)) {
      await client.query('ROLLBACK');
      const preview = getDryRunResult(err);
      console.log('Dry run preview (no changes saved):');
      console.log(JSON.stringify(preview, null, 2));
      return;
    }
    await client.query('ROLLBACK');
    if (err instanceof ImportValidationError && err.details?.issues?.length) {
      console.error(err.message);
      console.error('Issues:');
      for (const issue of err.details.issues) {
        const line = issue.lineNo != null ? `Line ${issue.lineNo}: ` : '';
        console.error(`  - ${line}${issue.message}`);
      }
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
