// One-off: generate the scrypt hash for the seeded admin password and print
// the SQL needed to insert it.
// Run: node scripts/make-admin.mjs <password> [email] [name]
import { randomBytes, scrypt } from 'node:crypto';

// No default password: a real one must be passed in, so that no working
// credential sits in this (public) repository.
const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/make-admin.mjs <password> [email] [name]');
  process.exit(1);
}
const email = process.argv[3] ?? 'admin@example.org';
const name = process.argv[4] ?? 'Administrator';

const N = 16384;
const r = 8;
const p = 1;
const salt = randomBytes(16).toString('hex');

const hash = await new Promise((resolve, reject) => {
  scrypt(password, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, buf) =>
    (err ? reject(err) : resolve(buf.toString('hex'))));
});

const stored = `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
const esc = (s) => s.replace(/'/g, "''");

console.log(JSON.stringify({ email, name, stored }, null, 2));
console.log(
  `insert into admin_users (name, email, password_hash) values ('${esc(name)}', '${esc(email)}', '${esc(stored)}') on conflict (email) do nothing;`,
);
