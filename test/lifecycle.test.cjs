const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
test('startup, 60-second polling, no overlap, failure recovery and disposal', async () => {
  const load = Module._load, interval = global.setInterval, clear = global.clearInterval;
  const items = [];
  let tick, pending, fetches = 0, stopped = false;
  const { CodexBarClient } = require('../dist/codexBarClient');
  const originalFetch = CodexBarClient.prototype.fetch;
  CodexBarClient.prototype.fetch = () => { fetches++; return new Promise((resolve, reject) => { pending = {resolve, reject}; }); };
  Module._load = function(id, ...args) {
    if (id === 'vscode') return {
      window: { createStatusBarItem: () => { const item = {show(){},dispose(){this.disposed=true;}}; items.push(item); return item; }, showErrorMessage(){} },
      commands: {registerCommand: () => ({dispose(){}})}, StatusBarAlignment: {Right:2},
    };
    return load.call(this, id, ...args);
  };
  global.setInterval = (callback, ms) => { assert.equal(ms,60000); tick=callback; return 123; };
  global.clearInterval = id => { assert.equal(id,123); stopped=true; };
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const context = {subscriptions:[]};
  try {
    require('../dist/extension').activate(context);
    assert.equal(fetches,1);
    tick(); assert.equal(fetches,1);
    pending.resolve([{id:'codex',failed:false,windows:[{kind:'session',label:'Session',remainingPercent:92}]}]);
    await settle(); assert.equal(items[0].text,'Codex S92 W--');
    tick(); assert.equal(fetches,2);
    pending.reject(new Error('secret backend error'));
    await settle(); assert.equal(items[0].text,'Codex S-- W--');
    assert.ok(!items[0].tooltip.includes('secret'));
    tick(); pending.resolve([]); await settle();
    assert.equal(fetches,3);
    context.subscriptions.forEach(d=>d.dispose());
    assert.ok(stopped); assert.ok(items.every(i=>i.disposed));
    tick(); assert.equal(fetches,3);
  } finally {
    Module._load=load; global.setInterval=interval; global.clearInterval=clear;
    CodexBarClient.prototype.fetch=originalFetch;
  }
});
