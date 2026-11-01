import { describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { STAR_REWARDS, equippedFrame, myBoardTheme, rewardsBetween, nextReward } = await import('../src/game/rewards');
const { loadSave, TOTAL_STORY_STARS } = await import('../src/game/save');
const { CHARACTER_BY_ID } = await import('@magepop/core');

const withStars = (n: number, settings: Record<string, unknown> = {}) => {
  const s = loadSave();
  return { ...s, storyStars: { a: n }, settings: { ...s.settings, ...settings } };
};

describe('star rewards', () => {
  it('climb in order, end at every star, and point at real boards', () => {
    const need = STAR_REWARDS.map((r) => r.stars);
    expect([...need].sort((a, b) => a - b)).toEqual(need);
    expect(need.at(-1)).toBe(TOTAL_STORY_STARS);
    expect(new Set(STAR_REWARDS.map((r) => r.id)).size).toBe(STAR_REWARDS.length);
    for (const r of STAR_REWARDS) if (r.kind === 'board') expect(CHARACTER_BY_ID[r.board]).toBeDefined();
  });

  it('only owned cosmetics are worn; otherwise fall back to defaults', () => {
    expect(equippedFrame(withStars(0, { frame: 'bronze' }))).toBeNull();
    expect(equippedFrame(withStars(10, { frame: 'bronze' }))).toBe('bronze');
    expect(equippedFrame(withStars(10, { frame: 'gold' }))).toBeNull();
    expect(myBoardTheme(withStars(5, { boardSkin: 'rime' }), 'ember')).toBe('ember');
    expect(myBoardTheme(withStars(20, { boardSkin: 'rime' }), 'ember')).toBe('rime');
    expect(myBoardTheme(withStars(999, { boardSkin: 'nonsense' }), 'nyx')).toBe('nyx');
  });

  it('reports rewards crossed by a clear, and the next one to chase', () => {
    expect(rewardsBetween(9, 21).map((r) => r.id)).toEqual(['frame-bronze', 'board-rime']);
    expect(rewardsBetween(10, 10)).toEqual([]);
    expect(nextReward(withStars(0))?.id).toBe('frame-bronze');
    expect(nextReward(withStars(TOTAL_STORY_STARS))).toBeNull();
  });
});
