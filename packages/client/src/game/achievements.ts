import { AI_LEVELS, CHARACTERS, STORY } from '@magepop/core';
import type { MatchRecord, SaveData } from './save';

/**
 * Achievements are plain data. To add one, append an entry to ACHIEVEMENTS; to retune one, change
 * its numbers. Ids are what the save file stores, so never reuse or rename an id. Retire one by
 * setting `retired: true` (players keep it, nobody new can earn it, and it stops counting toward
 * the total).
 *
 * Each achievement unlocks in one of two ways:
 *   - `match`:    checked against every finished match (and, on first load, against saved history).
 *   - `progress`: a [current, target] pair computed from the save; unlocks when current >= target,
 *                 and draws a progress bar on the Achievements screen.
 * New achievements are evaluated retroactively, so adding one rewards players who already did it
 * (as far as their history and lifetime totals can tell).
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold';
export type AchievementCategory = 'journey' | 'combat' | 'mastery' | 'mages' | 'endless' | 'lifetime' | 'secret';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  /** A single glyph for the medal. */
  icon: string;
  /** Hidden until unlocked ("???"). */
  secret?: boolean;
  /** No longer earnable; kept so existing unlocks still show. */
  retired?: boolean;
  match?: (m: MatchRecord, save: SaveData) => boolean;
  progress?: (save: SaveData) => [number, number];
}

export const TIER_POINTS: Record<AchievementTier, number> = {
  bronze: 10,
  silver: 25,
  gold: 50,
};

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  journey: 'Journey',
  combat: 'Combat',
  mastery: 'Mastery',
  mages: 'Mages',
  endless: 'Endless',
  lifetime: 'Lifetime',
  secret: 'Secret',
};

// ---- helpers ------------------------------------------------------------------

const won = (m: MatchRecord) => m.result === 'win';
const levelIndex = (m: MatchRecord) => AI_LEVELS.findIndex((l) => l.id === m.levelId || l.name === m.level);
/** Beat a bot of at least this difficulty (by AI_LEVELS id). */
const beatLevel = (id: string) => (m: MatchRecord) => won(m) && m.mode !== 'pvp' && levelIndex(m) >= AI_LEVELS.findIndex((l) => l.id === id);
const total = (s: SaveData, key: string) => s.totals[key] ?? 0;
const winsAs = (s: SaveData, mage: string) => (s.mageStats[mage]?.bots.wins ?? 0) + (s.mageStats[mage]?.pvp.wins ?? 0);
const allStoryFights = STORY.flatMap((c) => c.fights.map((f) => f.id));
const sec = (n: number) => n * 1000;

