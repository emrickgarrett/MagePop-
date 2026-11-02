import { chapterComplete, nodeAvailable, requiredNodes, STARTER_CHARACTER, STORY, StoryChapter, StoryNode } from '@magepop/core';

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
  /** Story difficulty: shifts bot skill and enemy HP (see STORY_DIFFICULTY). */
  storyDifficulty: StoryDifficulty;
  /** Display name for online matches ('' = not chosen yet). */
  playerName: string;
  /** Last mage picked for online matches. */
  pvpMage: string | null;
  /** Mage picked for "any mage" story chapters (the finale). */
  storyHero: string | null;
  /** Star reward cosmetics (see rewards.ts). null = none / your mage's own board. */
  frame: string | null;
  boardSkin: string | null;
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

export type StoryDifficulty = 'relaxed' | 'normal' | 'hard';

/**
 * How each story difficulty adjusts fights: bot level shift, then `pace` (more thinking time) and
 * `slip` (more random moves) so bots play at a human tempo, plus enemy HP and protect drain.
 * Tuned with core/test/story-odds.ts using a slowed Expert player as a stand-in for a person.
 */
export const STORY_DIFFICULTY: Record<StoryDifficulty, { label: string; desc: string; level: number; pace: number; slip: number; hp: number; drain: number }> = {
  relaxed: { label: 'Relaxed', desc: 'Slower opponents, less HP. For enjoying the story.', level: -1, pace: 1.45, slip: 0.08, hp: 0.85, drain: 0.7 },
  normal: { label: 'Normal', desc: 'The intended challenge.', level: 0, pace: 1.45, slip: 0.08, hp: 1, drain: 1 },
  hard: { label: 'Hard', desc: 'Faster, sharper opponents with more HP. Bragging rights.', level: 0, pace: 1.15, slip: 0.03, hp: 1.1, drain: 1.2 },
};

/** Easiest first. Clearing a node on one difficulty also earns its stars on every easier one. */
export const DIFFICULTY_ORDER: StoryDifficulty[] = ['relaxed', 'normal', 'hard'];

export interface SaveData {
  version: 1;
  unlocked: string[];
  /** fight ids completed in story mode */
  storyCleared: string[];
  /** best (fastest) clear time per story fight, in ms */
  storyBest: Record<string, number>;
  /** Most stars earned per story node (0-3). */
  storyStars: Record<string, number>;
  /** Which of each node's 3 star goals have ever been met (kept across attempts). */
  storyGoals: Record<string, boolean[]>;
  /** The same per difficulty: stars are tracked separately for Relaxed, Normal and Hard. */
  storyGoalsBy: Record<StoryDifficulty, Record<string, boolean[]>>;
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
  storyDifficulty: 'normal',
  playerName: '',
  pvpMage: null,
  storyHero: null,
  frame: null,
  boardSkin: null,
  musicVolume: 0.6,
  sfxVolume: 0.8,
};

const fresh = (): SaveData => ({
  version: 1,
  unlocked: [STARTER_CHARACTER],
  storyCleared: [],
  storyBest: {},
  storyStars: {},
  storyGoals: {},
  storyGoalsBy: { relaxed: {}, normal: {}, hard: {} },
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
    return normalize(JSON.parse(raw) as Partial<SaveData>);
  } catch {
    return fresh();
  }
}

