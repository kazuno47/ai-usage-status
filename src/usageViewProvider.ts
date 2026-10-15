import * as vscode from 'vscode';
import { PROVIDERS, ProviderUsage, quotaValues } from './usageParser';

export class UsageViewProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
  private providers: ProviderUsage[] = [];
  private error?: string;
  private readonly changes = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changes.event;

  update(providers: ProviderUsage[], error?: string): void {
    this.providers = providers;
    this.error = error;
    this.changes.fire();
  }

  getTreeItem(item: vscode.TreeItem): vscode.TreeItem { return item; }

  getChildren(): vscode.TreeItem[] {
    return PROVIDERS.map(def => {
      const provider = this.providers.find(candidate => candidate.id === def.id);
      const values = quotaValues(def, this.error ? undefined : provider);
      const item = new vscode.TreeItem(def.name, vscode.TreeItemCollapsibleState.None);
      item.id = `aiUsageStatus.view.${def.id}`;
      item.description = values.map(value =>
        `${value.short} ${value.remainingPercent === undefined ? '--' : Math.round(value.remainingPercent)}%`
      ).join('   ');
      item.command = {
        command: 'aiUsageStatus.details',
        title: `${def.name} Usage Details`,
        arguments: [def.id],
      };
      const tooltip = new vscode.MarkdownString(undefined, true);
      tooltip.appendMarkdown(`**${def.name}**\n\n`);
      for (const value of values) {
        tooltip.appendMarkdown(`${value.short} — ${value.name}: ${value.remainingPercent === undefined ? '--' : Math.round(value.remainingPercent)}% remaining\n\n`);
      }
      if (this.error) tooltip.appendMarkdown(this.error);
      else if (!provider) tooltip.appendMarkdown('Provider is not present in the CodexBar response.');
      else if (provider.failed) tooltip.appendMarkdown('CodexBar could not retrieve this provider.');
      else tooltip.appendMarkdown('Click to show Remaining, Used, and Reset details.');
      item.tooltip = tooltip;
      item.accessibilityInformation = {
        label: `${def.name}, ${values.map(value => `${value.name} ${value.remainingPercent ?? '--'} percent remaining`).join(', ')}`,
      };
      return item;
    });
  }

  dispose(): void { this.changes.dispose(); }
}
