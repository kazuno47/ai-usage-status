const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
test('details command: provider filter, every window, remaining/used/reset rows and error rows', async () => {
  const load = Module._load, interval = global.setInterval, clear = global.clearInterval;
  const commands = new Map();
  const picks = [];
  let tick, pending;
  const { CodexBarClient } = require('../dist/codexBarClient');
  const { formatReset } = require('../dist/usageParser');
  const originalFetch = CodexBarClient.prototype.fetch;
  CodexBarClient.prototype.fetch = () => new Promise((resolve, reject) => { pending = {resolve, reject}; });
  Module._load = function(id, ...args) {
    if (id === 'vscode') {
      class EventEmitter {
        constructor() { this.event = listener => { this.listener = listener; return {dispose(){}}; }; }
        fire() { this.listener?.(); }
        dispose() {}
      }
      class TreeItem { constructor(label) { this.label = label; } }
      class MarkdownString {
        constructor() { this.value = ''; }
        appendMarkdown(value) { this.value += value; }
      }
      return {
        window: {
          createStatusBarItem: () => ({show(){},dispose(){}}),
          registerTreeDataProvider: () => ({dispose(){}}),
          showErrorMessage(){},
          showQuickPick: async (rows, options) => { picks.push({rows, options}); },
        },
        commands: {registerCommand: (id, handler) => { commands.set(id, handler); return {dispose(){}}; }},
        StatusBarAlignment: {Right:2}, TreeItemCollapsibleState: {None:0}, QuickPickItemKind: {Separator:-1},
        EventEmitter, TreeItem, MarkdownString,
      };
    }
    return load.call(this, id, ...args);
  };
  global.setInterval = callback => { tick = callback; return 123; };
  global.clearInterval = () => {};
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const context = {subscriptions:[]};
  const details = async id => { await commands.get('aiUsageStatus.details')(id); return picks.at(-1); };
  const separator = label => ({label, kind:-1});
  const resetAt = '2026-01-02T03:04:00Z';
  try {
    require('../dist/extension').activate(context);
    // Before the first result: the provider is simply not there yet.
    assert.deepEqual((await details('codex')).rows, [separator('Codex'), {label:'ProviderがJSON内にありません'}]);
    pending.resolve([
      {id:'codex', failed:false, windows:[
        {kind:'session', label:'Session', remainingPercent:92, usedPercent:8, resetAt},
        {kind:'extra', label:'Extra\t$(icon)', remainingPercent:0, usedPercent:100},
        {kind:'', label:'Quota'},
      ]},
      {id:'claude', failed:true, windows:[]},
      {id:'antigravity', failed:false, windows:[]},
    ]);
    await settle();
    // One provider: only its rows, every window kept (unknown ones too), zero and missing values, local reset time.
    const one = await details('codex');
    assert.notEqual(formatReset(resetAt), '--');
    assert.deepEqual(one.rows, [
      separator('Codex'),
      {label:'Session', description:'Remaining 92%, Used 8%', detail:`Reset ${formatReset(resetAt)} (local time)`},
      {label:'Extra (icon)', description:'Remaining 0%, Used 100%', detail:'Reset -- (local time)'},
      {label:'Quota', description:'Remaining --%, Used --%', detail:'Reset -- (local time)'},
    ]);
    assert.equal(one.options.title, 'AI Usage — CodexBar');
    // No id (command palette): all providers, with the provider error and the empty provider as their own rows.
    const all = await details();
    assert.deepEqual(all.rows.filter(row => row.kind === -1).map(row => row.label), ['Codex', 'Claude', 'Antigravity']);
    assert.deepEqual(all.rows.slice(0, 4), one.rows);
    assert.deepEqual(all.rows.slice(4), [
      separator('Claude'), {label:'Usage取得エラー'},
      separator('Antigravity'), {label:'Quota windowがありません'},
    ]);
    // A failed refresh: the safe message only, never the raw error and never the old values.
    tick(); pending.reject(new Error('secret backend error'));
    await settle();
    const failed = await details('claude');
    assert.equal(failed.rows.length, 2);
    assert.deepEqual(failed.rows[0], separator('Claude'));
    assert.match(failed.rows[1].label, /Usage取得に失敗しました/);
    assert.ok(!JSON.stringify((await details()).rows).includes('secret'));
    assert.ok(!JSON.stringify(picks.at(-1).rows).includes('92'));
    context.subscriptions.forEach(d => d.dispose());
  } finally {
    Module._load = load; global.setInterval = interval; global.clearInterval = clear;
    CodexBarClient.prototype.fetch = originalFetch;
  }
});
