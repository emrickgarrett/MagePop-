import { FightSummary, StarGoal } from './types';

/** Reusable bonus-star goals. */
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;

export const G = {
  under: (ms: number): StarGoal => ({ text: `Win in under ${fmt(ms)}`, check: (r: FightSummary) => r.won && r.durationMs < ms }),
  hpAbove: (pct: number): StarGoal => ({
    text: `Finish with ${pct}%+ HP`,
    check: (r) => r.won && r.hpLeft >= (r.maxHp * pct) / 100,
  }),
  neverBelow: (pct: number): StarGoal => ({
    text: `Never drop below ${pct}% HP`,
    check: (r) => r.won && r.lowestHp >= (r.maxHp * pct) / 100,
  }),
  spells: (n: number): StarGoal => ({ text: `Cast ${n}+ spells`, check: (r) => r.won && r.spells >= n }),
  ultimate: (n = 1): StarGoal => ({ text: n === 1 ? 'Cast an ultimate' : `Cast ${n} ultimates`, check: (r) => r.won && r.ultimates >= n }),
  noHealing: (): StarGoal => ({ text: 'Win without healing', check: (r) => r.won && r.healed === 0 }),
};
