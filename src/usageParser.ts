export interface UsageWindow {
  label: string;
  kind: string;
  remainingPercent?: number;
  usedPercent?: number;
  resetAt?: string;
}
export interface ProviderUsage { id: string; failed: boolean; windows: UsageWindow[] }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const percent = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined;
// Whitelist fields; never carry identity, account data or raw errors into the UI.
export function parseUsage(json: string): ProviderUsage[] {
  const root: unknown = JSON.parse(json);
  if (!record(root) || !Array.isArray(root.providers)) throw new Error('Invalid dashboard structure');
  return root.providers.filter(record).filter(p => typeof p.id === 'string').map(p => ({
    id: (p.id as string).toLowerCase(), failed: p.error !== null && p.error !== undefined,
    windows: (Array.isArray(p.windows) ? p.windows : []).filter(record).map(w => ({
      label: typeof w.label === 'string' ? w.label : 'Quota',
      kind: typeof w.kind === 'string' ? w.kind.toLowerCase() : '',
      remainingPercent: percent(w.remainingPercent), usedPercent: percent(w.usedPercent),
      resetAt: typeof w.resetAt === 'string' && Number.isFinite(Date.parse(w.resetAt)) ? w.resetAt : undefined,
    })),
  }));
}
export interface QuotaDefinition {
  short: string;
  name: string;
  matches: (w: UsageWindow) => boolean;
}
export interface ProviderDefinition { id: string; name: string; shortName: string; quotas: QuotaDefinition[] }
const standard = [
  { short: 'S', name: 'Session', matches: (w: UsageWindow) => w.kind === 'session' || /^session$/i.test(w.label) },
  { short: 'W', name: 'Weekly', matches: (w: UsageWindow) => w.kind === 'weekly' || /^weekly$/i.test(w.label) },
];
export const PROVIDERS: ProviderDefinition[] = [
  { id: 'codex', name: 'Codex', shortName: 'Codex', quotas: standard },
  { id: 'claude', name: 'Claude', shortName: 'Claude', quotas: standard },
  { id: 'antigravity', name: 'Antigravity', shortName: 'AG', quotas: [
    { short: 'G', name: 'Gemini Weekly', matches: w => /gemini.*weekly/.test(w.kind) || /gemini.*weekly/i.test(w.label) },
    { short: '3P', name: 'Claude/GPT Weekly', matches: w => /3p.*weekly/.test(w.kind) || /claude.*gpt.*weekly/i.test(w.label) },
  ] },
];
export interface QuotaValue { short: string; name: string; remainingPercent?: number }
export function quotaValues(def: ProviderDefinition, provider?: ProviderUsage): QuotaValue[] {
  return def.quotas.map(quota => {
    const matches = provider?.windows.filter(quota.matches) ?? [];
    return {
      short: quota.short,
      name: quota.name,
      remainingPercent: !provider?.failed && matches.length === 1 ? matches[0].remainingPercent : undefined,
    };
  });
}
export function statusText(def: ProviderDefinition, provider?: ProviderUsage): string {
  return `${def.shortName} ${quotaValues(def, provider).map(quota => {
    return `${quota.short}${quota.remainingPercent === undefined ? '--' : Math.round(quota.remainingPercent)}`;
  }).join(' ')}`;
}
export function formatReset(resetAt?: string): string {
  return resetAt ? new Date(resetAt).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--';
}
