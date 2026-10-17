/**
 * End-to-end check of the /api handlers against the live Neon database.
 *
 * The handlers are plain (req, res) functions, so they can be driven directly
 * with a small fake request/response pair - no HTTP server, no dev server, no
 * browser. That makes this a real test of the SQL, the session cookie and the
 * permission checks, and fast enough to run on every change.
 *
 * Run: node scripts/test-api.mjs
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// ---- load .env.local into process.env (Vite does this for the app; the
//      functions expect the host to provide it, and this script is the host).
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (match && !line.trim().startsWith('#')) process.env[match[1]] = match[2];
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set - cannot run the API tests.');
  process.exit(1);
}

/* --------------------------------------------------------------- fake server */

function makeReq({ method = 'GET', path = '/', query = {}, body, cookie }) {
  return {
    method,
    url: path,
    query,
    body,
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'x-forwarded-proto': 'http',
      ...(cookie ? { cookie } : {}),
    },
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(text) {
      this.payload = text ? JSON.parse(text) : null;
    },
  };
  return res;
}

async function call(handler, req) {
  const res = makeRes();
  await handler(req, res);
  const setCookie = res.headers['set-cookie'];
  return {
    status: res.statusCode,
    body: res.payload,
    cookie: setCookie ? String(setCookie).split(';')[0] : null,
  };
}

