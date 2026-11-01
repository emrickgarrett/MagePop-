import {
  applyGravityAndRefill,
  cloneBoard,
  countStones,
  createBoard,
  findGroups,
  findValidMoves,
  getCell,
  idx,
  inBounds,
  isAdjacent,
  isSwappable,
  MAX_STONES,
  neighbors,
  pickRandomCells,
  setCell,
  shuffleBoard,
  swapCells,
} from './board';
import { getCharacter } from './characters';
import { hashSeed, randInt } from './rng';
import {
  BattleEvent,
  BattleEventBody,
  BattleState,
  BoardStep,
  Effect,
  GEM_COLORS,
  MatchGroup,
  PlayerIndex,
  PlayerState,
  Pos,
  Status,
} from './types';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

export const RULES = {
  maxHp: 250,
  basicDamage: 3,
  cascadeBonus: 0.25,
  statusTickMs: 1000,
  maxShield: 60,
  /** A stun landing on an already-stunned target only adds this fraction of its duration. */
  stunStackFactor: 0.5,
};

/** Animation timings. The engine uses these to pace moves, so client and server agree. */
export const TIMING = {
  swapMs: 170,
  clearMs: 230,
  fallMs: 270,
  externalMs: 320,
  invalidMs: 340,
};

export function stepDuration(s: BoardStep): number {
  switch (s.kind) {
    case 'swap':
      return TIMING.swapMs;
    case 'match':
      return TIMING.clearMs + TIMING.fallMs;
    default:
      return TIMING.externalMs;
  }
}

export const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export interface BattleConfig {
  seed: number;
  characters: [string, string];
  /** Starting HP (e.g. carried over in Endless mode). Defaults to max. */
  hp?: [number, number];
  maxHp?: [number, number];
}

function createPlayer(index: PlayerIndex, cfg: BattleConfig): PlayerState {
  const maxHp = cfg.maxHp?.[index] ?? RULES.maxHp;
  getCharacter(cfg.characters[index]); // validate
  return {
    index,
    characterId: cfg.characters[index],
    hp: Math.min(maxHp, cfg.hp?.[index] ?? maxHp),
    maxHp,
    shield: 0,
    board: createBoard(hashSeed(cfg.seed, 'board', index)),
    statuses: [],
    stunnedUntil: 0,
    busyUntil: 0,
    empower: null,
    stats: { moves: 0, matches: 0, spells: 0, ultimates: 0, damageDealt: 0, healed: 0, biggestCombo: 0, overkill: 0 },
  };
}

export function createBattle(cfg: BattleConfig): BattleState {
  return { time: 0, players: [createPlayer(0, cfg), createPlayer(1, cfg)], over: false, winner: null };
}

