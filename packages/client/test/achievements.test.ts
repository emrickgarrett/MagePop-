import { beforeEach, describe, expect, it, vi } from 'vitest';

// save.ts touches localStorage; give it an in-memory one.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

beforeEach(() => store.clear());

const { ACHIEVEMENTS, evaluateAchievements, achievementScore } = await import('../src/game/achievements');
const { CHARACTERS, STORY } = await import('@magepop/core');
const { loadSave, addHistory } = await import('../src/game/save');
type Rec = import('../src/game/save').MatchRecord;

const match = (over: Partial<Rec> = {}): Rec => ({
  at: new Date(2026, 10, 1, 15).getTime(),
  mode: 'quick',
  detail: 'Quick Battle',
  player: 'ember',
  opponent: 'rime',
  level: 'Apprentice',
  levelId: 'apprentice',
  result: 'win',
  durationMs: 90_000,
  damageDealt: 250,
  damageTaken: 120,
  spells: 6,
  ultimates: 0,
  biggestCombo: 2,
  healed: 0,
  gemMatches: 30,
  startHp: 250,
  hpLeft: 130,
  lowestHp: 130,
  maxHp: 250,
  ...over,
});

describe('achievement definitions', () => {
  it('have unique ids and an unlock rule', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) expect(!!a.match || !!a.progress, a.id).toBe(true);
  });
});

describe('evaluateAchievements', () => {
  it('unlocks match-based achievements from the match just played', () => {
    const s = addHistory(loadSave(), match({ ultimates: 5, biggestCombo: 6 }));
    const { save, unlocked } = evaluateAchievements(s, [s.history[0]]);
    const ids = unlocked.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first-win', 'ultimate', 'showoff', 'chain-reaction']));
    expect(ids).not.toContain('avalanche');
    expect(save.achievements['first-win']).toBeTypeOf('number');
    // Already earned: not reported again.
    expect(evaluateAchievements(save, [s.history[0]]).unlocked).toEqual([]);
  });

  it('handles difficulty, close calls and secrets', () => {
    const s = loadSave();
    const ids = (m: Rec) => evaluateAchievements(s, [m]).unlocked.map((a) => a.id);
    expect(ids(match({ levelId: 'master', level: 'Master' }))).toEqual(expect.arrayContaining(['beat-adept', 'beat-expert', 'beat-master']));
    expect(ids(match({ hpLeft: 8, lowestHp: 8 }))).toEqual(expect.arrayContaining(['by-a-thread', 'comeback']));
    expect(ids(match({ lowestHp: 230, hpLeft: 240 }))).toContain('untouchable');
    expect(ids(match({ lowestHp: 200 }))).not.toContain('untouchable');
    expect(ids(match({ result: 'forfeit' }))).toEqual(['retreat']);
    expect(ids(match({ result: 'loss', ultimates: 1 }))).toEqual(['ultimate']);
  });

  it('unlocks progress-based achievements from lifetime totals', () => {
    let s = loadSave();
    for (let i = 0; i < 25; i++) s = addHistory(s, match({ result: i % 2 ? 'loss' : 'win' }));
    expect(s.totals.matches).toBe(25);
    const ids = evaluateAchievements(s).unlocked.map((a) => a.id);
    expect(ids).toContain('matches-25');
    expect(ids).not.toContain('wins-100');
    expect(achievementScore(s).total).toBe(ACHIEVEMENTS.filter((a) => !a.retired).length);
  });
});

/**
 * Every achievement must have a worked example here that unlocks it. Adding an achievement without
 * one fails the first test, which keeps every achievement provably earnable.
 */
type Example = { match?: Partial<Rec>; save?: (s: ReturnType<typeof loadSave>) => ReturnType<typeof loadSave> };
const allFights = STORY.flatMap((c) => c.nodes.filter((n) => !n.optional).map((n) => n.id));
const withTotals = (t: Record<string, number>) => (s: ReturnType<typeof loadSave>) => ({ ...s, totals: { ...s.totals, ...t } });
const winsAs = (id: string, wins: number) => (s: ReturnType<typeof loadSave>) => ({
  ...s,
  mageStats: { ...s.mageStats, [id]: { bots: { wins, losses: 0, fastestWinMs: 1 }, pvp: { wins: 0, losses: 0, fastestWinMs: null } } },
});

