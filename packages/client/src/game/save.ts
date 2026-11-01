import { STARTER_CHARACTER, STORY, StoryChapter, StoryFight } from '@magepop/core';

export interface Settings {
  /** Panels shake when hit. */
  screenShake: boolean;
  /** Floating damage / spell text over the boards. */
  combatText: boolean;
  /** Skip intro/outro dialogue when replaying a story fight you've already cleared. */
  skipReplayDialogue: boolean;
  /** Show the controls hint line during battles. */
  battleHints: boolean;
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

export interface SaveData {
  version: 1;
  unlocked: string[];
  /** fight ids completed in story mode */
  storyCleared: string[];
  /** best (fastest) clear time per story fight, in ms */
  storyBest: Record<string, number>;
  endlessBest: { wave: number; characterId: string } | null;
  /** Per-mage records, keyed by character id. */
  mageStats: Record<string, MageStats>;
  settings: Settings;
}

const KEY = 'magepop.save.v1';
/** Saves from before the rename (the game was called TaiwanPop). */
const LEGACY_KEY = 'taiwanpop.save.v1';

export const DEFAULT_SETTINGS: Settings = {
  screenShake: true,
  combatText: true,
  skipReplayDialogue: false,
  battleHints: true,
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
