import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        'postgresql://stanthonys:stanthonys@localhost:5433/stanthonys_inventory',
    });
  }
  return pool;
}
