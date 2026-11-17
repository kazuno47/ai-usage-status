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
test('a CLI that never exits fails at the deadline, is force-stopped, and does not block the next fetch', async () => {
  const original = childProcess.execFile;
  const signals = [];
  let lateCallback, respond = false;
  childProcess.execFile = (_command, _args, options, callback) => {
    assert.equal(options.timeout, 20);
    if (respond) queueMicrotask(() => callback(null, '{"providers":[{"id":"codex","error":null,"windows":[]}]}'));
    else lateCallback = callback; // Never called before the deadline: the process ignores SIGTERM.
    return { kill(signal) { signals.push(signal); return true; } };
  };
  try {
    const client = new CodexBarClient(20, 10);
    await assert.rejects(client.fetch(), e => e.kind === 'execution');
    assert.deepEqual(signals, ['SIGTERM']);
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
    respond = true;
    const next = client.fetch();
    lateCallback({killed:true}, ''); // The old process finally exits: its callback must not touch the new fetch.
    assert.equal((await next)[0].id, 'codex');
    client.dispose();
    assert.deepEqual(signals, ['SIGTERM', 'SIGKILL'], 'nothing is left to stop after a completed fetch');
  } finally { childProcess.execFile = original; }
});
