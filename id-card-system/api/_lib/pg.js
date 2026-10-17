/**
 * Shared Postgres pool for the API.
 *
 * Vercel runs each function as its own process, so the pool is a module-level
 * singleton: the connection survives between invocations of the SAME function
 * and is dropped when that instance is recycled. `max: 1` is deliberate - with
 * a serverless deployment the real concurrency limit is the number of warmed
 * instances, and opening a second connection per instance only buys you
 * connection storms against Neon's pooler for no latency benefit.
 *
 * The connection string must point at Neon's POOLED endpoint (the one with
 * `-pooler` in the host). The direct endpoint is for interactive sessions and
 * will exhaust its connection count almost immediately under function traffic.
 *
 * `channel_binding` is stripped from the URL if present: node-postgres does not
 * implement SCRAM channel binding and will fail to connect with it required.
 */

import pg from 'pg';

const { Pool } = pg;

let pool = null;

function connectionString() {
  const raw = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set on this deployment.');
  }
  return raw.replace(/[?&]channel_binding=require\b/, '?').replace(/\?\?/, '?');
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString(),
      max: 1,
      idleTimeoutMillis: 20_000,
      // Neon suspends idle computes; a first request after a cold start can take
      // several seconds, so the wait must outlast that rather than error.
      connectionTimeoutMillis: 15_000,
    });
    // An idle socket erroring must not crash the function - the next query
    // simply opens a fresh connection.
    pool.on('error', () => {});
  }
  return pool;
}

/** Run one query. */
export async function query(text, params) {
  const { rows } = await getPool().query(text, params);
  return rows;
}

/** Run a query and return only its first row (or null). */
export async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}
