/** Explicit local test harness: in-memory PostgreSQL, disposable records, no external database. */
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';
import { getPool } from '../api/_lib/pg.js';
import { hashPassword } from '../api/_lib/auth.js';

process.env.VITE_DATA_BACKEND = 'api';
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test_only';
const db = await PGlite.create({ parsers: { 1082: (value) => value } });
await db.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
await db.query('insert into admin_users (name, email, password_hash) values ($1, $2, $3)',
  ['Browser test administrator', 'browser-test@example.org', await hashPassword('Browser-Test-Password-1234')]);
const pool = getPool();
let offline = false;
pool.query = (text, params) => offline
  ? Promise.reject(Object.assign(new Error('Simulated outage'), { code: 'ECONNREFUSED' }))
  : db.query(text, params);

const server = await createServer({
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  plugins: [{
    name: 'isolated-test-controls',
    configureServer(vite) {
      vite.middlewares.use('/__test/outage', (req, res) => {
        offline = new URL(req.originalUrl, 'http://localhost').searchParams.get('enabled') === 'true';
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ offline }));
      });
    },
  }],
});
await server.listen();
console.log('Isolated API test server: http://127.0.0.1:5174');
async function close() { await server.close(); await pool.end(); await db.close(); process.exit(0); }
process.on('SIGINT', close);
process.on('SIGTERM', close);
