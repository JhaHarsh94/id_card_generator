import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { toYMD, isValidYMD, formatDate, today, addMonths, toISODate } from '../src/utils/date.js';
import { deriveStatus } from '../src/utils/status.js';
import { validateMemberForm, validateValidity } from '../src/utils/validation.js';
import { validateOrganization } from '../shared/organization.js';
import { buildVerifyUrl } from '../src/utils/verification.js';
import { suggestNextId } from '../src/utils/idGenerator.js';
import { toCsv } from '../src/utils/csv.js';
import { readBody } from '../api/_lib/respond.js';
import { requestJson } from '../src/services/http.js';
import { shareCard } from '../src/utils/cardExport.js';

test('invalid dates return validation errors rather than throwing or rolling over', () => {
  for (const value of ['garbage', '2027-02-31', '2027-13-01', { y: 2027, m: 2, d: 31 }, { y: 2027.5, m: 2, d: 1 }]) {
    assert.equal(toYMD(value), null);
    assert.equal(formatDate(value), '');
    assert.ok(validateValidity('', value).error);
  }
  assert.equal(isValidYMD(null), false);
});

test('negative month arithmetic crosses year boundaries correctly', () => {
  assert.equal(toISODate(addMonths('2026-01-31', -2)), '2025-11-30');
});

test('server and browser use the organisation calendar at the UTC midnight boundary', () => {
  assert.deepEqual(today(new Date('2026-11-06T20:00:00Z')), { y: 2026, m: 11, d: 7 });
  assert.equal(deriveStatus({ validUntil: '2026-11-06' }, { y: 2026, m: 11, d: 6 }), 'active');
  assert.equal(deriveStatus({ validUntil: '2026-11-06' }, { y: 2026, m: 11, d: 7 }), 'expired');
});

test('frontend enforces the same member ID limits as the API', () => {
  const input = { fullName: 'Test', designation: 'Member', state: 'UP', validUntil: '2027-01-01', memberId: 'X'.repeat(25) };
  assert.ok(validateMemberForm(input).errors.memberId);
});

test('settings reject invalid ranges, types and URL schemes', () => {
  for (const patch of [{ idStart: 0 }, { idPadding: 1.5 }, { defaultValidityMonths: 121 }, { name: '' }, { qrEnabled: 'yes' }, { verifyBaseUrl: 'javascript:alert(1)' }]) {
    assert.ok(Object.keys(validateOrganization(patch).errors).length);
  }
});

test('settings whitelist drops prototype keys and preserves deliberate asset removal', () => {
  const result = validateOrganization(JSON.parse('{"__proto__":{"polluted":true},"constructor":"bad","logoUrl":null,"scopeText":""}'));
  assert.deepEqual(result.values, { logoUrl: null, scopeText: '' });
  assert.equal({}.polluted, undefined);
});

test('verification URL supports the saved site and safely encodes an ID', () => {
  assert.equal(buildVerifyUrl('A/B', 'https://cards.example/path'), 'https://cards.example/verify/A%2FB');
  assert.equal(buildVerifyUrl('ID1', 'javascript:alert(1)'), '/verify/ID1');
});

test('ID suggestions use numeric suffixes and do not overflow with a large register', () => {
  const config = { idPrefix: 'QA', idStart: 10, idPadding: 4 };
  assert.equal(suggestNextId(config, ['QA1e9', 'QA0001']), 'QA0010');
  assert.equal(suggestNextId(config, Array.from({ length: 150000 }, (_, i) => `QA${i}`)), 'QA150000');
});

test('CSV export keeps Hindi and quotes while neutralising spreadsheet formulas', () => {
  const csv = toCsv([{ name: '=1+1', note: 'हिंदी, "नाम"' }], [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Note' }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"हिंदी, ""नाम"""'));
});

test('JSON body parsing rejects null, arrays, invalid JSON and oversized uploads', async () => {
  for (const body of ['null', '[]', '{broken', 'x'.repeat(4 * 1024 * 1024 + 1)]) {
    const res = { setHeader() {}, end(data) { this.body = JSON.parse(data); } };
    assert.equal(await readBody({ body }, res), null);
    assert.ok([400, 413].includes(res.statusCode));
  }
});

test('transport rejects an HTML SPA fallback instead of treating it as a saved record', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('<html>fallback</html>', { status: 200 }));
  try { await assert.rejects(requestJson('/api/members'), { code: 'INVALID_RESPONSE' }); }
  finally { mock.restoreAll(); }
});

test('transport aborts a stalled request with a useful retry message', async () => {
  mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  try { await assert.rejects(requestJson('/api/members', { timeout: 10 }), { code: 'TIMEOUT' }); }
  finally { mock.restoreAll(); }
});

test('share reports rasterisation failure instead of claiming a download succeeded', async () => {
  let fallbackCalled = false;
  await assert.rejects(shareCard(null, {}, { fallback: () => { fallbackCalled = true; } }));
  assert.equal(fallbackCalled, false);
});
