import { execFile, ChildProcess } from 'node:child_process';
import { parseUsage, ProviderUsage } from './usageParser';
export class UsageError extends Error {
  constructor(public readonly kind: 'missing' | 'execution' | 'json') {
    super(kind === 'missing' ? 'codexbar が PATH 上に見つかりません。CodexBar CLIをインストールし、Cursor / VS Codeを再起動してください。'
      : kind === 'json' ? 'CodexBarのJSON出力を読み取れませんでした。次回の更新で再試行します。'
        : 'CodexBarのUsage取得に失敗しました（実行エラーまたはタイムアウト）。次回の更新で再試行します。');
  }
}
export class CodexBarClient {
  private child?: ChildProcess;
  constructor(private readonly timeoutMs = 45_000, private readonly killGraceMs = 2_000) {}
  fetch(): Promise<ProviderUsage[]> {
    return new Promise((resolve, reject) => {
      let settled = false;
      // execFile's timeout only sends SIGTERM and calls back after the process has exited. A CLI that ignores
      // the signal would leave this promise pending forever and block every later refresh, so the deadline is
      // enforced here: fail the fetch, then force the process to stop.
      const deadline = setTimeout(() => {
        settle(() => reject(new UsageError('execution')));
        child.kill('SIGTERM');
        setTimeout(() => { child.kill('SIGKILL'); }, this.killGraceMs).unref();
      }, this.timeoutMs);
      const settle = (finish: () => void): void => {
        if (settled) return; // A callback that arrives after the deadline is ignored.
        settled = true;
        clearTimeout(deadline);
        if (this.child === child) this.child = undefined;
        finish();
      };
      const child = execFile('codexbar', ['dashboard', '--identity', 'redacted'], { timeout: this.timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8', windowsHide: true }, (error, stdout) => settle(() => {
        // Some dashboards can return usable per-provider data with a nonzero exit.
        if (error && (error.code === 'ENOENT' || error.killed || !stdout.trim())) {
          reject(new UsageError(error.code === 'ENOENT' ? 'missing' : 'execution')); return;
        }
        try { resolve(parseUsage(stdout)); } catch { reject(new UsageError(error ? 'execution' : 'json')); }
      }));
      this.child = child;
    });
  }
  dispose(): void { this.child?.kill(); }
}
