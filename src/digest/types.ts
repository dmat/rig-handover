// The night's run log, one row per job. Section 2 builds against these types only.
export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  fails: number;
  lastStatus: RunStatus;
  lastError: string | null;
  // As written in the log, offset kept (e.g. "2026-10-29T01:30:00+01:00").
  firstAt: string;
  lastAt: string;
};

// No file for the night, or the night's rows. An empty file is `found` with no rows;
// lines that did not parse are counted in `badLines`, never thrown.
export type Night =
  | { kind: 'missing'; night: string }
  | { kind: 'found'; night: string; rows: DigestRow[]; badLines: number };

export { readNight } from './read.js';
