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
    const s = addHistory(loadSave(), match({ ultimates: 3, biggestCombo: 4 }));
    const { save, unlocked } = evaluateAchievements(s, [s.history[0]]);
    const ids = unlocked.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first-win', 'ultimate', 'ultimate-3', 'combo-4']));
    expect(ids).not.toContain('combo-6');
    expect(save.achievements['first-win']).toBeTypeOf('number');
    // Already earned: not reported again.
    expect(evaluateAchievements(save, [s.history[0]]).unlocked).toEqual([]);
  });

  it('handles difficulty, close calls and secrets', () => {
    const s = loadSave();
    const ids = (m: Rec) => evaluateAchievements(s, [m]).unlocked.map((a) => a.id);
    expect(ids(match({ levelId: 'master', level: 'Master' }))).toEqual(expect.arrayContaining(['beat-adept', 'beat-expert', 'beat-master']));
    expect(ids(match({ hpLeft: 8, lowestHp: 8 }))).toEqual(expect.arrayContaining(['by-a-thread', 'comeback']));
    expect(ids(match({ lowestHp: 250, hpLeft: 250 }))).toContain('untouchable');
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
