import { hashPassword } from '../api/_lib/auth.js';
import { getPool } from '../api/_lib/pg.js';

const email = process.env.IDCMS_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.IDCMS_ADMIN_PASSWORD;
const name = process.env.IDCMS_ADMIN_NAME?.trim() || 'Administrator';
if (!email?.includes('@') || !password || password.length < 12) {
  console.error('Set IDCMS_ADMIN_EMAIL and IDCMS_ADMIN_PASSWORD (at least 12 characters) in .env.local.');
  process.exit(1);
}

const pool = getPool();
try {
  const hash = await hashPassword(password);
  const result = await pool.query(
    'insert into admin_users (name, email, password_hash) values ($1, $2, $3) on conflict do nothing returning id',
    [name, email, hash],
  );
  console.log(result.rowCount ? 'Administrator created.' : 'Administrator already exists; no account was changed.');
} catch (error) {
  console.error('Administrator setup failed:', error.code || 'Check the schema and database access.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
