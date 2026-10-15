const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseUsage, statusText, PROVIDERS, formatReset } = require('../dist/usageParser');
test('six quotas remain independent, zero survives, identity is discarded', () => {
  const providers = parseUsage(JSON.stringify({ providers: PROVIDERS.map((p, i) => ({ id: p.id, identity: { accountEmail: 'private@example.com' }, error: null, windows: (i < 2 ? ['session', 'weekly'] : ['antigravity-quota-summary-gemini-weekly', 'antigravity-quota-summary-3p-weekly']).map((kind, j) => ({ kind, label: kind, remainingPercent: i === 2 ? 0 : 92-j*12, usedPercent: i === 2 ? 100 : 8+j*12 })) })) }));
  assert.deepEqual(PROVIDERS.map((p,i) => statusText(p, providers[i])), ['Codex S92 W80', 'Claude S92 W80', 'AG G0 3P0']);
  assert.ok(!JSON.stringify(providers).includes('private'));
});
test('provider failures and missing providers do not affect healthy providers', () => {
  const data = parseUsage(JSON.stringify({ providers: [{ id: 'codex', error: { message: 'secret' }, windows: [] }, { id: 'claude', error: null, windows: [{ kind: 'session', remainingPercent: 44 }] }] }));
  assert.equal(statusText(PROVIDERS[0], data[0]), 'Codex S-- W--');
  assert.equal(statusText(PROVIDERS[1], data[1]), 'Claude S44 W--');
  assert.equal(statusText(PROVIDERS[2]), 'AG G-- 3P--');
  assert.ok(!JSON.stringify(data).includes('secret'));
});
test('invalid structures, percentages and dates are handled', () => {
  assert.throws(() => parseUsage('bad'));
  assert.throws(() => parseUsage('{}'));
  const [p] = parseUsage(JSON.stringify({ providers: [null, {id:'codex', windows:[null, {kind:'session', remainingPercent:101, usedPercent:'5', resetAt:'bad'}]}] }));
  assert.equal(statusText(PROVIDERS[0], p), 'Codex S-- W--');
  assert.equal(formatReset(p.windows[0].resetAt), '--');
});
test('additional windows retained; ambiguous windows are not collapsed', () => {
  const [p] = parseUsage(JSON.stringify({providers:[{id:'codex', windows:[{kind:'weekly',remainingPercent:80},{kind:'weekly',remainingPercent:20},{kind:'extra',remainingPercent:10}]}]}));
  assert.equal(p.windows.length,3);
  assert.equal(statusText(PROVIDERS[0],p),'Codex S-- W--');
});
