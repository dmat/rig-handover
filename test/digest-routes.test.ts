import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

type Body = { night: string; rows: { job: string }[]; badLines: number };

const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const line = (job: string, status: string, at: string) =>
  JSON.stringify({ at, job, status, owner: 'ops', error: status === 'ok' ? null : 'boom' });

writeFileSync(
  join(runsDir, '2026-10-01.jsonl'),
  [line('b/job', 'ok', '2026-10-01T01:00:00+01:00'), line('a/job', 'fail', '2026-10-01T01:05:00+01:00'), ''].join('\n'),
);
writeFileSync(join(runsDir, '2026-10-02.jsonl'), '');
writeFileSync(
  join(runsDir, '2026-10-03.jsonl'),
  [line('a/job', 'ok', '2026-10-03T01:00:00+01:00'), 'not json', ''].join('\n'),
);

const app = createApp({ adapter: 'x', installed: 'x', beatEverySeconds: 1, runsDir });

describe('GET /digest/:night', () => {
  it('200 for a night with a file', async () => {
    const res = await app.request('/digest/2026-10-01');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('a/job');
    expect(html).toContain('b/job');
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/digest/2026-10-09')).status).toBe(404);
  });

  it('says nothing ran for the empty night', async () => {
    const res = await app.request('/digest/2026-10-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still 200 with a bad line, and counts it', async () => {
    const res = await app.request('/digest/2026-10-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('1 lines did not parse');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 for a night with a file', async () => {
    const res = await app.request('/api/digest/2026-10-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.night).toBe('2026-10-01');
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
    expect(body.badLines).toBe(0);
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/api/digest/2026-10-09')).status).toBe(404);
  });

  it('has no rows for the empty night', async () => {
    const res = await app.request('/api/digest/2026-10-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-02', rows: [], badLines: 0 });
  });

  it('still 200 with a bad line, and counts it', async () => {
    const res = await app.request('/api/digest/2026-10-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.rows).toHaveLength(1);
    expect(body.badLines).toBe(1);
  });
});
