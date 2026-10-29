import { readNight } from './types.js';

export type NightCounts = { ok: number; retry: number; fail: number };

// Counts of runs (log lines) by status; null when the night has no file.
export function nightCounts(runsDir: string, night: string): NightCounts | null {
  const n = readNight(runsDir, night);
  if (n.kind === 'missing') return null;
  const total = { ok: 0, retry: 0, fail: 0 };
  for (const r of n.rows) {
    total.retry += r.retries;
    total.fail += r.fails;
    total.ok += r.runs - r.retries - r.fails;
  }
  return total;
}
