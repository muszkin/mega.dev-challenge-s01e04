import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  it('digests a real night and counts the truncated line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    const { rows, badLines } = night!;
    expect(rows).toHaveLength(5);
    expect(badLines).toBe(1);
    const job = (name: string) => rows.find((r) => r.job === name)!;
    expect(job('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(job('notes/backup')).toMatchObject({ lastStatus: 'fail', fails: 1, lastError: 'quota exceeded' });
    expect(job('digest/render').owner).toBeNull();
    expect(job('fixtures/refresh').firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(rows.map((r) => r.job)).toEqual([...rows.map((r) => r.job)].sort((a, b) => a.localeCompare(b)));
  });

  it('returns null for a missing night', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('reads an empty file as a night with no rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });
});
