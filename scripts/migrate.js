import { getPool, runMigrations } from './lib/db.js';

const seed = process.argv.includes('--seed');

const pool = getPool();
try {
  await runMigrations(pool, { seed });
  console.log(seed ? 'Migrations and seed complete.' : 'Migrations complete.');
} finally {
  await pool.end();
}
