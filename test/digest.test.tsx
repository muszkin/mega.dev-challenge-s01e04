import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
const app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });

const line = (at: string, job: string, status: string, extra: object = {}) =>
  JSON.stringify({ at, job, status, owner: 'ops', ...extra });

beforeAll(() => {
  writeFileSync(
    join(dir, '2026-10-01.jsonl'),
    [
      line('2026-10-01T01:00:00+01:00', 'sync', 'retry'),
      line('2026-10-01T01:05:00+01:00', 'sync', 'retry'),
      line('2026-10-01T01:10:00+01:00', 'sync', 'retry'),
      line('2026-10-01T01:15:00+01:00', 'sync', 'ok'),
      line('2026-10-01T02:00:00+01:00', 'backup', 'fail', { error: 'disk full' }),
      line('2026-10-01T03:00:00+01:00', 'cleanup', 'ok'),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, '2026-10-02.jsonl'), '');
  writeFileSync(
    join(dir, '2026-10-03.jsonl'),
    [line('2026-10-03T01:00:00+01:00', 'sync', 'ok'), '{not json', line('2026-10-03T02:00:00+01:00', 'backup', 'ok')].join('\n'),
  );
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const json = async (path: string) => {
  const res = await app.request(path);
  return { status: res.status, body: (await res.json()) as Night };
};
const html = async (path: string) => {
  const res = await app.request(path);
  return { status: res.status, body: await res.text() };
};
const jobsInPage = (page: string) => [...page.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]);

describe('GET /api/digest/:night', () => {
  it('returns the rows for a good night', async () => {
    const { status, body } = await json('/api/digest/2026-10-01');
    expect(status).toBe(200);
    expect(body.rows.map((r) => r.job)).toEqual(['backup', 'cleanup', 'sync']);
    expect(body.rows.find((r) => r.job === 'sync')).toMatchObject({ runs: 4, retries: 3, fails: 0, lastStatus: 'ok' });
    expect(body.rows.find((r) => r.job === 'backup')).toMatchObject({ fails: 1, lastStatus: 'fail', lastError: 'disk full' });
    expect(body.badLines).toBe(0);
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/api/digest/2026-09-30')).status).toBe(404);
  });

  it('returns no rows for an empty night', async () => {
    const { status, body } = await json('/api/digest/2026-10-02');
    expect(status).toBe(200);
    expect(body.rows).toEqual([]);
  });

  it('counts a bad line and keeps the good ones', async () => {
    const { status, body } = await json('/api/digest/2026-10-03');
    expect(status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['backup', 'sync']);
  });
});

describe('GET /digest/:night', () => {
  it('renders a row per job for a good night', async () => {
    const { status, body } = await html('/digest/2026-10-01');
    expect(status).toBe(200);
    expect(jobsInPage(body)).toEqual(['backup', 'cleanup', 'sync']);
    expect(body).toContain('disk full');
    expect(body).not.toContain('did not parse');
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/digest/2026-09-30')).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const { status, body } = await html('/digest/2026-10-02');
    expect(status).toBe(200);
    expect(body).toContain('nothing ran');
  });

  it('notes the line that did not parse', async () => {
    const { status, body } = await html('/digest/2026-10-03');
    expect(status).toBe(200);
    expect(body).toContain('1 line(s) did not parse');
    expect(jobsInPage(body)).toEqual(['backup', 'sync']);
  });

  it('lists the same jobs in the same order as the JSON', async () => {
    const page = await html('/digest/2026-10-01');
    const data = await json('/api/digest/2026-10-01');
    expect(jobsInPage(page.body)).toEqual(data.body.rows.map((r) => r.job));
  });
});
