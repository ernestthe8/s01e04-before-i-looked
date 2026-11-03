// Plan morning-digest § 1. The shared contract for section 2; the reader lands in read.ts.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl. `at` keeps the log's offset; never converted to UTC.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. owner null renders as `—`; lastError null = none logged.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// rows [] = empty file ("nothing ran"). badLines = lines that didn't parse, counted, never thrown.
export type Night = { night: string; rows: DigestRow[]; badLines: number };

// null = no file for that night (route 404s).
export type ReadNight = (runsDir: string, night: string) => Night | null;
