import { describe, expect, it, vi } from 'vitest';
import type { DigestRow, Night } from '../src/digest/types.js';

const row = (job: string): DigestRow => ({
  job,
  owner: null,
  runs: 1,
  retries: 0,
  fails: 0,
  lastStatus: 'ok',
  lastError: null,
  firstAt: '2026-10-29T01:30:00+01:00',
  lastAt: '2026-10-29T01:31:00+01:00',
});

// readNight is issue #2's; stand in for it here.
const nights: Record<string, Night> = {
  '2026-10-28': { kind: 'found', night: '2026-10-28', rows: [row('b'), row('a'), row('c')], badLines: 1 },
  '2026-10-27': { kind: 'found', night: '2026-10-27', rows: [], badLines: 0 },
};
vi.mock('../src/digest/types.js', () => ({
  readNight: (_dir: string, night: string): Night => nights[night] ?? { kind: 'missing', night },
}));

const { createApp } = await import('../src/app.js');
const app = createApp({ adapter: 'x', installed: 'x', beatEverySeconds: 1, runsDir: 'unused' });

describe('GET /api/digest/:night', () => {
  it('returns rows sorted by job', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: DigestRow[]; badLines: number };
    expect(body.rows.map((r) => r.job)).toEqual(['a', 'b', 'c']);
    expect(body.badLines).toBe(1);
  });
  it('returns no rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { rows: unknown[] }).rows).toEqual([]);
  });
  it('404 for a missing night', async () => {
    expect((await app.request('/api/digest/2026-01-01')).status).toBe(404);
  });
  it('rejects non YYYY-MM-DD', async () => {
    expect((await app.request('/api/digest/yesterday')).status).toBe(400);
    expect((await app.request('/api/digest/2026-1-1')).status).toBe(400);
  });
});