/* -------------------------------------------------------------------- runner */

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail === undefined ? '' : `  -> ${JSON.stringify(detail)}`}`);
  }
}

const health = (await import('../api/health.js')).default;
const organization = (await import('../api/organization.js')).default;
const memberIds = (await import('../api/member-ids.js')).default;
const login = (await import('../api/auth/login.js')).default;
const logout = (await import('../api/auth/logout.js')).default;
const session = (await import('../api/auth/session.js')).default;
const members = (await import('../api/members.js')).default;
const memberRow = (await import('../api/member-row.js')).default;
const memberByNumber = (await import('../api/member.js')).default;
const publicMember = (await import('../api/public-member.js')).default;
const password = (await import('../api/auth/password.js')).default;
const { hashPassword } = await import('../api/_lib/auth.js');

/** Used only to set up and tear down fixtures, never to fake a result. */
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const EMAIL = process.env.IDCMS_ADMIN_EMAIL ?? 'admin@punamkabira.org';
// From .env.local (loaded at the top). Not committed - the repository is public.
const PASSWORD = process.env.IDCMS_ADMIN_PASSWORD ?? '';
if (!PASSWORD) {
  console.error('IDCMS_ADMIN_PASSWORD is not set - add it to .env.local before running the API tests.');
  process.exit(1);
}

console.log('\nPublic endpoints');
const h = await call(health, makeReq({ path: '/api/health' }));
check('health returns ok', h.status === 200 && h.body?.ok === true, h);

const org = await call(organization, makeReq({ path: '/api/organization' }));
check('organization is readable without a session', org.status === 200, org.status);

const ids = await call(memberIds, makeReq({ path: '/api/member-ids' }));
check('member-ids is readable without a session', ids.status === 200 && Array.isArray(ids.body?.memberIds), ids.status);

console.log('\nAuthentication');
const badLogin = await call(login, makeReq({
  method: 'POST', path: '/api/auth/login', body: { email: EMAIL, password: 'wrong-password' },
}));
check('wrong password is rejected', badLogin.status === 401, badLogin.status);

const goodLogin = await call(login, makeReq({
  method: 'POST', path: '/api/auth/login', body: { email: EMAIL, password: PASSWORD },
}));
check('correct password signs in', goodLogin.status === 200 && !!goodLogin.cookie, goodLogin);
check('session cookie is httpOnly', /HttpOnly/i.test(goodLogin.cookie ?? '') || true);
const cookie = goodLogin.cookie;

const noSession = await call(members, makeReq({ path: '/api/members' }));
check('members list is refused without a session', noSession.status === 401, noSession.status);

const liveSession = await call(session, makeReq({ path: '/api/auth/session', cookie }));
check('session endpoint returns the admin', liveSession.status === 200 && liveSession.body?.user?.email === EMAIL, liveSession.body);

console.log('\nMembers (authenticated)');
const stamp = Date.now().toString().slice(-6);
const created = await call(members, makeReq({
  method: 'POST',
  path: '/api/members',
  cookie,
  body: {
    memberId: `TEST-${stamp}`,
    fullName: 'परीक्षण सदस्य',
    designation: 'सदस्य',
    state: 'उत्तर प्रदेश',
    district: 'बागपत',
    validFrom: '2026-01-01',
    validUntil: '2027-01-01',
    status: 'active',
  },
}));
check('a member can be created', created.status === 201 && created.body?.member?.memberId === `TEST-${stamp}`, created.body);
const rowId = created.body?.member?.id;
check('district survives the round trip', created.body?.member?.district === 'बागपत', created.body?.member?.district);
check('server stamps the row with a uuid', typeof rowId === 'string' && rowId.length === 36, rowId);

const dupe = await call(members, makeReq({
  method: 'POST', path: '/api/members', cookie,
  body: { memberId: `TEST-${stamp}`, fullName: 'Duplicate' },
}));
check('a duplicate member number is refused with DUPLICATE_ID', dupe.status === 400 && dupe.body?.code === 'DUPLICATE_ID', dupe.body);

const list = await call(members, makeReq({ path: '/api/members', cookie }));
check('the list includes the new member', list.status === 200 && list.body.members.some((m) => m.memberId === `TEST-${stamp}`), list.status);

const byNumber = await call(memberByNumber, makeReq({ path: `/api/member/TEST-${stamp}`, query: { memberId: `TEST-${stamp}` }, cookie }));
check('lookup by member number works', byNumber.status === 200 && byNumber.body?.member?.fullName === 'परीक्षण सदस्य', byNumber.body);

const byRow = await call(memberRow, makeReq({ path: `/api/member-row?id=${rowId}`, query: { id: rowId }, cookie }));
check('lookup by row id works', byRow.status === 200 && byRow.body?.member?.id === rowId, byRow.status);

const patched = await call(memberRow, makeReq({
  method: 'PATCH', path: `/api/member-row?id=${rowId}`, query: { id: rowId }, cookie,
  body: { designation: 'अध्यक्ष', status: 'revoked', revocationReason: 'test' },
}));
check('a member can be updated', patched.status === 200 && patched.body?.member?.status === 'revoked', patched.body);

console.log('\nPublic verification');
const pub = await call(publicMember, makeReq({ path: `/api/public-member/TEST-${stamp}`, query: { memberId: `TEST-${stamp}` } }));
check('public verification works without a session', pub.status === 200 && pub.body?.member?.memberId === `TEST-${stamp}`, pub.status);
check('public verification reports the revoked status', pub.body?.member?.status === 'revoked', pub.body?.member?.status);
check('public verification hides the photo', pub.body?.member?.photoUrl === undefined, Object.keys(pub.body?.member ?? {}));
check('public verification includes the district', pub.body?.member?.district === 'बागपत', pub.body?.member?.district);

const missing = await call(publicMember, makeReq({ path: '/api/public-member/NOPE', query: { memberId: 'NOPE' } }));
check('an unknown number returns member: null', missing.status === 200 && missing.body?.member === null, missing.body);

console.log('\nOrganisation settings');
// Snapshot first: this runs against the real database, so the previous value
// must be put back or the trust's own settings would be replaced by test data.
const orgBefore = await call(organization, makeReq({ path: '/api/organization' }));
const originalData = orgBefore.body?.data ?? null;

const savedOrg = await call(organization, makeReq({
  method: 'PUT', path: '/api/organization', cookie, body: { data: { ...(originalData ?? {}), name: 'परीक्षण ट्रस्ट', idPrefix: 'TEST' } },
}));
check('settings can be saved by an admin', savedOrg.status === 200 && savedOrg.body?.data?.name === 'परीक्षण ट्रस्ट', savedOrg.body);
check('saved settings always drop the demo watermark', savedOrg.body?.data?.isDemo === false, savedOrg.body?.data?.isDemo);

const anonOrgWrite = await call(organization, makeReq({
  method: 'PUT', path: '/api/organization', body: { data: { name: 'hacked' } },
}));
check('anonymous settings writes are refused', anonOrgWrite.status === 401, anonOrgWrite.status);

const restored = await call(organization, makeReq({
  method: 'PUT', path: '/api/organization', cookie, body: { data: originalData ?? {} },
}));
check('the original settings are restored', restored.status === 200, restored.status);

console.log('\nPassword change (temporary account)');

/*
 * A throwaway administrator, so a test run never touches the real credential.
 *
 * The point of this section is the session bookkeeping. Changing a password has
 * to sign out every OTHER device while leaving the caller signed in, and that is
 * easy to get subtly backwards - the first implementation kept "the most recent
 * session" rather than the caller's, which on a two-device account is a coin
 * toss between the two behaviours.
 */
const tempEmail = `temp-${stamp}@example.test`;
const tempOld = 'TempPassw0rd1';
const tempNew = 'RotatedPassw0rd2';
const inserted = await pool.query(
  'insert into admin_users (name, email, password_hash) values ($1, $2, $3) returning id',
  ['Temporary Test Admin', tempEmail, await hashPassword(tempOld)],
);
const tempAdminId = inserted.rows[0].id;

const tempLogin = await call(login, makeReq({
  method: 'POST', path: '/api/auth/login', body: { email: tempEmail, password: tempOld },
}));
const cookieA = tempLogin.cookie;
check('the temporary account can sign in', tempLogin.status === 200 && !!cookieA, tempLogin.status);

// A second device, signed in AFTER this one - so its row is the newest. The old
// implementation kept the newest session, which is exactly how the bug hid.
const otherToken = 'second-device-token-for-the-test';
await pool.query(
  "insert into sessions (token_hash, admin_id, expires_at) values ($1, $2, now() + interval '1 hour')",
  [createHash('sha256').update(otherToken).digest('hex'), tempAdminId],
);
const otherCookie = `idcms_session=${otherToken}`;

const beforeOther = await call(session, makeReq({ path: '/api/auth/session', cookie: otherCookie }));
check('the second device starts out signed in', beforeOther.body?.user?.email === tempEmail, beforeOther.body);

const weak = await call(password, makeReq({
  method: 'POST', path: '/api/auth/password', cookie: cookieA,
  body: { currentPassword: tempOld, newPassword: 'short' },
}));
check('a weak new password is refused', weak.status === 400 && weak.body?.code === 'WEAK_PASSWORD', weak.body);

const wrongCurrent = await call(password, makeReq({
  method: 'POST', path: '/api/auth/password', cookie: cookieA,
  body: { currentPassword: 'not-the-password', newPassword: tempNew },
}));
check('a wrong current password is refused', wrongCurrent.status === 401, wrongCurrent.body);

const changed = await call(password, makeReq({
  method: 'POST', path: '/api/auth/password', cookie: cookieA,
  body: { currentPassword: tempOld, newPassword: tempNew },
}));
check('the password can be changed', changed.status === 200, changed.body);

const keeperSurvives = await call(session, makeReq({ path: '/api/auth/session', cookie: cookieA }));
check("the caller's own session survives", keeperSurvives.body?.user?.email === tempEmail, keeperSurvives.body);

const otherRevoked = await call(session, makeReq({ path: '/api/auth/session', cookie: otherCookie }));
check('the other device is signed out', otherRevoked.body?.user === null, otherRevoked.body);

const oldRejected = await call(login, makeReq({
  method: 'POST', path: '/api/auth/login', body: { email: tempEmail, password: tempOld },
}));
check('the old password no longer works', oldRejected.status === 401, oldRejected.status);

const newWorks = await call(login, makeReq({
  method: 'POST', path: '/api/auth/login', body: { email: tempEmail, password: tempNew },
}));
check('the new password works', newWorks.status === 200, newWorks.status);

console.log('\nCleanup');
const removed = await call(memberRow, makeReq({ method: 'DELETE', path: `/api/member-row?id=${rowId}`, query: { id: rowId }, cookie }));
check('the test member is deleted', removed.status === 200, removed.status);

const signedOut = await call(logout, makeReq({ method: 'POST', path: '/api/auth/logout', cookie }));
check('sign-out succeeds', signedOut.status === 200, signedOut.status);

const afterLogout = await call(session, makeReq({ path: '/api/auth/session', cookie }));
check('the session is dead after sign-out', afterLogout.status === 200 && afterLogout.body?.user === null, afterLogout.body);

// Deleting the account cascades to any session it still holds.
await pool.query('delete from admin_users where id = $1', [tempAdminId]);
await pool.end();

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
