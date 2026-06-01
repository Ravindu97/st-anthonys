import bcrypt from 'bcryptjs';
import { getPool } from './lib/db.js';

const ROUNDS = 12;

function parseArgs(argv) {
  const out = { email: '', password: '', role: 'viewer' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email' && argv[i + 1]) out.email = argv[++i];
    else if (a === '--password' && argv[i + 1]) out.password = argv[++i];
    else if (a === '--role' && argv[i + 1]) out.role = argv[++i];
  }
  return out;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function main() {
  const { email, password, role } = parseArgs(process.argv.slice(2));

  if (!email || !password) {
    console.error(
      'Usage: npm run user:create -- --email user@example.com --password "secret" --role admin|viewer'
    );
    process.exit(1);
  }

  if (role !== 'admin' && role !== 'viewer') {
    console.error('Role must be admin or viewer');
    process.exit(1);
  }

  const pool = getPool();
  const normalized = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, ROUNDS);

  try {
    const { rows } = await pool.query(
      `INSERT INTO app_users (email, password_hash, role)
       VALUES ($1, $2, $3::app_role)
       RETURNING id, email, role::text AS role`,
      [normalized, passwordHash, role]
    );
    console.log(`Created user ${rows[0].email} (${rows[0].role}) id=${rows[0].id}`);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      console.error(`User already exists: ${normalized}`);
      process.exit(1);
    }
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
