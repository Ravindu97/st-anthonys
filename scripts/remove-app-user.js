import { getPool } from './lib/db.js';

function parseArgs(argv) {
  const out = { email: '', id: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email' && argv[i + 1]) out.email = argv[++i];
    else if (a === '--id' && argv[i + 1]) out.id = argv[++i];
  }
  return out;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function main() {
  const { email, id } = parseArgs(process.argv.slice(2));
  if (!email && !id) {
    console.error('Usage: npm run user:remove -- --email user@example.com');
    console.error('   or: npm run user:remove -- --id <uuid>');
    process.exit(1);
  }

  const pool = getPool();
  try {
    const { rows } = email
      ? await pool.query(
          `DELETE FROM app_users WHERE email = $1
           RETURNING id, email, role::text AS role`,
          [normalizeEmail(email)]
        )
      : await pool.query(
          `DELETE FROM app_users WHERE id = $1
           RETURNING id, email, role::text AS role`,
          [id]
        );

    if (rows.length === 0) {
      console.error('No matching user found.');
      process.exit(1);
    }
    const u = rows[0];
    console.log(`Removed ${u.email} (${u.role}) id=${u.id}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