/** Fill in fields missing from older saves (and from partial imports). */
function normalize(data: Partial<SaveData>): SaveData {
  return {
    ...fresh(),
    ...data,
    storyBest: data.storyBest ?? {},
    storyStars: data.storyStars ?? {},
    storyGoals: data.storyGoals ?? {},
    storyGoalsBy: data.storyGoalsBy ?? legacyGoalsBy(data),
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
}

// ---- backup / transfer ----------------------------------------------------------------------
// Browser saves can be wiped (private windows, cleared site data, Safari's 7-day rule for embedded
// games), and the desktop and browser versions keep separate saves. A save file lets players back
// up their progress and move it between them.

const EXPORT_TAG = 'magepop-save';
const MAX_IMPORT_CHARS = 2_000_000;

export function exportSave(s: SaveData): string {
  return JSON.stringify({ game: EXPORT_TAG, format: 1, exportedAt: new Date().toISOString(), save: s });
}

/** Parse a save file. Throws an Error with a player-facing message if it isn't one. */
export function importSave(text: string): SaveData {
  const notASave = "That file isn't a MagePop save.";
  if (text.length > MAX_IMPORT_CHARS) throw new Error(notASave);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(notASave);
  }
  const wrap = parsed as { game?: unknown; save?: unknown } | null;
  if (!wrap || typeof wrap !== 'object' || wrap.game !== EXPORT_TAG) throw new Error(notASave);
  const data = wrap.save;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('That save file is damaged.');
  // Light shape checks so a bad file can't break the menus.
  const lists = ['unlocked', 'storyCleared', 'history'] as const;
  for (const k of lists) {
    const v = (data as Record<string, unknown>)[k];
    if (v !== undefined && !Array.isArray(v)) throw new Error('That save file is damaged.');
  }
  return normalize(data as Partial<SaveData>);
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

/**
 * Mark a story node cleared with the stars earned (best kept). Returns the newly recruited mage,
 * if this finished a chapter.
 */
export function clearStoryNode(
  save: SaveData,
  nodeId: string,
  timeMs: number | null,
  goalsMet: boolean[],
  difficulty: StoryDifficulty = 'normal',
): { save: SaveData; unlocked: string | null; newBest: boolean; newStars: boolean } {
  // Goals earned on different attempts all count: stars are the union of everything you've done.
  const prevGoals = save.storyGoals[nodeId] ?? [];
  const merged = goalsMet.map((ok, i) => ok || !!prevGoals[i]);
  const stars = merged.filter(Boolean).length;
  const storyCleared = save.storyCleared.includes(nodeId) ? save.storyCleared : [...save.storyCleared, nodeId];
  const prevBest = save.storyBest[nodeId];
  const newBest = timeMs !== null && (prevBest === undefined || timeMs < prevBest);
  const storyBest = newBest ? { ...save.storyBest, [nodeId]: Math.round(timeMs!) } : save.storyBest;
  const prevStars = save.storyStars[nodeId] ?? 0;
  const storyStars = stars > prevStars ? { ...save.storyStars, [nodeId]: stars } : save.storyStars;
  let unlocked: string | null = null;
  const unlockedSet = new Set(save.unlocked);
  for (const ch of STORY) {
    if (ch.unlocks && chapterComplete(ch, storyCleared) && !unlockedSet.has(ch.unlocks)) {
      unlockedSet.add(ch.unlocks);
      unlocked = ch.unlocks;
    }
  }
  const storyGoals = { ...save.storyGoals, [nodeId]: merged };
  // Per difficulty: this one and every easier one get the goals met this run.
  const storyGoalsBy = { ...save.storyGoalsBy };
  for (const d of DIFFICULTY_ORDER.slice(0, DIFFICULTY_ORDER.indexOf(difficulty) + 1)) {
    const prev = storyGoalsBy[d][nodeId] ?? [];
    storyGoalsBy[d] = { ...storyGoalsBy[d], [nodeId]: goalsMet.map((ok, i) => ok || !!prev[i]) };
  }
  const next = { ...save, storyCleared, storyBest, storyStars, storyGoals, storyGoalsBy, unlocked: [...unlockedSet] };
  writeSave(next);
  return { save: next, unlocked, newBest: newBest && prevBest !== undefined, newStars: stars > prevStars };
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

/** Required story nodes across all chapters (optional challenges excluded). */
export const TOTAL_STORY_NODES = STORY.reduce((n, c) => n + requiredNodes(c).length, 0);
export const TOTAL_STORY_STARS = STORY.reduce((n, c) => n + c.nodes.length * 3, 0);

export const storyNodesCleared = (save: SaveData) => STORY.reduce((n, c) => n + requiredNodes(c).filter((x) => save.storyCleared.includes(x.id)).length, 0);
/** Star goals met on a node on one difficulty (index 0 = the win star). */
export const goalsOn = (save: SaveData, d: StoryDifficulty, nodeId: string): boolean[] => save.storyGoalsBy[d][nodeId] ?? [];
export const nodeStarsOn = (save: SaveData, d: StoryDifficulty, nodeId: string) => goalsOn(save, d, nodeId).filter(Boolean).length;
export const storyStarsOn = (save: SaveData, d: StoryDifficulty) =>
  Object.values(save.storyGoalsBy[d]).reduce((t, g) => t + g.filter(Boolean).length, 0);
/** Stars across all three difficulties (what star rewards count). */
export const storyStarsEarned = (save: SaveData) => DIFFICULTY_ORDER.reduce((t, d) => t + storyStarsOn(save, d), 0);
export const TOTAL_STARS_ALL_DIFFICULTIES = TOTAL_STORY_STARS * DIFFICULTY_ORDER.length;

/**
 * Saves from before per-difficulty stars: we don't know which difficulty each star came from, so
 * they count for Normal (and therefore Relaxed). Very old saves only stored a star count; claim
 * only what's certain (a clear = the win star; 3 stars = all three).
 */
function legacyGoalsBy(data: Partial<SaveData>): SaveData['storyGoalsBy'] {
  const goals: Record<string, boolean[]> = {};
  for (const id of data.storyCleared ?? []) {
    const known = data.storyGoals?.[id];
    const n = data.storyStars?.[id] ?? 0;
    goals[id] = known ? [...known] : [true, n >= 3, n >= 3];
  }
  return { relaxed: { ...goals }, normal: { ...goals }, hard: {} };
}

export function nodeOpen(save: SaveData, chap: StoryChapter, index: number): boolean {
  return nodeAvailable(chap, index, save.storyCleared, save.unlocked);
}

/** The first required node the player hasn't cleared yet and can play, if any. */
export function nextStoryNode(save: SaveData): { chap: StoryChapter; node: StoryNode } | null {
  for (const chap of STORY) {
    for (let i = 0; i < chap.nodes.length; i++) {
      const n = chap.nodes[i];
      if (!n.optional && !save.storyCleared.includes(n.id) && nodeOpen(save, chap, i)) return { chap, node: n };
    }
  }
  return null;
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The mage to play "any mage" chapters with: the saved pick if unlocked, else the newest recruit. */
export function storyHeroFor(save: SaveData): string {
  const pick = save.settings.storyHero;
  if (pick && save.unlocked.includes(pick)) return pick;
  return save.unlocked[save.unlocked.length - 1] ?? 'ember';
}
