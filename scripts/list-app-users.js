import { getPool } from './lib/db.js';

async function main() {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT id, email, role::text AS role, is_active, created_at
       FROM app_users
       ORDER BY email`
    );
    if (rows.length === 0) {
      console.log('No users.');
      return;
    }
    console.log('id | email | role | active | created_at');
    for (const r of rows) {
      console.log(
        `${r.id} | ${r.email} | ${r.role} | ${r.is_active} | ${r.created_at}`
      );
    }
    console.log(`\n${rows.length} user(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
