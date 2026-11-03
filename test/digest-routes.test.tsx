import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { Night } from '../src/digest/types.js';

// runs/ is read-only: the routes read a temp runs dir written here.
let dir: string;

const config = (): RigConfig => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: dir,
});

const get = (path: string) => createApp(config()).request(path);

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(
    join(dir, '2026-01-01.jsonl'),
    [
      '{"at":"2026-01-01T01:00:00+01:00","job":"b/job","status":"retry","owner":"rook","error":"x"}',
      '{"at":"2026-01-01T01:01:00+01:00","job":"b/job","status":"retry","owner":"rook","error":"x"}',
      '{"at":"2026-01-01T01:02:00+01:00","job":"b/job","status":"retry","owner":"rook","error":"x"}',
      '{"at":"2026-01-01T01:03:00+01:00","job":"b/job","status":"ok","owner":"rook"}',
      '{"at":"2026-01-01T01:04:00+01:00","job":"a/job","status":"fail","owner":null,"error":"boom"}',
      '',
    ].join('\n'),
  );
  writeFileSync(join(dir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-03.jsonl'),
    [
      '{"at":"2026-01-03T01:00:00+01:00","job":"c/job","status":"ok","owner":"rook"}',
      '{not json',
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /digest/:night (page)', () => {
  it('renders 200 with both jobs, sorted by job, null owner as —, and a warn mark', async () => {
    const res = await get('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('a/job');
    expect(html).toContain('b/job');
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html).toContain('—');
    expect(html).toContain('class="warn"');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await get('/digest/2026-01-09');
    expect(res.status).toBe(404);
  });

  it('renders the empty night as "nothing ran"', async () => {
    const res = await get('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders a night with a bad line and still shows the good job', async () => {
    const res = await get('/digest/2026-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('c/job');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('returns 200 with the night rows and no bad lines', async () => {
    const res = await get('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body).toMatchObject({ night: '2026-01-01', badLines: 0 });
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
    const a = body.rows.find((r) => r.job === 'a/job');
    const b = body.rows.find((r) => r.job === 'b/job');
    expect(a?.owner).toBeNull();
    expect(b?.retries).toBe(3);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await get('/api/digest/2026-01-09');
    expect(res.status).toBe(404);
  });

  it('returns 200 with empty rows for the empty night', async () => {
    const res = await get('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.rows).toEqual([]);
  });

  it('returns 200 with one bad line counted and the good row kept', async () => {
    const res = await get('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });

  it('lists jobs in the page in the same order as the JSON rows', async () => {
    const html = await (await get('/digest/2026-01-01')).text();
    const body = (await (await get('/api/digest/2026-01-01')).json()) as Night;
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((x, y) => x - y)).toEqual(positions);
  });
});
