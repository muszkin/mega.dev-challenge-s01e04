// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl.
export type RunLine = { at: string; job: string; status: RunStatus; owner: string | null; error?: string };

// One row per job. Times keep the offset from the log (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null; // owner of the job's last line; null renders as —
  runs: number; // lines for this job
  retries: number; // lines with status retry
  fails: number; // lines with status fail
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line that had one
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse: counted, never thrown
  counts: Record<RunStatus, number>; // lines per status, for the board
};

// null when runs/<night>.jsonl does not exist (→ 404). An empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