const EXAMPLES: Record<string, Example> = {
  'first-win': { match: {} },
  'first-story': { save: (s) => ({ ...s, storyCleared: [allFights[0]] }) },
  'first-chapter': { save: (s) => ({ ...s, storyCleared: STORY[0].nodes.filter((n) => !n.optional).map((n) => n.id) }) },
  'full-roster': { save: (s) => ({ ...s, unlocked: CHARACTERS.map((c) => c.id) }) },
  valedictorian: { save: (s) => ({ ...s, storyCleared: allFights }) },
  'story-speedrun': { match: { mode: 'story', durationMs: 49_000 } },
  ultimate: { match: { result: 'loss', ultimates: 1 } },
  showoff: { match: { ultimates: 5 } },
  'spells-15': { match: { spells: 15 } },
  'chain-reaction': { match: { biggestCombo: 6 } },
  avalanche: { match: { biggestCombo: 8 } },
  'heal-60': { match: { healed: 60 } },
  untouchable: { match: { lowestHp: 225, hpLeft: 250 } },
  'by-a-thread': { match: { hpLeft: 10, lowestHp: 10 } },
  comeback: { match: { lowestHp: 24 } },
  blitz: { match: { durationMs: 44_000 } },
  marathon: { match: { durationMs: 121_000 } },
  'beat-adept': { match: { levelId: 'adept', level: 'Adept' } },
  'beat-expert': { match: { levelId: 'expert', level: 'Expert' } },
  'beat-master': { match: { levelId: 'master', level: 'Master' } },
  'beat-nightmare': { match: { levelId: 'nightmare', level: 'Nightmare' } },
  'nightmare-blitz': { match: { levelId: 'nightmare', level: 'Nightmare', durationMs: 59_000 } },
  'well-rounded': { save: (s) => CHARACTERS.reduce((acc, c) => winsAs(c.id, 1)(acc), s) },
  mirror: { match: { player: 'nyx', opponent: 'nyx' } },
  'endless-5': { match: { mode: 'endless', wave: 5 } },
  'endless-10': { save: (s) => ({ ...s, endlessBest: { wave: 10, characterId: 'ember' } }) },
  'endless-20': { match: { mode: 'endless', wave: 20 } },
  'matches-25': { save: withTotals({ matches: 25 }) },
  'wins-100': { save: withTotals({ wins: 100 }) },
  'ultimates-100': { save: withTotals({ ultimates: 100 }) },
  'damage-10k': { save: withTotals({ damage: 10_000 }) },
  'matches-gems-5k': { save: withTotals({ gemMatches: 5000 }) },
  retreat: { match: { result: 'forfeit' } },
  'night-owl': { match: { at: new Date(2026, 10, 1, 2, 30).getTime() } },
  pacifist: { match: { spells: 0, ultimates: 0 } },
  overkill: { match: { overkill: 15 } },
  'ice-to-meet-you': { match: { result: 'loss', frozenAndStunned: true } },
  'slow-and-steady': { match: { levelId: 'adept', level: 'Adept', ultimates: 0 } },
  'long-game': { save: withTotals({ matches: 100 }) },
  'online-debut': { match: { mode: 'pvp', level: undefined, levelId: undefined, opponentName: 'Rival' } },
  'online-10': { save: (s) => ({ ...s, mageStats: { ember: { bots: { wins: 0, losses: 0, fastestWinMs: null }, pvp: { wins: 10, losses: 3, fastestWinMs: 1 } } } }) },
  'online-50': { save: (s) => ({ ...s, mageStats: { ember: { bots: { wins: 0, losses: 0, fastestWinMs: null }, pvp: { wins: 50, losses: 3, fastestWinMs: 1 } } } }) },
  ...Object.fromEntries(
    CHARACTERS.flatMap((c) => [
      [`mage-${c.id}-10`, { save: winsAs(c.id, 10) }],
      [`mage-${c.id}-50`, { save: winsAs(c.id, 50) }],
    ]),
  ),
};

describe('every achievement is earnable', () => {
  it('has a worked example', () => {
    const missing = ACHIEVEMENTS.filter((a) => !a.retired && !EXAMPLES[a.id]).map((a) => a.id);
    expect(missing, 'add an example to EXAMPLES for these').toEqual([]);
  });

  for (const a of ACHIEVEMENTS.filter((x) => !x.retired)) {
    it(`${a.id} unlocks from its example`, () => {
      const ex = EXAMPLES[a.id];
      if (!ex) return;
      const base = ex.save ? ex.save(loadSave()) : loadSave();
      const got = evaluateAchievements(base, ex.match ? [match(ex.match)] : []).unlocked.map((x) => x.id);
      expect(got).toContain(a.id);
    });
  }

  it('an ordinary loss unlocks nothing it should not', () => {
    const got = evaluateAchievements(loadSave(), [match({ result: 'loss' })]).unlocked.map((x) => x.id);
    expect(got).toEqual([]);
  });
});
