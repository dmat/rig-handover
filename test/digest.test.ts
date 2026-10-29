import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight, type DigestRow } from '../src/digest/types.js';

function found(runsDir: string, night: string) {
  const result = readNight(runsDir, night);
  if (result.kind !== 'found') throw new Error(`expected ${night} to be found`);
  return result;
}

function row(rows: DigestRow[], job: string): DigestRow {
  const match = rows.find((r) => r.job === job);
  if (!match) throw new Error(`no row for ${job}`);
  return match;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = found('runs', '2026-10-28');

  it('reads 5 jobs and counts 1 bad line', () => {
    expect(night.night).toBe('2026-10-28');
    expect(night.rows.map((r) => r.job)).toEqual([
      'rig/rotate-logs',
      'lane/sync',
      'fixtures/refresh',
      'notes/backup',
      'digest/render',
    ]);
    expect(night.badLines).toBe(1);
  });

  it('counts runs and retries, keeps the latest error, keeps the offset', () => {
    expect(row(night.rows, 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      fails: 0,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(row(night.rows, 'lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('records a failure', () => {
    expect(row(night.rows, 'notes/backup')).toMatchObject({ fails: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row whose owner is null', () => {
    expect(row(night.rows, 'digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });
});

describe('readNight edges', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(dir, '2026-01-01.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-02.jsonl'),
    [
      '{"at":"2026-01-02T01:00:00-05:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-02T02:00:00-05:00","job":"a","status":"maybe","owner":"x"}',
      '[1,2]',
      '{"job":"a","status":"ok","owner":"x"}',
      '',
    ].join('\n'),
  );

  it('a night with no file is missing', () => {
    expect(readNight(dir, '2026-01-09')).toEqual({ kind: 'missing', night: '2026-01-09' });
  });

  it('a night that is not a date is missing, never read', () => {
    expect(readNight(dir, '../2026-01-02')).toEqual({ kind: 'missing', night: '../2026-01-02' });
  });

  it('an empty file is found with no rows', () => {
    expect(readNight(dir, '2026-01-01')).toEqual({ kind: 'found', night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts lines of the wrong shape as bad, ignores blank lines', () => {
    const result = found(dir, '2026-01-02');
    expect(result.badLines).toBe(3);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ runs: 1, firstAt: '2026-01-02T01:00:00-05:00' });
  });
});
