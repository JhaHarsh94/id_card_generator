import { readFile } from 'node:fs/promises';
import { getPool } from '../api/_lib/pg.js';

let pool;
try {
  pool = getPool();
  const sql = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  const databaseUrl = new URL(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
  if (/(^|\.)supabase\.(co|com)$/.test(databaseUrl.hostname)) {
    const access = await readFile(new URL('../database/supabase.sql', import.meta.url), 'utf8');
    await pool.query(access);
    console.log('Supabase application tables are protected from browser roles.');
  }
  console.log('Database schema is ready.');
} catch (error) {
  console.error('Database setup failed:', error.code || 'Check DATABASE_URL and database access.');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
