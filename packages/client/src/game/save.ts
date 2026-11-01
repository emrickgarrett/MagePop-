import { STARTER_CHARACTER, STORY, StoryChapter, StoryFight } from '@magepop/core';

export interface Settings {
  /** Panels shake when hit. */
  screenShake: boolean;
  /** Projectiles, board auras and ultimate banners. */
  spellEffects: boolean;
  /** Floating damage / spell text over the boards. */
  combatText: boolean;
  /** Skip intro/outro dialogue when replaying a story fight you've already cleared. */
  skipReplayDialogue: boolean;
  /** Show the controls hint line during battles. */
  battleHints: boolean;
  /** Show and use quick chat in online matches. */
  quickChat: boolean;
  /** Display name for online matches ('' = not chosen yet). */
  playerName: string;
  /** Last mage picked for online matches. */
  pvpMage: string | null;
  /** 0..1 */
  musicVolume: number;
  /** 0..1 */
  sfxVolume: number;
}

/** Win/loss record for one mage in one kind of match. */
export interface RecordStats {
  wins: number;
  losses: number;
  /** Fastest win, in ms. */
  fastestWinMs: number | null;
}

export interface MageStats {
  /** Every fight against a bot: Story, Quick Battle and Endless. */
  bots: RecordStats;
  /** Online matches (once Multiplayer launches). */
  pvp: RecordStats;
}

export type MatchMode = 'story' | 'quick' | 'endless' | 'pvp';

/** One finished match, for the Match History screen. Newest first in SaveData.history. */
export interface MatchRecord {
  /** Epoch ms when the match ended. */
  at: number;
  mode: MatchMode;
  /** e.g. the story fight title or "Wave 3". */
  detail: string;
  player: string;
  opponent: string;
  /** Online: the opponent's display name. */
  opponentName?: string;
  /** Bot difficulty name and id (absent online). */
  level?: string;
  levelId?: string;
  result: 'win' | 'loss' | 'forfeit' | 'draw';
  durationMs: number;
  damageDealt: number;
  damageTaken: number;
  spells: number;
  ultimates: number;
  biggestCombo: number;
  healed: number;
  // Added in 0.3 (older records don't have these).
  gemMatches?: number;
  startHp?: number;
  hpLeft?: number;
  lowestHp?: number;
  maxHp?: number;
  // Added in 0.3.
  /** Endless wave number. */
  wave?: number;
  /** Damage past zero on your winning blow. */
  overkill?: number;
  /** You had frozen gems while stunned at some point. */
  frozenAndStunned?: boolean;
}

export const HISTORY_LIMIT = 200;

export interface SaveData {
  version: 1;
  unlocked: string[];
  /** fight ids completed in story mode */
  storyCleared: string[];
  /** best (fastest) clear time per story fight, in ms */
  storyBest: Record<string, number>;
  endlessBest: { wave: number; characterId: string } | null;
  /** Has seen the How to Play guide (shown before the first battle). */
  seenHowToPlay: boolean;
  history: MatchRecord[];
  /** Unlocked achievement id -> epoch ms. */
  achievements: Record<string, number>;
  /** Lifetime counters (never capped like history). See addTotals. */
  totals: Record<string, number>;
  /** Per-mage records, keyed by character id. */
  mageStats: Record<string, MageStats>;
  settings: Settings;
}

const KEY = 'magepop.save.v1';
/** Saves from before the rename (the game was called TaiwanPop). */
const LEGACY_KEY = 'taiwanpop.save.v1';

export const DEFAULT_SETTINGS: Settings = {
  screenShake: true,
  spellEffects: true,
  combatText: true,
  skipReplayDialogue: false,
  battleHints: true,
  quickChat: true,
  playerName: '',
  pvpMage: null,
  musicVolume: 0.6,
  sfxVolume: 0.8,
};

const fresh = (): SaveData => ({
  version: 1,
  unlocked: [STARTER_CHARACTER],
  storyCleared: [],
  storyBest: {},
  endlessBest: null,
  mageStats: {},
  seenHowToPlay: false,
  history: [],
  achievements: {},
  totals: {},
  settings: { ...DEFAULT_SETTINGS },
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...fresh(),
      ...data,
      storyBest: data.storyBest ?? {},
      mageStats: data.mageStats ?? {},
      history: data.history ?? [],
      achievements: data.achievements ?? {},
      // Saves from before lifetime totals existed: rebuild them from match history.
      totals: data.totals ?? (data.history ?? []).reduceRight((t, m) => totalsWith(t, m), {} as Record<string, number>),
      // Players from before the guide existed who've already won fights don't need it forced on them.
      seenHowToPlay: data.seenHowToPlay ?? (data.storyCleared?.length ?? 0) > 0,
      settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
      unlocked: Array.from(new Set([STARTER_CHARACTER, ...(data.unlocked ?? [])])),
    } as SaveData;
  } catch {
    return fresh();
  }
}

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — progress lives for this session only */
  }
}

