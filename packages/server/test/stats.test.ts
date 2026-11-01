import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MetaStats } from '../src/stats';
import { PvpServer } from '../src/server';

const at = new Date('2026-11-01T12:00:00Z');
const match = (o: Partial<Parameters<MetaStats['record']>[0]> = {}) => ({
  mages: ['ember', 'rime'] as [string, string],
  winner: 0 as const,
  reason: 'ko' as const,
  durationMs: 90_000,
  mode: 'quick' as const,
  at,
  ...o,
});

describe('meta stats', () => {
  it('counts picks, wins and matchups per mode', () => {
    const s = new MetaStats(null);
    s.record(match());
    s.record(match({ winner: 1 }));
    s.record(match({ mages: ['rime', 'ember'], winner: 0 }));
    s.record(match({ mode: 'friend', mages: ['nyx', 'nyx'], winner: 1 }));
    const q = s.summary(30, 'quick', at);
    expect(q.matches).toBe(3);
    const ember = q.mages.find((m) => m.id === 'ember')!;
    const rime = q.mages.find((m) => m.id === 'rime')!;
    expect([ember.picks, ember.wins, ember.losses]).toEqual([3, 1, 2]);
    expect([rime.wins, rime.losses]).toEqual([2, 1]);
    expect(q.matchups).toEqual([{ a: 'ember', b: 'rime', games: 3, aWinRate: 33.3, draws: 0 }]);
    // Mirror matches count picks but not matchups; modes stay separate.
    const all = s.summary(30, 'all', at);
    expect(all.matches).toBe(4);
    expect(all.mages.find((m) => m.id === 'nyx')!.picks).toBe(2);
    expect(all.matchups).toHaveLength(1);
  });

  it('ignores server shutdowns, very short games, unknown mages and old days', () => {
    const s = new MetaStats(null);
    s.record(match({ reason: 'server' }));
    s.record(match({ durationMs: 3000, reason: 'forfeit' }));
    s.record(match({ mages: ['ember', 'nobody'] }));
    s.record(match({ at: new Date('2026-09-01T00:00:00Z') }));
    expect(s.summary(30, 'all', at).matches).toBe(0);
    expect(s.summary(90, 'all', at).matches).toBe(1);
  });

  it('saves to disk and loads back, with no player data in the file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mp-stats-'));
    try {
      const a = new MetaStats(dir);
      await a.start();
      a.record(match());
      await a.stop();
      const text = await readFile(join(dir, 'meta-stats.json'), 'utf8');
      expect(text).not.toMatch(/ip|name|token/i);
      const b = new MetaStats(dir);
      await b.start();
      expect(b.summary(30, 'all', at).matches).toBe(1);
      await b.stop();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('GET /stats', () => {
  let server: PvpServer | null = null;
  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('serves the summary as JSON and clamps bad parameters', async () => {
    server = new PvpServer({ port: 0, log: () => {} });
    const port = await server.listen();
    server.meta.record(match({ at: new Date() }));
    const res = await fetch(`http://127.0.0.1:${port}/stats?days=7&mode=quick`);
    expect(res.headers.get('content-type')).toBe('application/json');
    const body = await res.json();
    expect(body).toMatchObject({ mode: 'quick', days: 7, matches: 1 });
    const weird = await (await fetch(`http://127.0.0.1:${port}/stats?days=99999&mode=<script>`)).json();
    expect(weird).toMatchObject({ mode: 'all', days: 30 });
    expect((await fetch(`http://127.0.0.1:${port}/stats/../health`)).status).toBeLessThan(500);
  });
});