/** Per-mage achievements are generated, so new mages get them automatically. */
const mageAchievements: AchievementDef[] = CHARACTERS.flatMap((c) => [
  {
    id: `mage-${c.id}-10`,
    name: `${c.name}'s Apprentice`,
    description: `Win 10 matches as ${c.name}.`,
    category: 'mages' as const,
    tier: 'bronze' as const,
    icon: c.sigil,
    progress: (s: SaveData) => [winsAs(s, c.id), 10] as [number, number],
  },
  {
    id: `mage-${c.id}-50`,
    name: `${c.name} ${c.title.replace(/^the /, 'the True ')}`,
    description: `Win 50 matches as ${c.name}.`,
    category: 'mages' as const,
    tier: 'gold' as const,
    icon: c.sigil,
    progress: (s: SaveData) => [winsAs(s, c.id), 50] as [number, number],
  },
]);

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---- Journey --------------------------------------------------------------
  {
    id: 'first-win',
    name: 'First Pop!',
    description: 'Win your first match.',
    category: 'journey',
    tier: 'bronze',
    icon: '✦',
    match: won,
  },
  {
    id: 'first-story',
    name: 'Enrolled',
    description: 'Clear your first story fight.',
    category: 'journey',
    tier: 'bronze',
    icon: '📜',
    progress: (s) => [Math.min(1, s.storyCleared.length), 1],
  },
  {
    id: 'first-chapter',
    name: 'Chapter One',
    description: 'Finish a full story chapter and recruit a new mage.',
    category: 'journey',
    tier: 'silver',
    icon: '📖',
    progress: (s) => [Math.min(1, STORY.filter((c) => c.fights.every((f) => s.storyCleared.includes(f.id))).length), 1],
  },
  {
    id: 'full-roster',
    name: 'Full Roster',
    description: 'Recruit every mage.',
    category: 'journey',
    tier: 'gold',
    icon: '👥',
    progress: (s) => [s.unlocked.length, CHARACTERS.length],
  },
  {
    id: 'valedictorian',
    name: 'Valedictorian',
    description: 'Clear every story fight.',
    category: 'journey',
    tier: 'gold',
    icon: '🎓',
    progress: (s) => [allStoryFights.filter((id) => s.storyCleared.includes(id)).length, allStoryFights.length],
  },
  {
    id: 'story-speedrun',
    name: 'Skipping Class',
    description: 'Clear a story fight in under 50 seconds.',
    category: 'journey',
    tier: 'silver',
    icon: '⏱',
    match: (m) => won(m) && m.mode === 'story' && m.durationMs < sec(50),
  },

  // ---- Combat (single match) --------------------------------------------------
  {
    id: 'ultimate',
    name: 'Supercharged',
    description: 'Cast an ultimate (match 5 or more).',
    category: 'combat',
    tier: 'bronze',
    icon: '⚡',
    match: (m) => m.ultimates >= 1,
  },
  {
    id: 'showoff',
    name: 'Showoff',
    description: 'Cast 5 ultimates in one match.',
    category: 'combat',
    tier: 'silver',
    icon: '🌟',
    match: (m) => m.ultimates >= 5,
  },
  {
    id: 'spells-15',
    name: 'Spellslinger',
    description: 'Cast 15 spells in one match.',
    category: 'combat',
    tier: 'silver',
    icon: '🪄',
    match: (m) => m.spells >= 15,
  },
  {
    id: 'chain-reaction',
    name: 'Chain Reaction',
    description: 'Hit a x6 cascade combo.',
    category: 'combat',
    tier: 'bronze',
    icon: '🔗',
    match: (m) => m.biggestCombo >= 6,
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    description: 'Hit a x8 cascade combo.',
    category: 'combat',
    tier: 'gold',
    icon: '🏔',
    match: (m) => m.biggestCombo >= 8,
  },
  {
    id: 'heal-60',
    name: 'Second Wind',
    description: 'Heal 60 HP in a single match.',
    category: 'combat',
    tier: 'silver',
    icon: '💚',
    match: (m) => m.healed >= 60,
  },
  {
    id: 'untouchable',
    name: 'Barely a Scratch',
    description: 'Win without ever dropping below 90% HP.',
    category: 'combat',
    tier: 'gold',
    icon: '🛡',
    match: (m) => won(m) && m.lowestHp !== undefined && m.maxHp !== undefined && m.lowestHp >= m.maxHp * 0.9,
  },
  {
    id: 'by-a-thread',
    name: 'By a Thread',
    description: 'Win with 10 HP or less.',
    category: 'combat',
    tier: 'silver',
    icon: '🧵',
    match: (m) => won(m) && m.hpLeft !== undefined && m.hpLeft <= 10,
  },
  {
    id: 'comeback',
    name: 'Comeback Kid',
    description: 'Win after dropping below 25 HP.',
    category: 'combat',
    tier: 'silver',
    icon: '🔥',
    match: (m) => won(m) && m.lowestHp !== undefined && m.lowestHp < 25,
  },
  {
    id: 'blitz',
    name: 'Blitz',
    description: 'Win a match in under 45 seconds.',
    category: 'combat',
    tier: 'silver',
    icon: '💨',
    match: (m) => won(m) && m.durationMs < sec(45),
  },
  {
    id: 'marathon',
    name: 'War of Attrition',
    description: 'Win a match that lasts over 2 minutes.',
    category: 'combat',
    tier: 'bronze',
    icon: '⌛',
    match: (m) => won(m) && m.durationMs > sec(120),
  },

  // ---- Mastery (difficulty) ---------------------------------------------------
  {
    id: 'beat-adept',
    name: 'Making the Grade',
    description: 'Beat an Adept bot.',
    category: 'mastery',
    tier: 'bronze',
    icon: '🥉',
    match: beatLevel('adept'),
  },
  {
    id: 'beat-expert',
    name: 'Expert Duelist',
    description: 'Beat an Expert bot.',
    category: 'mastery',
    tier: 'silver',
    icon: '🥈',
    match: beatLevel('expert'),
  },
  {
    id: 'beat-master',
    name: 'Archmage',
    description: 'Beat a Master bot.',
    category: 'mastery',
    tier: 'gold',
    icon: '🥇',
    match: beatLevel('master'),
  },
  {
    id: 'beat-nightmare',
    name: 'Nightmare Fuel',
    description: 'Beat a Nightmare bot.',
    category: 'mastery',
    tier: 'gold',
    icon: '👁',
    match: beatLevel('nightmare'),
  },
  {
    id: 'nightmare-blitz',
    name: 'Lucid Dreamer',
    description: 'Beat a Nightmare bot in under a minute.',
    category: 'mastery',
    tier: 'gold',
    icon: '🌙',
    match: (m) => beatLevel('nightmare')(m) && m.durationMs < sec(60),
  },

  // ---- Mages ------------------------------------------------------------------
  {
    id: 'well-rounded',
    name: 'Well Rounded',
    description: 'Win a match with every mage.',
    category: 'mages',
    tier: 'gold',
    icon: '🎭',
    progress: (s) => [CHARACTERS.filter((c) => winsAs(s, c.id) > 0).length, CHARACTERS.length],
  },
  {
    id: 'mirror',
    name: 'Mirror Match',
    description: 'Beat a mage while playing as that same mage.',
    category: 'mages',
    tier: 'bronze',
    icon: '🪞',
    match: (m) => won(m) && m.player === m.opponent,
  },
  ...mageAchievements,

  // ---- Endless -----------------------------------------------------------------
  {
    id: 'endless-5',
    name: 'Survivor',
    description: 'Clear 5 waves in one Endless run.',
    category: 'endless',
    tier: 'bronze',
    icon: '🌊',
    match: (m) => won(m) && (m.wave ?? 0) >= 5,
    progress: (s) => [s.endlessBest?.wave ?? 0, 5],
  },
  {
    id: 'endless-10',
    name: 'Unstoppable',
    description: 'Clear 10 waves in one Endless run.',
    category: 'endless',
    tier: 'silver',
    icon: '🌊',
    match: (m) => won(m) && (m.wave ?? 0) >= 10,
    progress: (s) => [s.endlessBest?.wave ?? 0, 10],
  },
  {
    id: 'endless-20',
    name: 'Tidal Force',
    description: 'Clear 20 waves in one Endless run.',
    category: 'endless',
    tier: 'gold',
    icon: '🌊',
    match: (m) => won(m) && (m.wave ?? 0) >= 20,
    progress: (s) => [s.endlessBest?.wave ?? 0, 20],
  },

  // ---- Lifetime ----------------------------------------------------------------
  {
    id: 'matches-25',
    name: 'Regular',
    description: 'Play 25 matches.',
    category: 'lifetime',
    tier: 'bronze',
    icon: '🎮',
    progress: (s) => [total(s, 'matches'), 25],
  },
  {
    id: 'wins-100',
    name: 'Centurion',
    description: 'Win 100 matches.',
    category: 'lifetime',
    tier: 'gold',
    icon: '🏆',
    progress: (s) => [total(s, 'wins'), 100],
  },
  {
    id: 'ultimates-100',
    name: 'Overcharged',
    description: 'Cast 100 ultimates.',
    category: 'lifetime',
    tier: 'silver',
    icon: '⚡',
    progress: (s) => [total(s, 'ultimates'), 100],
  },
  {
    id: 'damage-10k',
    name: 'Ten Thousand Cuts',
    description: 'Deal 10,000 total damage.',
    category: 'lifetime',
    tier: 'silver',
    icon: '⚔',
    progress: (s) => [total(s, 'damage'), 10000],
  },
  {
    id: 'matches-gems-5k',
    name: 'Gem Cutter',
    description: 'Make 5,000 matches.',
    category: 'lifetime',
    tier: 'silver',
    icon: '💎',
    progress: (s) => [total(s, 'gemMatches'), 5000],
  },

  // ---- Secret ------------------------------------------------------------------
  {
    id: 'retreat',
    name: 'Strategic Retreat',
    description: 'Forfeit a match.',
    category: 'secret',
    tier: 'bronze',
    icon: '🏳',
    secret: true,
    match: (m) => m.result === 'forfeit',
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Win a match between midnight and 4 AM.',
    category: 'secret',
    tier: 'bronze',
    icon: '🦉',
    secret: true,
    match: (m) => won(m) && new Date(m.at).getHours() < 4,
  },
  {
    id: 'pacifist',
    name: 'Pacifist?',
    description: 'Win without casting a single spell.',
    category: 'secret',
    tier: 'silver',
    icon: '🕊',
    secret: true,
    match: (m) => won(m) && m.spells === 0,
  },
  {
    id: 'overkill',
    name: 'Overkill',
    description: 'Finish an opponent with a blow that deals 15+ more damage than they had left.',
    category: 'secret',
    tier: 'silver',
    icon: '💥',
    secret: true,
    match: (m) => won(m) && (m.overkill ?? 0) >= 15,
  },
  {
    id: 'ice-to-meet-you',
    name: 'Ice to Meet You',
    description: 'Be frozen and stunned at the same time.',
    category: 'secret',
    tier: 'bronze',
    icon: '🧊',
    secret: true,
    match: (m) => !!m.frozenAndStunned,
  },
  {
    id: 'slow-and-steady',
    name: 'Slow and Steady',
    description: 'Beat an Adept or harder bot without casting a single ultimate.',
    category: 'secret',
    tier: 'gold',
    icon: '🐢',
    secret: true,
    match: (m) => beatLevel('adept')(m) && m.ultimates === 0,
  },
  {
    id: 'long-game',
    name: 'The Long Game',
    description: 'Play 100 matches.',
    category: 'secret',
    tier: 'silver',
    icon: '📅',
    secret: true,
    progress: (s) => [total(s, 'matches'), 100],
  },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const getAchievement = (id: string) => BY_ID.get(id);
