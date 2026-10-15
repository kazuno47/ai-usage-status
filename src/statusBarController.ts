import * as vscode from 'vscode';
import { PROVIDERS, ProviderUsage, statusText, formatReset } from './usageParser';
export class StatusBarController implements vscode.Disposable {
  private providers: ProviderUsage[] = [];
  private error?: string;
  private readonly items = PROVIDERS.map((def, index) => {
    const item = vscode.window.createStatusBarItem(`aiUsageStatus.${def.id}`, vscode.StatusBarAlignment.Right, 10000 - index);
    item.name = `AI Usage: ${def.name}`;
    item.command = { command: 'aiUsageStatus.details', title: 'Usage details', arguments: [def.id] };
    item.text = statusText(def);
    item.tooltip = `${def.name}: Usage取得中…`;
    item.show();
    return item;
  });
  update(providers: ProviderUsage[], error?: string): void {
    this.providers = providers; this.error = error;
    PROVIDERS.forEach((def, i) => {
      const p = providers.find(p => p.id === def.id);
      this.items[i].text = statusText(def, error ? undefined : p);
      this.items[i].tooltip = error ?? `${def.name}: ${!p ? 'Providerなし' : p.failed ? '取得エラー' : '残量 (%) — クリックで詳細'}`;
      this.items[i].accessibilityInformation = { label: `${def.name}: ${this.items[i].text}, remaining percent` };
    });
  }
  async showDetails(id?: string): Promise<void> {
    const rows: vscode.QuickPickItem[] = [];
    for (const def of PROVIDERS.filter(p => !id || p.id === id)) {
      rows.push({ label: def.name, kind: vscode.QuickPickItemKind.Separator });
      const provider = this.providers.find(p => p.id === def.id);
      if (this.error || !provider || provider.failed) {
        rows.push({ label: this.error ?? (provider ? 'Usage取得エラー' : 'ProviderがJSON内にありません') });
        continue;
      }
      for (const w of provider.windows) rows.push({
        label: w.label.replace(/[\r\n\t]/g, ' ').replace(/\$\(/g, '('),
        description: `Remaining ${w.remainingPercent ?? '--'}%, Used ${w.usedPercent ?? '--'}%`,
        detail: `Reset ${formatReset(w.resetAt)} (local time)`,
      });
      if (!provider.windows.length) rows.push({ label: 'Quota windowがありません' });
    }
    await vscode.window.showQuickPick(rows, { title: 'AI Usage — CodexBar', placeHolder: 'S: Session / W: Weekly / G: Gemini Weekly / 3P: Claude/GPT Weekly', matchOnDescription: true, matchOnDetail: true });
  }
  dispose(): void { this.items.forEach(item => item.dispose()); }
}
