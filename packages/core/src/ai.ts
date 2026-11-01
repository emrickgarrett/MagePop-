import { cloneBoard, findGroups, findValidMoves, swapCells } from './board';
import { applyMove, cloneBattle, other } from './battle';
import { getCharacter } from './characters';
import { RngHolder, rand, randInt } from './rng';
import { BattleEvent, BattleState, Effect, PlayerIndex, Pos } from './types';

export interface AiLevel {
  id: string;
  name: string;
  /** Delay before the bot makes a move once it's free to act. */
  thinkMs: number;
  /** +/- random spread on think time. */
  thinkJitterMs: number;
  /** Chance to just play a random legal move. */
  randomChance: number;
  /** Simulate full cascades (and the real refill) instead of only the first match. */
  seesCascades: boolean;
}

export const AI_LEVELS: AiLevel[] = [
  { id: 'novice', name: 'Novice', thinkMs: 3200, thinkJitterMs: 900, randomChance: 0.4, seesCascades: false },
  { id: 'apprentice', name: 'Apprentice', thinkMs: 2600, thinkJitterMs: 700, randomChance: 0.25, seesCascades: false },
  { id: 'adept', name: 'Adept', thinkMs: 2000, thinkJitterMs: 600, randomChance: 0.12, seesCascades: false },
  { id: 'expert', name: 'Expert', thinkMs: 1500, thinkJitterMs: 450, randomChance: 0.05, seesCascades: true },
  { id: 'master', name: 'Master', thinkMs: 1100, thinkJitterMs: 300, randomChance: 0, seesCascades: true },
  { id: 'nightmare', name: 'Nightmare', thinkMs: 800, thinkJitterMs: 200, randomChance: 0, seesCascades: true },
];

export function aiLevel(i: number): AiLevel {
  return AI_LEVELS[Math.max(0, Math.min(AI_LEVELS.length - 1, i))];
}

/** Rough value of an effect for the caster, given the situation. */
export function effectValue(state: BattleState, me: PlayerIndex, e: Effect): number {
  const self = state.players[me];
  const foe = state.players[other(me)];
  const missing = self.maxHp - self.hp;
  const lowHp = self.hp / self.maxHp < 0.4;
  const killBonus = (amt: number) => (amt >= foe.hp + foe.shield ? 50 : 0);
  switch (e.kind) {
    case 'damage':
      return e.amount + killBonus(e.amount);
    case 'multiHit':
      return e.hits * e.amount + killBonus(e.hits * e.amount);
    case 'drain':
      return e.amount + Math.min(e.amount, missing) * 0.8 + killBonus(e.amount);
    case 'damageIfPoisoned': {
      const amt = e.amount + (foe.statuses.some((s) => s.kind === 'poison') ? e.bonus : 0);
      return amt + killBonus(amt);
    }
    case 'heal':
      return Math.min(e.amount, missing) * (lowHp ? 1.6 : 1.0);
    case 'regen':
      return Math.min((e.perSecond * e.durationMs) / 1000, missing) * (lowHp ? 1.3 : 0.9);
    case 'shield':
      return Math.min(e.amount, 60 - self.shield) * (lowHp ? 1.2 : 0.75);
    case 'poison':
      return foe.statuses.some((s) => s.kind === 'poison') ? e.perSecond * 2 : e.perSecond * Math.min(e.maxMs / 1000, e.matches * 2.5) * 0.8;
    case 'freeze':
      return e.count * 1.4;
    case 'petrify':
      return e.count * 2;
    case 'destroy':
      return e.count * (0.6 + e.damagePerGem);
    case 'shatter': {
      const frozen = foe.board.cells.filter((g) => g && g.frozenUntil > state.time).length;
      return Math.max(e.minDamage, frozen * e.damagePerGem) + frozen * 0.5;
    }
    case 'stun':
      return (e.durationMs / 1000) * (state.time < foe.stunnedUntil ? 2 : 5);
    case 'empower':
      return (e.mult - 1) * 10 * e.charges;
    case 'convert':
      return e.count * 1.2;
    case 'cleanse': {
      const debuffed =
        self.statuses.some((s) => s.kind === 'poison') ||
        self.board.cells.some((g) => g && (g.kind === 'stone' || g.frozenUntil > state.time));
      return debuffed ? 9 : 1;
    }
  }
}

function spellValue(state: BattleState, me: PlayerIndex, color: string, tier: 'active' | 'ultimate'): number {
  const ch = getCharacter(state.players[me].characterId);
  const spell = ch.spells[color as keyof typeof ch.spells][tier];
  return spell.effects.reduce((v, e) => v + effectValue(state, me, e), 0);
}

function scoreEvents(state: BattleState, me: PlayerIndex, events: BattleEvent[]): number {
  let score = 0;
  for (const e of events) {
    if (e.type === 'basic' && e.caster === me) score += e.damage;
    if (e.type === 'spell' && e.caster === me) score += spellValue(state, me, e.color, e.tier) * (1 + 0.25 * e.depth);
    if (e.type === 'gameOver' && e.winner === me) score += 1000;
  }
  return score;
}

/** Score just the immediate matches created by a swap (no gravity, no refill knowledge). */
function scoreShallow(state: BattleState, me: PlayerIndex, a: Pos, b: Pos): number {
  const board = cloneBoard(state.players[me].board);
  swapCells(board, a, b);
  let score = 0;
  for (const g of findGroups(board)) {
    const n = g.cells.length;
    score += n < 4 ? 3 : spellValue(state, me, g.color, n >= 5 ? 'ultimate' : 'active');
  }
  // Slight preference for moves lower on the board (more likely to cascade).
  return score + (a.r + b.r) * 0.05;
}

export function chooseMove(state: BattleState, me: PlayerIndex, level: AiLevel, rng: RngHolder): { a: Pos; b: Pos } | null {
  const moves = findValidMoves(state.players[me].board, state.time);
  if (moves.length === 0) return null;
  if (rand(rng) < level.randomChance) return moves[randInt(rng, moves.length)];

  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    let s: number;
    if (level.seesCascades) {
      const sim = cloneBattle(state);
      sim.players[me].busyUntil = 0;
      sim.players[me].stunnedUntil = 0;
      // Don't peek at the real refill RNG: bots see gravity cascades, but guess at new gems.
      sim.players[me].board.rng = (rand(rng) * 4294967296) >>> 0;
      s = scoreEvents(state, me, applyMove(sim, me, m.a, m.b));
    } else {
      s = scoreShallow(state, me, m.a, m.b);
    }
    s += rand(rng) * 0.5; // break ties
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

/** Think time for the bot's next move. */
export function thinkDelay(level: AiLevel, rng: RngHolder): number {
  return Math.max(250, level.thinkMs + (rand(rng) * 2 - 1) * level.thinkJitterMs);
}
