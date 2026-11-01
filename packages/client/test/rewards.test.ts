import { describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { STAR_REWARDS, equippedFrame, myBoardTheme, rewardsBetween, nextReward } = await import('../src/game/rewards');
const { loadSave, clearStoryNode, storyStarsOn, nodeStarsOn, TOTAL_STARS_ALL_DIFFICULTIES } = await import('../src/game/save');
const { CHARACTER_BY_ID } = await import('@magepop/core');

const withStars = (n: number, settings: Record<string, unknown> = {}) => {
  const s = loadSave();
  // n stars, spread as whole nodes of 3 on Normal plus a remainder.
  const normal: Record<string, boolean[]> = {};
  for (let i = 0; i * 3 < n; i++) normal[`n${i}`] = [0, 1, 2].map((k) => i * 3 + k < n);
  return { ...s, storyGoalsBy: { relaxed: {}, normal, hard: {} }, settings: { ...s.settings, ...settings } };
};

describe('star rewards', () => {
  it('climb in order, end at every star, and point at real boards', () => {
    const need = STAR_REWARDS.map((r) => r.stars);
    expect([...need].sort((a, b) => a - b)).toEqual(need);
    expect(need.at(-1)).toBe(TOTAL_STARS_ALL_DIFFICULTIES);
    expect(new Set(STAR_REWARDS.map((r) => r.id)).size).toBe(STAR_REWARDS.length);
    for (const r of STAR_REWARDS) if (r.kind === 'board') expect(CHARACTER_BY_ID[r.board]).toBeDefined();
  });

  it('only owned cosmetics are worn; otherwise fall back to defaults', () => {
    expect(equippedFrame(withStars(0, { frame: 'bronze' }))).toBeNull();
    expect(equippedFrame(withStars(10, { frame: 'bronze' }))).toBe('bronze');
    expect(equippedFrame(withStars(10, { frame: 'gold' }))).toBeNull();
    expect(myBoardTheme(withStars(5, { boardSkin: 'rime' }), 'ember')).toBe('ember');
    expect(myBoardTheme(withStars(25, { boardSkin: 'rime' }), 'ember')).toBe('rime');
    expect(myBoardTheme(withStars(999, { boardSkin: 'nonsense' }), 'nyx')).toBe('nyx');
  });

  it('reports rewards crossed by a clear, and the next one to chase', () => {
    expect(rewardsBetween(9, 26).map((r) => r.id)).toEqual(['frame-bronze', 'board-rime']);
    expect(rewardsBetween(10, 10)).toEqual([]);
    expect(nextReward(withStars(0))?.id).toBe('frame-bronze');
    expect(nextReward(withStars(TOTAL_STARS_ALL_DIFFICULTIES))).toBeNull();
  });
});

describe('stars per difficulty', () => {
  it('a clear earns stars on its difficulty and every easier one', () => {
    let s = loadSave();
    s = clearStoryNode(s, 'ember-trial', 60_000, [true, true, false], 'normal').save;
    expect([storyStarsOn(s, 'relaxed'), storyStarsOn(s, 'normal'), storyStarsOn(s, 'hard')]).toEqual([2, 2, 0]);
    s = clearStoryNode(s, 'ember-trial', 60_000, [true, false, true], 'hard').save;
    expect(nodeStarsOn(s, 'hard', 'ember-trial')).toBe(2);
    expect(nodeStarsOn(s, 'normal', 'ember-trial')).toBe(3); // goals combine across attempts
    expect(nodeStarsOn(s, 'relaxed', 'ember-trial')).toBe(3);
    // A Relaxed clear never adds to harder difficulties.
    s = clearStoryNode(s, 'ember-wild-magic', 60_000, [true, true, true], 'relaxed').save;
    expect(nodeStarsOn(s, 'normal', 'ember-wild-magic')).toBe(0);
  });

  it('old saves count their stars as Normal (and Relaxed)', () => {
    store.set(
      'magepop.save.v1',
      JSON.stringify({ version: 1, unlocked: ['ember'], storyCleared: ['a', 'b'], storyStars: { a: 3, b: 1 }, storyGoals: { a: [true, true, true] } }),
    );
    const s = loadSave();
    expect(nodeStarsOn(s, 'normal', 'a')).toBe(3);
    expect(nodeStarsOn(s, 'relaxed', 'b')).toBe(1);
    expect(storyStarsOn(s, 'hard')).toBe(0);
  });
});
