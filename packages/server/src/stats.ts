/**
 * Anonymous meta tracking: which mages get picked online and how they do.
 *
 * Only aggregate counts are kept, bucketed by UTC day and by mode (quick match vs friend
 * battle). No names, IPs, ids or anything else about players is recorded.
 *
 * Persisted as one JSON file when a data directory is configured (a Fly volume in production);
 * otherwise it lives in memory and resets on restart.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CHARACTERS, MatchEndReason, PlayerIndex } from '@magepop/core';

export type StatsMode = 'quick' | 'friend';

interface MageTally {
  picks: number;
  wins: number;
  losses: number;
}

interface PairTally {
  games: number;
  /** Wins for the alphabetically first mage of the pair ("a|b" key). */
  aWins: number;
  bWins: number;
  draws: number;
}

interface DayTally {
  matches: number;
  totalMs: number;
  reasons: Partial<Record<MatchEndReason, number>>;
  mages: Record<string, MageTally>;
  pairs: Record<string, PairTally>;
}

interface StatsFile {
  version: 1;
  since: string;
  days: Record<string, Partial<Record<StatsMode, DayTally>>>;
}

export interface FinishedMatch {
  mages: [string, string];
  winner: PlayerIndex | null;
  reason: MatchEndReason;
  durationMs: number;
  mode: StatsMode;
  /** For tests; defaults to now. */
  at?: Date;
}

/** Days of history kept (older days are dropped). */
const KEEP_DAYS = 400;
/** Matches shorter than this (instant forfeits, rage quits) say nothing about balance. */
const MIN_COUNTED_MS = 15_000;
const FILE = 'meta-stats.json';

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const emptyDay = (): DayTally => ({ matches: 0, totalMs: 0, reasons: {}, mages: {}, pairs: {} });
const knownMage = (id: string) => CHARACTERS.some((c) => c.id === id);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);

export class MetaStats {
  private data: StatsFile = { version: 1, since: new Date().toISOString(), days: {} };
  private dirty = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private cache = new Map<string, { at: number; body: string }>();

  constructor(
    private readonly dir: string | null,
    private readonly log: (m: string) => void = () => {},
  ) {}

  /** Load saved stats and start periodic saving. Safe to call without a data directory. */
  async start(flushEveryMs = 60_000) {
    if (this.dir) {
      try {
        const raw = JSON.parse(await readFile(join(this.dir, FILE), 'utf8')) as StatsFile;
        if (raw && raw.version === 1 && typeof raw.days === 'object') this.data = raw;
        this.log(`stats: loaded ${Object.keys(this.data.days).length} days`);
      } catch {
        this.log('stats: starting fresh');
      }
    } else {
      this.log('stats: no STATS_DIR, keeping meta stats in memory only');
    }
    this.flushTimer = setInterval(() => void this.flush(), flushEveryMs);
    this.flushTimer.unref();
  }

  async stop() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }

  /** Write to disk if anything changed (atomic: temp file, then rename). */
  async flush() {
    if (!this.dir || !this.dirty) return;
    this.dirty = false;
    try {
      await mkdir(this.dir, { recursive: true });
      const tmp = join(this.dir, `${FILE}.tmp`);
      await writeFile(tmp, JSON.stringify(this.data));
      await rename(tmp, join(this.dir, FILE));
    } catch (e) {
      this.dirty = true;
      this.log(`stats: save failed (${(e as Error).message})`);
    }
  }

  record(m: FinishedMatch) {
    if (m.reason === 'server' || m.durationMs < MIN_COUNTED_MS) return;
    if (!m.mages.every(knownMage)) return;
    const key = dayKey(m.at ?? new Date());
    const day = (this.data.days[key] ??= {});
    const t = (day[m.mode] ??= emptyDay());
    t.matches++;
    t.totalMs += Math.round(m.durationMs);
    t.reasons[m.reason] = (t.reasons[m.reason] ?? 0) + 1;
    m.mages.forEach((id, seat) => {
      const s = (t.mages[id] ??= { picks: 0, wins: 0, losses: 0 });
      s.picks++;
      if (m.winner === seat) s.wins++;
      else if (m.winner !== null) s.losses++;
    });
    const [x, y] = m.mages;
    if (x !== y) {
      const [a, b] = [x, y].sort();
      const p = (t.pairs[`${a}|${b}`] ??= { games: 0, aWins: 0, bWins: 0, draws: 0 });
      p.games++;
      if (m.winner === null) p.draws++;
      else if (m.mages[m.winner] === a) p.aWins++;
      else p.bWins++;
    }
    this.prune();
    this.dirty = true;
    this.cache.clear();
  }

  private prune() {
    const keys = Object.keys(this.data.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete this.data.days[k];
  }

  /** Aggregate over the last `days` days for one mode (or both). */
  summary(days: number, mode: StatsMode | 'all', now = new Date()) {
    const from = dayKey(new Date(now.getTime() - (days - 1) * 86_400_000));
    const modes: StatsMode[] = mode === 'all' ? ['quick', 'friend'] : [mode];
    const total = emptyDay();
    const daily: { date: string; matches: number }[] = [];
    for (const [date, byMode] of Object.entries(this.data.days).sort(([a], [b]) => a.localeCompare(b))) {
      if (date < from) continue;
      let n = 0;
      for (const md of modes) {
        const t = byMode[md];
        if (!t) continue;
        n += t.matches;
        total.matches += t.matches;
        total.totalMs += t.totalMs;
        for (const [r, c] of Object.entries(t.reasons)) total.reasons[r as MatchEndReason] = (total.reasons[r as MatchEndReason] ?? 0) + (c ?? 0);
        for (const [id, s] of Object.entries(t.mages)) {
          const a = (total.mages[id] ??= { picks: 0, wins: 0, losses: 0 });
          a.picks += s.picks;
          a.wins += s.wins;
          a.losses += s.losses;
        }
        for (const [k, p] of Object.entries(t.pairs)) {
          const a = (total.pairs[k] ??= { games: 0, aWins: 0, bWins: 0, draws: 0 });
          a.games += p.games;
          a.aWins += p.aWins;
          a.bWins += p.bWins;
          a.draws += p.draws;
        }
      }
      daily.push({ date, matches: n });
    }
    const picksTotal = Object.values(total.mages).reduce((t, s) => t + s.picks, 0);
    return {
      mode,
      days,
      trackingSince: this.data.since,
      matches: total.matches,
      avgMatchSec: total.matches ? Math.round(total.totalMs / total.matches / 1000) : null,
      endedBy: total.reasons,
      mages: CHARACTERS.map((c) => {
        const s = total.mages[c.id] ?? { picks: 0, wins: 0, losses: 0 };
        return { id: c.id, picks: s.picks, pickRate: pct(s.picks, picksTotal), wins: s.wins, losses: s.losses, winRate: pct(s.wins, s.wins + s.losses) };
      }).sort((a, b) => b.picks - a.picks),
      matchups: Object.entries(total.pairs)
        .map(([k, p]) => {
          const [a, b] = k.split('|');
          return { a, b, games: p.games, aWinRate: pct(p.aWins, p.aWins + p.bWins), draws: p.draws };
        })
        .sort((x, y) => y.games - x.games),
      daily,
    };
  }

  /** JSON for GET /stats, cached briefly so the endpoint stays cheap. */
  json(days: number, mode: StatsMode | 'all') {
    const key = `${days}:${mode}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.body;
    const body = JSON.stringify(this.summary(days, mode), null, 2);
    this.cache.set(key, { at: Date.now(), body });
    return body;
  }
}