export const activeAchievements = () => ACHIEVEMENTS.filter((a) => !a.retired);

/**
 * Check every not-yet-unlocked achievement. `matches` are the finished matches to test `match`
 * rules against (the one just played, or the whole history on first load).
 * Returns the save with new unlocks stamped in, plus the newly unlocked defs (for toasts).
 */
export function evaluateAchievements(save: SaveData, matches: MatchRecord[] = []): { save: SaveData; unlocked: AchievementDef[] } {
  const got: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (a.retired || save.achievements[a.id]) continue;
    let ok = false;
    if (a.match) ok = matches.some((m) => a.match!(m, save));
    if (!ok && a.progress) {
      const [cur, target] = a.progress(save);
      ok = cur >= target;
    }
    if (ok) got.push(a);
  }
  if (!got.length) return { save, unlocked: [] };
  const now = Date.now();
  const achievements = { ...save.achievements };
  for (const a of got) achievements[a.id] = now;
  return { save: { ...save, achievements }, unlocked: got };
}

export function achievementScore(save: SaveData) {
  const active = activeAchievements();
  const earned = ACHIEVEMENTS.filter((a) => save.achievements[a.id]);
  return {
    unlocked: earned.filter((a) => !a.retired).length,
    total: active.length,
    points: earned.reduce((t, a) => t + TIER_POINTS[a.tier], 0),
    maxPoints: active.reduce((t, a) => t + TIER_POINTS[a.tier], 0),
  };
}