export function cloneBattle(s: BattleState): BattleState {
  return JSON.parse(JSON.stringify(s)) as BattleState;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Ctx {
  state: BattleState;
  events: BattleEvent[];
  /** Delay applied to events emitted right now (used to sync popups with cascade animation). */
  delay: number;
}

function emit(ctx: Ctx, e: BattleEventBody) {
  ctx.events.push({ ...e, delayMs: ctx.delay } as BattleEvent);
}

function dealDamage(ctx: Ctx, attacker: PlayerIndex, raw: number, source: string, ignoreShield = false): number {
  const { state } = ctx;
  if (state.over) return 0;
  const target = state.players[other(attacker)];
  const amount = Math.max(0, Math.round(raw));
  if (amount === 0) return 0;
  const absorbed = ignoreShield ? 0 : Math.min(target.shield, amount);
  target.shield -= absorbed;
  const hpLoss = Math.min(target.hp, amount - absorbed);
  target.hp -= hpLoss;
  state.players[attacker].stats.damageDealt += hpLoss + absorbed;
  emit(ctx, { type: 'damage', target: target.index, amount: hpLoss, absorbed, source });
  if (target.hp <= 0) {
    state.players[attacker].stats.overkill = amount - absorbed - hpLoss;
    state.over = true;
    state.winner = attacker;
    emit(ctx, { type: 'gameOver', winner: attacker });
  }
  return hpLoss + absorbed;
}

function heal(ctx: Ctx, p: PlayerIndex, raw: number, source: string): number {
  const pl = ctx.state.players[p];
  if (ctx.state.over) return 0;
  const amount = Math.min(pl.maxHp - pl.hp, Math.max(0, Math.round(raw)));
  if (amount <= 0) return 0;
  pl.hp += amount;
  pl.stats.healed += amount;
  emit(ctx, { type: 'heal', target: p, amount, source });
  return amount;
}

function addShield(ctx: Ctx, p: PlayerIndex, raw: number) {
  const pl = ctx.state.players[p];
  const amount = Math.min(RULES.maxShield - pl.shield, Math.max(0, Math.round(raw)));
  if (amount <= 0) return;
  pl.shield += amount;
  emit(ctx, { type: 'shield', target: p, amount });
}

function addStatus(ctx: Ctx, p: PlayerIndex, s: Status) {
  const pl = ctx.state.players[p];
  const existing = pl.statuses.find((x) => x.kind === s.kind);
  if (existing) {
    existing.perTick = Math.max(existing.perTick, s.perTick);
    existing.matchesLeft = Math.max(existing.matchesLeft, s.matchesLeft);
    existing.expiresAt = Math.max(existing.expiresAt, s.expiresAt);
    existing.label = s.label;
    emit(ctx, { type: 'statusAdded', target: p, status: { ...existing } });
  } else {
    pl.statuses.push(s);
    emit(ctx, { type: 'statusAdded', target: p, status: { ...s } });
  }
}

function removeStatus(ctx: Ctx, p: PlayerIndex, kind: Status['kind']) {
  const pl = ctx.state.players[p];
  const before = pl.statuses.length;
  pl.statuses = pl.statuses.filter((s) => s.kind !== kind);
  if (pl.statuses.length !== before) emit(ctx, { type: 'statusRemoved', target: p, kind });
}

function ensureMoves(ctx: Ctx, owner: PlayerIndex, steps: BoardStep[]) {
  const b = ctx.state.players[owner].board;
  if (findValidMoves(b, ctx.state.time).length > 0) return;
  const before = cloneBoard(b);
  shuffleBoard(b, ctx.state.time);
  steps.push({ kind: 'shuffle', before, after: cloneBoard(b), affected: [], depth: 0 });
}

/** Clear matches until the board is stable. `credit` = the owner gets spells/damage for them. */
function resolveMatches(ctx: Ctx, owner: PlayerIndex, credit: boolean, steps: BoardStep[]) {
  const pl = ctx.state.players[owner];
  const b = pl.board;
  let depth = 0;
  for (let guard = 0; guard < 60; guard++) {
    const groups = findGroups(b);
    if (groups.length === 0) break;
    const before = cloneBoard(b);
    const cleared = new Map<number, Pos>();
    for (const g of groups) for (const p of g.cells) cleared.set(idx(b, p.r, p.c), p);
    // Matches crumble adjacent stones.
    for (const g of groups)
      for (const p of g.cells)
        for (const n of neighbors(b, p)) if (getCell(b, n.r, n.c)?.kind === 'stone') cleared.set(idx(b, n.r, n.c), n);
    for (const key of cleared.keys()) b.cells[key] = null;

    if (credit) {
      ctx.delay = TIMING.swapMs + depth * (TIMING.clearMs + TIMING.fallMs) + TIMING.clearMs * 0.6;
      pl.stats.matches += groups.length;
      onMatchesMade(ctx, owner, groups.length);
      for (const g of groups) castFromGroup(ctx, owner, g, depth);
    }
    applyGravityAndRefill(b);
    steps.push({ kind: 'match', before, after: cloneBoard(b), affected: [...cleared.values()], depth });
    depth++;
  }
  if (credit) pl.stats.biggestCombo = Math.max(pl.stats.biggestCombo, depth);
  ensureMoves(ctx, owner, steps);
}

function onMatchesMade(ctx: Ctx, owner: PlayerIndex, n: number) {
  const pl = ctx.state.players[owner];
  for (const s of pl.statuses) {
    if (s.kind === 'poison') {
      s.matchesLeft -= n;
      if (s.matchesLeft <= 0) removeStatus(ctx, owner, 'poison');
    }
  }
}

const DAMAGING = new Set<Effect['kind']>(['damage', 'multiHit', 'drain', 'damageIfPoisoned', 'shatter', 'destroy']);

function castFromGroup(ctx: Ctx, caster: PlayerIndex, g: MatchGroup, depth: number) {
  const { state } = ctx;
  if (state.over) return;
  const pl = state.players[caster];
  const size = g.cells.length;
  const cascade = 1 + RULES.cascadeBonus * depth;
  if (size < 4) {
    const dmg = Math.round(RULES.basicDamage * cascade);
    emit(ctx, { type: 'basic', caster, color: g.color, damage: dmg, depth });
    dealDamage(ctx, caster, dmg, 'basic');
    return;
  }
  const tier = size >= 5 ? 'ultimate' : 'active';
  const spell = getCharacter(pl.characterId).spells[g.color][tier];
  pl.stats.spells++;
  if (tier === 'ultimate') pl.stats.ultimates++;
  emit(ctx, { type: 'spell', caster, color: g.color, tier, name: spell.name, size, depth });

  let dmgMult = cascade;
  if (pl.empower && spell.effects.some((e) => DAMAGING.has(e.kind))) {
    dmgMult *= pl.empower.mult;
    pl.empower.charges--;
    if (pl.empower.charges <= 0) pl.empower = null;
  }
  for (const e of spell.effects) applyEffect(ctx, caster, e, dmgMult, cascade, spell.name);
}

function externalStep(
  ctx: Ctx,
  target: PlayerIndex,
  kind: BoardStep['kind'],
  mutate: (b: PlayerState['board']) => Pos[],
  gravity: boolean,
) {
  const b = ctx.state.players[target].board;
  const steps: BoardStep[] = [];
  const before = cloneBoard(b);
  const affected = mutate(b);
  if (gravity) applyGravityAndRefill(b);
  steps.push({ kind, before, after: cloneBoard(b), affected, depth: 0 });
  if (gravity) resolveMatches(ctx, target, false, steps);
  else ensureMoves(ctx, target, steps);
  emit(ctx, { type: 'board', player: target, steps, external: true });
}

function applyEffect(ctx: Ctx, caster: PlayerIndex, e: Effect, dmgMult: number, cascade: number, source: string) {
  const { state } = ctx;
  if (state.over) return;
  const me = state.players[caster];
  const foe = other(caster);
  const foeState = state.players[foe];
  const now = state.time;
  switch (e.kind) {
    case 'damage':
      dealDamage(ctx, caster, e.amount * dmgMult, source);
      break;
    case 'multiHit':
      for (let i = 0; i < e.hits; i++) dealDamage(ctx, caster, e.amount * dmgMult, source);
      break;
    case 'heal':
      heal(ctx, caster, e.amount * cascade, source);
      break;
    case 'shield':
      addShield(ctx, caster, e.amount * cascade);
      break;
    case 'drain': {
      const dealt = dealDamage(ctx, caster, e.amount * dmgMult, source);
      heal(ctx, caster, dealt, source);
      break;
    }
    case 'damageIfPoisoned': {
      const poisoned = foeState.statuses.some((s) => s.kind === 'poison');
      dealDamage(ctx, caster, (e.amount + (poisoned ? e.bonus : 0)) * dmgMult, source);
      break;
    }
    case 'poison':
      addStatus(ctx, foe, {
        kind: 'poison',
        label: e.label ?? 'Poison',
        perTick: e.perSecond,
        carry: 0,
        nextTickAt: now + RULES.statusTickMs,
        matchesLeft: e.matches,
        expiresAt: now + e.maxMs,
      });
      break;
    case 'regen':
      addStatus(ctx, caster, {
        kind: 'regen',
        label: 'Regen',
        perTick: e.perSecond * cascade,
        carry: 0,
        nextTickAt: now + RULES.statusTickMs,
        matchesLeft: -1,
        expiresAt: now + e.durationMs,
      });
      break;
    case 'freeze':
      externalStep(
        ctx,
        foe,
        'freeze',
        (b) => {
          const cells = pickRandomCells(b, e.count, (g) => g.kind !== 'stone' && g.frozenUntil <= now);
          for (const p of cells) getCell(b, p.r, p.c)!.frozenUntil = now + e.durationMs;
          return cells;
        },
        false,
      );
      break;
    case 'petrify':
      externalStep(
        ctx,
        foe,
        'petrify',
        (b) => {
          const room = Math.max(0, MAX_STONES - countStones(b));
          const cells = pickRandomCells(b, Math.min(room, e.count), (g) => g.kind !== 'stone' && g.frozenUntil <= now);
          for (const p of cells) getCell(b, p.r, p.c)!.kind = 'stone';
          return cells;
        },
        false,
      );
      break;
    case 'destroy': {
      let n = 0;
      externalStep(
        ctx,
        foe,
        'destroy',
        (b) => {
          const cells = pickRandomCells(b, e.count, (g) => g.kind !== 'stone');
          for (const p of cells) setCell(b, p.r, p.c, null);
          n = cells.length;
          return cells;
        },
        true,
      );
      if (n > 0) dealDamage(ctx, caster, n * e.damagePerGem * dmgMult, source);
      break;
    }
    case 'shatter': {
      let n = 0;
      externalStep(
        ctx,
        foe,
        'shatter',
        (b) => {
          const cells = pickRandomCells(b, 999, (g) => g.frozenUntil > now);
          for (const p of cells) setCell(b, p.r, p.c, null);
          n = cells.length;
          return cells;
        },
        true,
      );
      dealDamage(ctx, caster, Math.max(e.minDamage, n * e.damagePerGem) * dmgMult, source);
      break;
    }
    case 'stun': {
      const remaining = foeState.stunnedUntil - now;
      const add = remaining > 0 ? e.durationMs * RULES.stunStackFactor : e.durationMs;
      foeState.stunnedUntil = Math.max(foeState.stunnedUntil, now) + add;
      emit(ctx, { type: 'stun', target: foe, durationMs: foeState.stunnedUntil - now });
      break;
    }
    case 'empower':
      if (!me.empower || me.empower.mult * me.empower.charges <= e.mult * e.charges) {
        me.empower = { mult: e.mult, charges: e.charges };
      }
      emit(ctx, { type: 'empower', target: caster, mult: me.empower.mult, charges: me.empower.charges });
      break;
    case 'convert': {
      // Own board, mid-resolution: converted gems can chain into new (credited) matches.
      const cells = pickRandomCells(me.board, e.count, (g) => g.kind !== 'stone' && g.kind !== e.to);
      for (const p of cells) getCell(me.board, p.r, p.c)!.kind = e.to;
      break;
    }
    case 'cleanse': {
      removeStatus(ctx, caster, 'poison');
      me.stunnedUntil = Math.min(me.stunnedUntil, now);
      for (const g of me.board.cells) {
        if (!g) continue;
        g.frozenUntil = 0;
        if (g.kind === 'stone') g.kind = GEM_COLORS[randInt(me.board, GEM_COLORS.length)];
      }
      emit(ctx, { type: 'cleanse', target: caster });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type MoveRejection = 'over' | 'busy' | 'stunned' | 'bounds' | 'notAdjacent' | 'locked' | 'noMatch';

export function canMove(state: BattleState, p: PlayerIndex): MoveRejection | null {
  const pl = state.players[p];
  if (state.over) return 'over';
  if (state.time < pl.busyUntil) return 'busy';
  if (state.time < pl.stunnedUntil) return 'stunned';
  return null;
}

/** Attempt a swap for player `p`. Mutates state and returns events. */
export function applyMove(state: BattleState, p: PlayerIndex, a: Pos, b: Pos): BattleEvent[] {
  const ctx: Ctx = { state, events: [], delay: 0 };
  const pl = state.players[p];
  const board = pl.board;
  const reject = (reason: MoveRejection) => {
    emit(ctx, { type: 'invalidMove', player: p, a, b, reason });
    return ctx.events;
  };
  const gate = canMove(state, p);
  if (gate) return reject(gate);
  if (!inBounds(board, a.r, a.c) || !inBounds(board, b.r, b.c)) return reject('bounds');
  if (!isAdjacent(a, b)) return reject('notAdjacent');
  if (!isSwappable(getCell(board, a.r, a.c), state.time) || !isSwappable(getCell(board, b.r, b.c), state.time))
    return reject('locked');

  const preSwap = cloneBoard(board);
  swapCells(board, a, b);
  if (findGroups(board).length === 0) {
    swapCells(board, a, b);
    pl.busyUntil = state.time + TIMING.invalidMs;
    return reject('noMatch');
  }
  pl.stats.moves++;
  const steps: BoardStep[] = [{ kind: 'swap', before: preSwap, after: cloneBoard(board), affected: [a, b], depth: 0 }];
  // Emit the board event first so the client starts the animation before popups arrive.
  ctx.events.push({ type: 'board', player: p, steps, external: false, delayMs: 0 });
  resolveMatches(ctx, p, true, steps);
  pl.busyUntil = state.time + steps.reduce((t, s) => t + stepDuration(s), 0);
  return ctx.events;
}

/** Advance battle time: status ticks, expirations. */
export function tick(state: BattleState, dtMs: number): BattleEvent[] {
  const ctx: Ctx = { state, events: [], delay: 0 };
  if (state.over) return ctx.events;
  state.time += dtMs;
  for (const pl of state.players) {
    for (const s of [...pl.statuses]) {
      while (!state.over && s.nextTickAt <= state.time && s.nextTickAt <= s.expiresAt) {
        s.carry += s.perTick;
        const whole = Math.floor(s.carry);
        s.carry -= whole;
        if (whole > 0) {
          if (s.kind === 'poison') dealDamage(ctx, other(pl.index), whole, s.label, true);
          else heal(ctx, pl.index, whole, s.label);
        }
        s.nextTickAt += RULES.statusTickMs;
      }
      if (state.time >= s.expiresAt) removeStatus(ctx, pl.index, s.kind);
    }
  }
  return ctx.events;
}

export function validMoves(state: BattleState, p: PlayerIndex) {
  return findValidMoves(state.players[p].board, state.time);
}
