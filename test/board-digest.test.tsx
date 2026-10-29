import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const row = (job: string, runs: number, retries: number, fails: number): DigestRow => ({
  job, owner: null, runs, retries, fails, lastStatus: 'ok', lastError: null,
  firstAt: '2026-10-28T23:00:00+01:00', lastAt: '2026-10-29T01:00:00+01:00',
});

// Stand-in for the reader (issue #2): one night has rows, the other is an empty file.
vi.mock('../src/digest/types.js', () => ({
  readNight: (_dir: string, night: string) => ({
    kind: 'found',
    night,
    badLines: 0,
    rows: night === '2026-10-28' ? [row('a', 4, 1, 1), row('b', 2, 0, 0)] : [],
  }),
}));

describe('board digest links', () => {
  it('links each night with its ok / retry / fail counts', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-'));
    writeFileSync(join(runsDir, '2026-10-27.jsonl'), '');
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const config = { adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir };
    const html = await (await createApp(config).request('/')).text();
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('ok 4 · retry 1 · fail 1');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
    expect(html).toContain('ok 0 · retry 0 · fail 0');
  });
});
