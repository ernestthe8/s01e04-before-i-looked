import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

// runs/ is read-only: real nights are only read; everything else goes to a temp dir.
const tempRuns = () => mkdtempSync(join(tmpdir(), 'rig-runs-'));

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('finds 5 jobs and 1 bad line, sorted by job', () => {
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('folds fixtures/refresh into one row', () => {
    expect(night?.rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps digest/render with owner null', () => {
    const row = night?.rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
    expect(row?.lastError).toBeNull();
  });
});

describe('readNight edge cases', () => {
  it('returns null when there is no file', () => {
    expect(readNight(tempRuns(), '2026-01-01')).toBeNull();
  });

  it('reads an empty file as nothing ran', () => {
    const dir = tempRuns();
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts garbage and wrong-shape lines, never throws', () => {
    const dir = tempRuns();
    const ok = '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"x"}';
    const lines = [ok, 'not json', '{"at":"t","job":"b","status":"maybe","owner":"x"}', '[]', ''];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n') + '\n');
    const night = readNight(dir, '2026-01-03');
    expect(night?.badLines).toBe(3);
    expect(night?.rows.map((r) => r.job)).toEqual(['a']);
  });
});
