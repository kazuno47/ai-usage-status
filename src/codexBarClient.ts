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
  fetch(): Promise<ProviderUsage[]> {
    return new Promise((resolve, reject) => {
      this.child = execFile('codexbar', ['dashboard', '--identity', 'redacted'], { timeout: 45_000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8', windowsHide: true }, (error, stdout) => {
        this.child = undefined;
        // Some dashboards can return usable per-provider data with a nonzero exit.
        if (error && (error.code === 'ENOENT' || error.killed || !stdout.trim())) {
          reject(new UsageError(error.code === 'ENOENT' ? 'missing' : 'execution')); return;
        }
        try { resolve(parseUsage(stdout)); } catch { reject(new UsageError(error ? 'execution' : 'json')); }
      });
    });
  }
  dispose(): void { this.child?.kill(); }
}
