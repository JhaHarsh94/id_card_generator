import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, readCookie } from '../api/_lib/auth.js';
import { pickWritable, effectiveStatus } from '../api/_lib/members.js';
import { sameOrigin } from '../api/_lib/respond.js';
import health from '../api/health.js';
import members from '../api/members.js';
import { addMonths, formatDate, toISODate } from '../src/utils/date.js';
import { suggestNextId, generateIdRun } from '../src/utils/idGenerator.js';
import { CARD, EXPORT_SCALE } from '../src/config/cardDesign.js';
import pg from 'pg';

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

test('reference card dimensions preserve aspect ratio in print and PNG', () => {
  assert.ok(Math.abs(CARD.width / CARD.height - CARD.widthMM / CARD.heightMM) < 1e-12);
  assert.equal(CARD.width * EXPORT_SCALE, 2500);
  assert.equal(CARD.height * EXPORT_SCALE, 1500);
});

test('Hindi card date uses DD/MM/YYYY', () => {
  assert.equal(formatDate('2027-10-18'), '18/10/2027');
  assert.equal(formatDate('18/10/2027'), '18/10/2027');
  assert.equal(formatDate(''), '');
});

test('renewal clamps month end and handles leap years', () => {
  assert.equal(toISODate(addMonths('2028-01-31', 1)), '2028-02-29');
  assert.equal(toISODate(addMonths('2027-01-31', 1)), '2027-02-28');
});

test('reference ID numbering skips issued numbers without reusing deleted gaps', () => {
  const config = { idPrefix: 'PKSDST', idPadding: 4, idStart: 1 };
  assert.equal(suggestNextId(config, []), 'PKSDST0001');
  assert.equal(suggestNextId(config, ['PKSDST0001', 'PKSDST0003']), 'PKSDST0004');
  assert.deepEqual(generateIdRun(config, 2, ['PKSDST0001']).ids, ['PKSDST0002', 'PKSDST0003']);
});

test('passwords use salted hashes and reject incorrect or malformed values', async () => {
  const first = await hashPassword('Test-only-Password-12');
  const second = await hashPassword('Test-only-Password-12');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('Test-only-Password-12', first), true);
  assert.equal(await verifyPassword('wrong', first), false);
  assert.equal(await verifyPassword('wrong', 'broken'), false);
});

test('malformed cookie input fails closed', () => {
  assert.equal(readCookie({ headers: { cookie: 'a=1; idcms_session=hello%20there' } }, 'idcms_session'), 'hello there');
  assert.equal(readCookie({ headers: { cookie: 'idcms_session=%E0%A4%A' } }, 'idcms_session'), null);
  assert.equal(readCookie({ headers: {} }, 'idcms_session'), null);
});

test('member writes cannot overwrite server-owned fields', () => {
  const { values } = pickWritable({ fullName: 'सदस्य', id: 'forged', createdAt: '1900-01-01', createdBy: 'forged' });
  assert.deepEqual(values, { full_name: 'सदस्य' });
});

test('oversized photos are rejected', () => {
  assert.equal(pickWritable({ photoUrl: 'x'.repeat(1_500_001) }).problems.length, 1);
});

test('revocation wins over future validity dates', () => {
  assert.equal(effectiveStatus({ status: 'revoked', valid_until: '2999-01-01' }), 'revoked');
  assert.equal(effectiveStatus({ status: 'active', valid_until: '2000-01-01' }), 'expired');
  assert.equal(effectiveStatus({ status: 'active', valid_until: '2999-01-01' }), 'active');
  assert.equal(effectiveStatus({ status: 'active', valid_until: new Date('2000-01-01T00:00:00Z') }), 'expired');
});

test('Postgres calendar dates stay strings without timezone conversion', () => {
  assert.equal(pg.types.getTypeParser(1082)('2027-10-18'), '2027-10-18');
});

test('mutations reject a foreign origin', () => {
  assert.equal(sameOrigin({ headers: { origin: 'https://evil.example', host: 'cards.example' } }), false);
  assert.equal(sameOrigin({ headers: { origin: 'https://cards.example', host: 'cards.example' } }), true);
});

test('health check works without database credentials', () => {
  const res = response();
  health({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('health check rejects unsupported methods', () => {
  const res = response();
  health({ method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
});

test('private register rejects anonymous requests before accessing the database', async () => {
  const res = response();
  await members({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'UNAUTHENTICATED');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
