import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, RunStatus } from './types.js';

type LogLine = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies RunStatus[];

// One log line, or null if it is not JSON or not the shape we expect.
function parseLine(text: string): LogLine | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { at, job, status, owner, error } = value as Record<string, unknown>;
  if (typeof at !== 'string' || typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return { at, job, status: status as RunStatus, owner, error: error ?? null };
}

// Rows come out in the order each job first appears in the log; lines are taken in file order.
// `lastError` is the latest error the job reported, even if a later run went ok.
export function readNight(runsDir: string, night: string): Night {
  // The night comes from a URL: anything but a date is not a file we have.
  if (!NIGHT.test(night)) return { kind: 'missing', night };

  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing', night };
    throw err;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    let row = rows.get(line.job);
    if (!row) {
      row = {
        job: line.job,
        owner: line.owner,
        runs: 0,
        retries: 0,
        fails: 0,
        lastStatus: line.status,
        lastError: null,
        firstAt: line.at,
        lastAt: line.at,
      };
      rows.set(line.job, row);
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    if (line.status === 'fail') row.fails++;
    row.owner = line.owner;
    row.lastStatus = line.status;
    row.lastAt = line.at;
    if (line.error !== null) row.lastError = line.error;
  }
  return { kind: 'found', night, rows: [...rows.values()], badLines };
}
