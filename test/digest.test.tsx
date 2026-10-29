import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DigestRow, Night } from '../src/digest/types.js';

const readNight = vi.fn<(dir: string, night: string) => Night>();
vi.mock('../src/digest/types.js', () => ({ readNight: (d: string, n: string) => readNight(d, n) }));

const { createApp } = await import('../src/app.js');
const config = { adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: 'tmp-runs' };

const row = (o: Partial<DigestRow>): DigestRow => ({
  job: 'a', owner: 'sam', runs: 1, retries: 0, fails: 0, lastStatus: 'ok', lastError: null,
  firstAt: '2026-10-29T01:00:00+01:00', lastAt: '2026-10-29T01:30:00+01:00', ...o,
});

describe('digest page', () => {
  beforeEach(() => readNight.mockReset());

  it('renders sorted rows, flags, dashes and bad lines', async () => {
    readNight.mockReturnValue({
      kind: 'found', night: '2026-10-28', badLines: 2,
      rows: [row({ job: 'zeta', retries: 3 }), row({ job: 'alpha', owner: null, fails: 1, lastStatus: 'fail' })],
    });
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane-07');
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('2 lines did not parse');
    expect(html).toContain('<td>retries</td>');
    expect(html).toContain('<td>fail</td>');
    expect(html).toContain('<td>—</td>');
    expect(html).not.toContain('<td></td>');
    expect(readNight).toHaveBeenCalledWith('tmp-runs', '2026-10-28');
  });

  it('says nothing ran for an empty night', async () => {
    readNight.mockReturnValue({ kind: 'found', night: '2026-10-28', rows: [], badLines: 0 });
    const res = await createApp(config).request('/digest/2026-10-28');
    expect(await res.text()).toContain('nothing ran');
  });

  it('404s on a missing night', async () => {
    readNight.mockReturnValue({ kind: 'missing', night: '2026-10-01' });
    expect((await createApp(config).request('/digest/2026-10-01')).status).toBe(404);
  });

  it('rejects a malformed night before the reader', async () => {
    expect((await createApp(config).request('/digest/..%2Fsecret')).status).toBe(404);
    expect((await createApp(config).request('/digest/2026-1-1')).status).toBe(404);
    expect(readNight).not.toHaveBeenCalled();
  });
});
