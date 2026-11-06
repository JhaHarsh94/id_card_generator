import { readFile } from 'node:fs/promises';
import { getPool } from '../api/_lib/pg.js';

let pool;
try {
  pool = getPool();
  const sql = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('Database schema is ready.');
} catch (error) {
  console.error('Database setup failed:', error.code || 'Check DATABASE_URL and database access.');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
