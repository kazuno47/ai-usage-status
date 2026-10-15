import * as vscode from 'vscode';
import { CodexBarClient, UsageError } from './codexBarClient';
import { StatusBarController } from './statusBarController';
import { UsageViewProvider } from './usageViewProvider';
export function activate(context: vscode.ExtensionContext): void {
  const client = new CodexBarClient();
  const ui = new StatusBarController();
  const usageView = new UsageViewProvider();
  let busy = false, disposed = false, missingNotified = false;
  const refresh = async (): Promise<void> => {
    if (busy || disposed) return;
    busy = true;
    try {
      const providers = await client.fetch();
      if (!disposed) {
        ui.update(providers);
        usageView.update(providers);
        missingNotified = false;
      }
    } catch (error) {
      if (disposed) return;
      const safeError = error instanceof UsageError ? error : new UsageError('execution');
      ui.update([], safeError.message);
      usageView.update([], safeError.message);
      if (safeError.kind === 'missing' && !missingNotified) {
        missingNotified = true;
        void vscode.window.showErrorMessage(safeError.message);
      }
    } finally { busy = false; }
  };
  context.subscriptions.push(
    ui,
    usageView,
    client,
    vscode.window.registerTreeDataProvider('aiUsageStatus.usageView', usageView),
    vscode.commands.registerCommand('aiUsageStatus.details', (id?: string) => ui.showDetails(id)),
  );
  const timer = setInterval(() => { void refresh(); }, 60_000);
  context.subscriptions.push({ dispose: () => { disposed = true; clearInterval(timer); client.dispose(); } });
  void refresh();
}