/** Wipes progress but keeps the player's settings. */
export function resetProgress(current: SaveData): SaveData {
  const s = { ...fresh(), settings: current.settings };
  writeSave(s);
  return s;
}

/** Mark a story fight cleared; returns the newly unlocked character id, if any. */
export function clearStoryFight(save: SaveData, fightId: string, timeMs: number): { save: SaveData; unlocked: string | null; newBest: boolean } {
  const storyCleared = save.storyCleared.includes(fightId) ? save.storyCleared : [...save.storyCleared, fightId];
  const prevBest = save.storyBest[fightId];
  const newBest = prevBest === undefined || timeMs < prevBest;
  const storyBest = newBest ? { ...save.storyBest, [fightId]: Math.round(timeMs) } : save.storyBest;
  let unlocked: string | null = null;
  const unlockedSet = new Set(save.unlocked);
  for (const ch of STORY) {
    if (ch.unlocks && ch.fights.every((f) => storyCleared.includes(f.id)) && !unlockedSet.has(ch.unlocks)) {
      unlockedSet.add(ch.unlocks);
      unlocked = ch.unlocks;
    }
  }
  const next = { ...save, storyCleared, storyBest, unlocked: [...unlockedSet] };
  writeSave(next);
  return { save: next, unlocked, newBest: newBest && prevBest !== undefined };
}

const emptyRecord = (): RecordStats => ({ wins: 0, losses: 0, fastestWinMs: null });

export function mageStatsOf(save: SaveData, characterId: string): MageStats {
  const s = save.mageStats[characterId];
  return { bots: s?.bots ?? emptyRecord(), pvp: s?.pvp ?? emptyRecord() };
}

/** Record a finished match (a forfeit counts as a loss). */
export function recordMatch(
  save: SaveData,
  characterId: string,
  kind: keyof MageStats,
  result: { won: boolean; durationMs?: number },
): SaveData {
  const cur = mageStatsOf(save, characterId);
  const r = { ...cur[kind] };
  if (result.won) {
    r.wins++;
    if (result.durationMs !== undefined && (r.fastestWinMs === null || result.durationMs < r.fastestWinMs)) {
      r.fastestWinMs = Math.round(result.durationMs);
    }
  } else {
    r.losses++;
  }
  const next = { ...save, mageStats: { ...save.mageStats, [characterId]: { ...cur, [kind]: r } } };
  writeSave(next);
  return next;
}

function totalsWith(t: Record<string, number>, m: MatchRecord): Record<string, number> {
  const add = (k: string, n = 1) => (t2[k] = (t2[k] ?? 0) + n);
  const t2 = { ...t };
  add('matches');
  if (m.result === 'win') add('wins');
  if (m.result === 'forfeit') add('forfeits');
  add('damage', m.damageDealt);
  add('spells', m.spells);
  add('ultimates', m.ultimates);
  add('healed', m.healed);
  add('gemMatches', m.gemMatches ?? 0);
  add(`mode:${m.mode}`);
  return t2;
}

/** Log a finished match: history (capped) and lifetime totals. */
export function addHistory(save: SaveData, rec: MatchRecord): SaveData {
  const next = { ...save, history: [rec, ...save.history].slice(0, HISTORY_LIMIT), totals: totalsWith(save.totals, rec) };
  writeSave(next);
  return next;
}

// ---- Story progress helpers ------------------------------------------------

export const TOTAL_STORY_FIGHTS = STORY.reduce((n, c) => n + c.fights.length, 0);

export function fightAvailable(save: SaveData, chap: StoryChapter, fi: number): boolean {
  if (!save.unlocked.includes(chap.hero)) return false;
  return fi === 0 || save.storyCleared.includes(chap.fights[fi - 1].id);
}

/** The first fight the player hasn't cleared yet that they can play, if any. */
export function nextStoryFight(save: SaveData): { chap: StoryChapter; fight: StoryFight } | null {
  for (const chap of STORY) {
    for (let fi = 0; fi < chap.fights.length; fi++) {
      const f = chap.fights[fi];
      if (!save.storyCleared.includes(f.id) && fightAvailable(save, chap, fi)) return { chap, fight: f };
    }
  }
  return null;
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
