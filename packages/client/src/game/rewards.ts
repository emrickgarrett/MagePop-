import { getCharacter } from '@magepop/core';
import { SaveData, storyStarsEarned, TOTAL_STARS_ALL_DIFFICULTIES } from './save';

/**
 * Story stars (counted across all three difficulties) unlock cosmetics: portrait frames and board backgrounds for your side of the
 * battle. Purely visual and local (opponents see their own settings, not yours).
 *
 * Add a reward by appending to STAR_REWARDS; thresholds above the story's total are clamped to it,
 * so the last reward always needs every star.
 */
export type FrameId = 'bronze' | 'silver' | 'gold' | 'prismatic';

export type StarReward =
  { id: string; stars: number; kind: 'frame'; frame: FrameId; name: string } | { id: string; stars: number; kind: 'board'; board: string; name: string };

const RAW: StarReward[] = [
  { id: 'frame-bronze', stars: 10, kind: 'frame', frame: 'bronze', name: 'Bronze Frame' },
  { id: 'board-rime', stars: 25, kind: 'board', board: 'rime', name: 'Frozen Lake Board' },
  { id: 'board-briar', stars: 45, kind: 'board', board: 'briar', name: 'Mossy Grove Board' },
  { id: 'frame-silver', stars: 70, kind: 'frame', frame: 'silver', name: 'Silver Frame' },
  { id: 'board-nyx', stars: 100, kind: 'board', board: 'nyx', name: 'Spellcloth Board' },
  { id: 'board-volt', stars: 135, kind: 'board', board: 'volt', name: 'Storm Sky Board' },
  { id: 'frame-gold', stars: 170, kind: 'frame', frame: 'gold', name: 'Gold Frame' },
  { id: 'board-ember', stars: 210, kind: 'board', board: 'ember', name: 'Obsidian Ember Board' },
  { id: 'board-hollow', stars: 250, kind: 'board', board: 'hollow', name: 'The Fracture Board' },
  { id: 'frame-prismatic', stars: Infinity, kind: 'frame', frame: 'prismatic', name: 'Prismatic Frame' },
];

export const STAR_REWARDS: StarReward[] = RAW.map((r) => ({ ...r, stars: Math.min(r.stars, TOTAL_STARS_ALL_DIFFICULTIES) }));

export const rewardUnlocked = (save: SaveData, r: StarReward) => storyStarsEarned(save) >= r.stars;

/** Rewards that became available going from `before` to `after` stars. */
export const rewardsBetween = (before: number, after: number) => STAR_REWARDS.filter((r) => r.stars > before && r.stars <= after);

export const nextReward = (save: SaveData) => STAR_REWARDS.find((r) => !rewardUnlocked(save, r)) ?? null;

/** The frame the player wears, if they picked one and still own it. */
export function equippedFrame(save: SaveData): FrameId | null {
  const id = save.settings.frame;
  const r = STAR_REWARDS.find((x) => x.kind === 'frame' && x.frame === id);
  return r && rewardUnlocked(save, r) && r.kind === 'frame' ? r.frame : null;
}

/** Board background for your side: your pick if owned, otherwise your mage's own board. */
export function myBoardTheme(save: SaveData, mage: string): string {
  const id = save.settings.boardSkin;
  const r = STAR_REWARDS.find((x) => x.kind === 'board' && x.board === id);
  return r && r.kind === 'board' && rewardUnlocked(save, r) ? r.board : mage;
}

export const boardRewardMage = (r: StarReward) => (r.kind === 'board' ? getCharacter(r.board) : null);
