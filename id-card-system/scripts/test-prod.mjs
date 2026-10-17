/**
 * Production smoke test.
 *
 * The sandboxed browser cannot read a Set-Cookie header, so instead of logging
 * in over HTTP this mints a session row directly and then drives the DEPLOYED
 * API with it. That proves the part that login would otherwise only imply:
 * that a session created server-side is accepted by the deployed cookie parser,
 * and that the deployed read/write paths work against the real Neon database.
 *
 * It cleans up after itself: the session and the test member are both removed.
 *
 * Run: node scripts/test-prod.mjs
 */

import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !line.trim().startsWith('#')) process.env[m[1]] = m[2];
}

const BASE = process.env.PROD_URL ?? 'https://id-card-generator-chi-one.vercel.app';
const sha256 = (t) => createHash('sha256').update(t).digest('hex');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

let passed = 0;
let failed = 0;
function check(label, ok, detail) {
  if (ok) { passed += 1; console.log(`  PASS  ${label}`); }
  else { failed += 1; console.log(`  FAIL  ${label}  -> ${JSON.stringify(detail)}`); }
}

async function call(method, path, { body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, isHtml: text.trimStart().startsWith('<') };
}

const token = randomBytes(32).toString('hex');
const cookie = `idcms_session=${token}`;
const memberId = `PROD-${Date.now().toString().slice(-6)}`;
let rowId = null;

try {
  const admin = await pool.query('select id from admin_users limit 1');
  await pool.query(
    'insert into sessions (token_hash, admin_id, expires_at) values ($1, $2, now() + interval \'1 hour\')',
    [sha256(token), admin.rows[0].id],
  );

  console.log(`\nProduction: ${BASE}\n`);

  console.log('Routing (must not be swallowed by the SPA rewrite)');
  for (const p of ['/api/health', '/api/member-ids', '/api/organization', '/api/member?memberId=x', '/api/member-row?id=x', '/api/public-member?memberId=x']) {
    const r = await call('GET', p);
    check(`${p} returns JSON, not HTML`, !r.isHtml, { status: r.status });
  }

  console.log('\nSession handling');
  const sess = await call('GET', '/api/auth/session', { cookie });
  check('the minted session is recognised', sess.status === 200 && sess.json?.user?.email, sess.json);

  const anon = await call('GET', '/api/members');
  check('no session is refused', anon.status === 401, anon.status);

  console.log('\nAuthenticated reads and writes');
  const created = await call('POST', '/api/members', {
    cookie,
    body: {
      memberId, fullName: 'प्रोडक्शन परीक्षण', designation: 'सदस्य',
      state: 'उत्तर प्रदेश', district: 'बागपत',
      validFrom: '2026-01-01', validUntil: '2027-01-01', status: 'active',
    },
  });
  check('member created', created.status === 201 && created.json?.member?.memberId === memberId, created.json);
  rowId = created.json?.member?.id;
  check('district stored', created.json?.member?.district === 'बागपत', created.json?.member?.district);

  const listed = await call('GET', '/api/members', { cookie });
  check('list contains it', listed.status === 200 && listed.json.members.some((m) => m.memberId === memberId), listed.status);

  const byNumber = await call('GET', `/api/member?memberId=${encodeURIComponent(memberId)}`, { cookie });
  check('lookup by printed number', byNumber.status === 200 && byNumber.json?.member?.memberId === memberId, byNumber.json);

  const byRow = await call('GET', `/api/member-row?id=${rowId}`, { cookie });
  check('lookup by row id', byRow.status === 200 && byRow.json?.member?.id === rowId, byRow.status);

  console.log('\nPublic QR verification');
  const pub = await call('GET', `/api/public-member?memberId=${encodeURIComponent(memberId)}`);
  check('works with no session', pub.status === 200 && pub.json?.member?.memberId === memberId, pub.json);
  check('carries the district shown on the card', pub.json?.member?.district === 'बागपत', pub.json?.member?.district);
  check('does not leak the photograph', pub.json?.member?.photoUrl === undefined, Object.keys(pub.json?.member ?? {}));

  console.log('\nCleanup');
  const del = await call('DELETE', `/api/member-row?id=${rowId}`, { cookie });
  check('test member deleted', del.status === 200, del.status);
  rowId = null;

  const out = await call('POST', '/api/auth/logout', { cookie });
  check('logout succeeds', out.status === 200, out.status);
} finally {
  if (rowId) await pool.query('delete from members where id = $1', [rowId]);
  await pool.query('delete from sessions where token_hash = $1', [sha256(token)]);
  await pool.end();
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
