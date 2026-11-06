import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { getPool } from '../api/_lib/pg.js';
import { hashPassword } from '../api/_lib/auth.js';
import login from '../api/auth/login.js';
import logout from '../api/auth/logout.js';
import session from '../api/auth/session.js';
import password from '../api/auth/password.js';
import members from '../api/members.js';
import member from '../api/member.js';
import memberRow from '../api/member-row.js';
import publicMember from '../api/public-member.js';
import organization from '../api/organization.js';

/** Execute the real handlers and schema against isolated PostgreSQL WASM. */
test('API integration against an ephemeral PostgreSQL database', async (t) => {
  const db = await PGlite.create({ parsers: { 1082: (value) => value } });
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/test_only';
  const pool = getPool();
  let offline = false;
  mock.method(pool, 'query', (text, params) => offline
    ? Promise.reject(Object.assign(new Error('Test database outage'), { code: 'ECONNREFUSED' }))
    : db.query(text, params));
  const sql = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  let cookie = '';
  let rowId;
  const input = { memberId: 'PKSDST0001', fullName: 'परीक्षण सदस्य', designation: 'सदस्य', state: 'उत्तर प्रदेश', district: 'मेरठ', validFrom: '2026-01-01', validUntil: '2027-10-18', status: 'active', photoUrl: null };
  async function call(handler, { method = 'GET', body, query = {}, authenticated = true, origin = 'https://cards.example' } = {}) {
    const req = { method, body, query, headers: { host: 'cards.example', origin, 'x-forwarded-proto': 'https', ...(authenticated && cookie ? { cookie } : {}) } };
    const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(data) { this.body = JSON.parse(data); } };
    await handler(req, res);
    return res;
  }
  try {
    await t.test('fresh schema applies twice without deleting data', async () => {
      await db.exec(sql);
      await db.query('insert into admin_users (name, email, password_hash) values ($1, $2, $3)', ['Test administrator', 'test@example.org', await hashPassword('Test-Password-1234')]);
      await db.exec(sql);
      assert.equal((await db.query('select count(*) from admin_users')).rows[0].count, 1);
    });
    await t.test('anonymous register access is denied', async () => {
      assert.equal((await call(members, { authenticated: false })).statusCode, 401);
    });
    await t.test('invalid JSON and wrong credentials fail cleanly', async () => {
      assert.equal((await call(login, { method: 'POST', body: 'null' })).statusCode, 400);
      assert.equal((await call(login, { method: 'POST', body: { email: 'test@example.org', password: 'wrong' } })).statusCode, 401);
    });
    await t.test('sign-in creates an HttpOnly Secure cookie accepted by the session route', async () => {
      const res = await call(login, { method: 'POST', body: { email: 'test@example.org', password: 'Test-Password-1234' } });
      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['Set-Cookie'].includes('HttpOnly'));
      assert.ok(res.headers['Set-Cookie'].includes('Secure'));
      cookie = res.headers['Set-Cookie'].split(';')[0];
      assert.equal((await call(session)).body.user.email, 'test@example.org');
    });
    await t.test('creation persists Hindi details and does not accept forged server fields', async () => {
      const res = await call(members, { method: 'POST', body: { ...input, createdAt: '1900-01-01', id: 'forged' } });
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      rowId = res.body.member.id;
      assert.notEqual(rowId, 'forged');
      assert.equal(res.body.member.fullName, input.fullName);
      assert.equal(res.body.member.validUntil, input.validUntil);
      assert.equal((await call(members)).body.members.length, 1);
    });
    await t.test('duplicate, overlong, malformed and impossible-date writes are rejected', async () => {
      assert.equal((await call(members, { method: 'POST', body: input })).body.code, 'DUPLICATE_ID');
      for (const patch of [{ memberId: 'X'.repeat(25) }, { fullName: {} }, { validUntil: '2027-02-31' }, { state: '' }, { status: 'unknown' }]) {
        assert.equal((await call(members, { method: 'POST', body: { ...input, ...patch } })).statusCode, 400);
      }
    });
    await t.test('foreign-origin mutation is rejected', async () => {
      assert.equal((await call(memberRow, { method: 'PATCH', query: { id: rowId }, body: { fullName: 'Changed' }, origin: 'https://evil.example' })).statusCode, 403);
    });
    await t.test('edits persist and invalid date windows are rejected using the existing record', async () => {
      const changed = await call(memberRow, { method: 'PATCH', query: { id: rowId }, body: { fullName: 'बदला हुआ नाम' } });
      assert.equal(changed.statusCode, 200);
      assert.equal((await call(member, { query: { memberId: input.memberId } })).body.member.fullName, 'बदला हुआ नाम');
      assert.equal((await call(memberRow, { method: 'PATCH', query: { id: rowId }, body: { validUntil: '2025-01-01' } })).statusCode, 400);
    });
    await t.test('public verification omits photos, internal ids and revocation notes', async () => {
      const res = await call(publicMember, { query: { memberId: input.memberId }, authenticated: false });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.member.status, 'active');
      assert.equal(res.body.member.id, null);
      assert.equal(Object.hasOwn(res.body.member, 'photoUrl'), false);
      assert.equal(Object.hasOwn(res.body.member, 'revocationReason'), false);
    });
    await t.test('revoke and renew preserve revocation until explicitly reinstated', async () => {
      assert.equal((await call(memberRow, { method: 'PATCH', query: { id: rowId }, body: { status: 'revoked', revocationReason: 'Test revocation' } })).statusCode, 200);
      assert.equal((await call(memberRow, { method: 'PATCH', query: { id: rowId }, body: { validUntil: '2028-10-18' } })).statusCode, 200);
      assert.equal((await call(publicMember, { query: { memberId: input.memberId }, authenticated: false })).body.member.status, 'revoked');
    });
    await t.test('organisation settings persist and invalid settings are rejected', async () => {
      const saved = await call(organization, { method: 'PUT', body: { data: { name: 'परीक्षण ट्रस्ट', qrEnabled: true, idStart: 1, idPadding: 4 } } });
      assert.equal(saved.statusCode, 200);
      assert.equal((await call(organization, { authenticated: false })).body.data.name, 'परीक्षण ट्रस्ट');
      assert.equal((await call(organization, { method: 'PUT', body: { data: { idStart: -1 } } })).statusCode, 400);
      assert.equal((await call(organization, { method: 'PUT', body: { data: [] } })).statusCode, 400);
    });
    await t.test('password change keeps the current session and rejects the old password', async () => {
      assert.equal((await call(password, { method: 'POST', body: { currentPassword: 'Test-Password-1234', newPassword: 'Changed-Password-5678' } })).statusCode, 200);
      assert.ok((await call(session)).body.user);
      assert.equal((await call(login, { method: 'POST', body: { email: 'test@example.org', password: 'Test-Password-1234' } })).statusCode, 401);
    });
    await t.test('delete removes the record and a missing record is reported accurately', async () => {
      assert.equal((await call(memberRow, { method: 'DELETE', query: { id: rowId } })).statusCode, 200);
      assert.equal((await call(memberRow, { query: { id: rowId } })).statusCode, 404);
      assert.equal((await call(publicMember, { query: { memberId: input.memberId }, authenticated: false })).body.member, null);
    });
    await t.test('sign-out revokes the session and clears its cookie', async () => {
      const res = await call(logout, { method: 'POST' });
      assert.ok(res.headers['Set-Cookie'].includes('Max-Age=0'));
      assert.equal((await call(session)).body.user, null);
    });
    await t.test('database outage returns 503 without pretending a valid session expired', async () => {
      const signedIn = await call(login, { method: 'POST', body: { email: 'test@example.org', password: 'Changed-Password-5678' } });
      cookie = signedIn.headers['Set-Cookie'].split(';')[0];
      offline = true;
      try {
        const res = await call(members);
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.code, 'DB_UNAVAILABLE');
      } finally { offline = false; }
    });
    await t.test('sign-out clears the cookie even when session deletion fails', async () => {
      offline = true;
      try { assert.ok((await call(logout, { method: 'POST' })).headers['Set-Cookie'].includes('Max-Age=0')); }
      finally { offline = false; }
    });
  } finally {
    mock.restoreAll();
    await pool.end();
    await db.close();
  }
});
