/**
 * Story puzzles ("Lessons"): a fixed board, a move limit and one goal, no opponent.
 * They run on the real engine (a battle with a fixed layout and a dummy opponent that never moves),
 * so spells behave exactly as in a fight. `solvePuzzle` proves a stage can be beaten (used by the
 * tests for every puzzle, and by the in-game Hint button).
 */
import { applyMove, createBattle, tick } from './battle';
import { findValidMoves } from './board';
import { BattleEvent, BattleState, GemColor, Pos } from './types';

export type PuzzleGoal =
  /** Cast a spell (optionally a specific color and/or tier) `count` times. */
  | { kind: 'cast'; color?: GemColor; tier?: 'active' | 'ultimate'; count?: number }
  | { kind: 'damage'; amount: number }
  | { kind: 'shield'; amount: number }
  | { kind: 'heal'; amount: number }
  /** Reach this cascade depth in one move (1 = one cascade after the first match). */
  | { kind: 'combo'; depth: number }
  /** Leave no frozen gems on the board. */
  | { kind: 'clearIce' };

export interface PuzzleStage {
  /** What the player is asked to do, shown above the board. */
  text: string;
  layout: string[];
  moves: number;
  goal: PuzzleGoal;
  /** Start below full HP (for healing lessons). */
  startHp?: number;
  /** Refill seed (refills after the first move); fixed so the stage is the same every time. */
  seed?: number;
}

export interface PuzzleRun {
  state: BattleState;
  /** Spells you've cast this stage, in order. */
  casts: { color: GemColor; tier: 'active' | 'ultimate' }[];
  movesUsed: number;
}

/** A fresh stage: the player's board from the layout; the "opponent" is a dummy with lots of HP. */
export function startPuzzle(stage: PuzzleStage, characterId: string): PuzzleRun {
  const state = createBattle({
    seed: stage.seed ?? 7,
    characters: [characterId, characterId],
    maxHp: [250, 99_999],
    hp: [stage.startHp ?? 250, 99_999],
    rules: { layout: stage.layout },
  });
  return { state, casts: [], movesUsed: 0 };
}

/** Record what a move's events mean for the goal. */
export function notePuzzleEvents(run: PuzzleRun, events: BattleEvent[]) {
  for (const e of events) if (e.type === 'spell' && e.caster === 0) run.casts.push({ color: e.color, tier: e.tier });
}

export function puzzleGoalMet(goal: PuzzleGoal, run: PuzzleRun): boolean {
  const me = run.state.players[0];
  switch (goal.kind) {
    case 'cast':
      return run.casts.filter((c) => (!goal.color || c.color === goal.color) && (!goal.tier || c.tier === goal.tier)).length >= (goal.count ?? 1);
    case 'damage':
      return me.stats.damageDealt >= goal.amount;
    case 'shield':
      return me.shield >= goal.amount;
    case 'heal':
      return me.stats.healed >= goal.amount;
    case 'combo':
      return me.stats.biggestCombo >= goal.depth;
    case 'clearIce':
      return !me.board.cells.some((g) => g && g.frozenUntil > run.state.time);
  }
}

/** Make one move (waiting out any busy time first, since puzzles aren't timed). */
export function puzzleMove(run: PuzzleRun, a: Pos, b: Pos): BattleEvent[] {
  const me = run.state.players[0];
  const wait = Math.max(me.busyUntil, me.stunnedUntil) - run.state.time;
  if (wait > 0) tick(run.state, wait);
  const events = applyMove(run.state, 0, a, b);
  if (!events.some((e) => e.type === 'invalidMove')) {
    run.movesUsed++;
    notePuzzleEvents(run, events);
  }
  return events;
}

const cloneRun = (r: PuzzleRun): PuzzleRun => ({ state: JSON.parse(JSON.stringify(r.state)), casts: [...r.casts], movesUsed: r.movesUsed });

/**
 * Find a sequence of moves that meets the goal within the move limit (depth-first over every legal
 * swap, using the real engine). Returns null if the stage can't be solved from `run`.
 */
export function solvePuzzle(stage: PuzzleStage, run: PuzzleRun): { a: Pos; b: Pos }[] | null {
  if (puzzleGoalMet(stage.goal, run)) return [];
  if (run.movesUsed >= stage.moves) return null;
  const me = run.state.players[0];
  const at = Math.max(run.state.time, me.busyUntil, me.stunnedUntil);
  for (const m of findValidMoves(me.board, at)) {
    const next = cloneRun(run);
    puzzleMove(next, m.a, m.b);
    const rest = solvePuzzle(stage, next);
    if (rest) return [m, ...rest];
  }
  return null;
}
