const { test } = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const { CodexBarClient } = require('../dist/codexBarClient');
test('CLI arguments, missing binary, bad JSON and partial nonzero results', async () => {
  const original = childProcess.execFile;
  let response;
  childProcess.execFile = (command, args, options, callback) => {
    assert.equal(command, 'codexbar');
    assert.deepEqual(args, ['dashboard', '--identity', 'redacted']);
    assert.equal(options.timeout, 45000);
    queueMicrotask(() => callback(...response));
    return { kill() {} };
  };
  try {
    const client = new CodexBarClient();
    response = [{code:'ENOENT'}, ''];
    await assert.rejects(client.fetch(), e => e.kind === 'missing');
    response = [null, 'invalid private data'];
    await assert.rejects(client.fetch(), e => e.kind === 'json' && !e.message.includes('private'));
    response = [{code:1}, '{"providers":[{"id":"claude","error":null,"windows":[]}]}'];
    assert.equal((await client.fetch())[0].id, 'claude');
    response = [{killed:true}, '{"providers":[]}'];
    await assert.rejects(client.fetch(), e => e.kind === 'execution');
  } finally { childProcess.execFile = original; }
});
