import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importReorderRulesCsv } from '@st-anthonys/import/reorder-rules.js';
import { getPool } from './lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const filePath =
    process.argv[2] ?? path.join(__dirname, '../reference/reorder-rules-sample.csv');

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await importReorderRulesCsv(client, content);
    await client.query('COMMIT');
    console.log(`Imported ${result.imported} reorder rules`);
    if (result.errors.length > 0) {
      console.log('Errors:');
      for (const e of result.errors) console.log(`  - ${e}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
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
