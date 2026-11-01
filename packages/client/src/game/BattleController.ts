import {
  AiLevel,
  applyMove,
  BattleEvent,
  BattleState,
  Board,
  BoardStep,
  stepDuration,
  canMove,
  chooseMove,
  cloneBoard,
  createBattle,
  getCharacter,
  idx,
  PlayerIndex,
  Pos,
  swapCells,
  thinkDelay,
  tick,
  TIMING,
  COLOR_LABEL,
  Effect,
  GemColor,
} from '@magepop/core';
import { audio, Sfx } from './audio';

// ---------------------------------------------------------------------------
// Display model: what the board *looks* like right now, which lags the engine while animating.
// ---------------------------------------------------------------------------

export type GemFx = 'clear' | 'freeze' | 'petrify' | 'convert' | 'shuffle' | 'destroy' | 'shatter';

export interface Frame {
  board: Board;
  marks: Map<number, GemFx>; // gem id -> fx
  drops: Map<number, number>; // new gem id -> rows to drop from
  durationMs: number;
  moveMs: number; // CSS transition time for gem movement during this frame
}

export interface DisplayBoard {
  frame: Frame;
  queue: Frame[];
  elapsed: number;
}

function newGemDrops(prev: Board, next: Board): Map<number, number> {
  const prevIds = new Set(prev.cells.map((g) => g?.id));
  const perCol = new Array(next.cols).fill(0);
  const drops = new Map<number, number>();
  for (let r = 0; r < next.rows; r++)
    for (let c = 0; c < next.cols; c++) {
      const g = next.cells[idx(next, r, c)];
      if (g && !prevIds.has(g.id)) perCol[c]++;
    }
  for (let c = 0; c < next.cols; c++)
    for (let r = 0; r < next.rows; r++) {
      const g = next.cells[idx(next, r, c)];
      if (g && !prevIds.has(g.id)) drops.set(g.id, perCol[c]);
    }
  return drops;
}

function idsAt(b: Board, ps: Pos[]): number[] {
  return ps.map((p) => b.cells[idx(b, p.r, p.c)]?.id).filter((x): x is number => x !== undefined);
}

export function stepToFrames(step: BoardStep): Frame[] {
  const empty = new Map<number, number>();
  switch (step.kind) {
    case 'swap':
      return [{ board: step.after, marks: new Map(), drops: empty, durationMs: TIMING.swapMs, moveMs: TIMING.swapMs }];
    case 'match':
    case 'destroy':
    case 'shatter': {
      const fx: GemFx = step.kind === 'match' ? 'clear' : step.kind;
      const marks = new Map(idsAt(step.before, step.affected).map((id) => [id, fx] as const));
      const total = step.kind === 'match' ? TIMING.clearMs + TIMING.fallMs : TIMING.externalMs;
      const clearPart = step.kind === 'match' ? TIMING.clearMs : Math.round(total * 0.45);
      return [
        { board: step.before, marks, drops: empty, durationMs: clearPart, moveMs: 0 },
        { board: step.after, marks: new Map(), drops: newGemDrops(step.before, step.after), durationMs: total - clearPart, moveMs: total - clearPart },
      ];
    }
    default: {
      const fx = step.kind as GemFx;
      const ids = step.kind === 'shuffle' ? step.after.cells.map((g) => g?.id ?? -1) : idsAt(step.before, step.affected);
      const marks = new Map(ids.map((id) => [id, fx] as const));
      const half = Math.round(TIMING.externalMs / 2);
      return [
        { board: step.before, marks, drops: empty, durationMs: half, moveMs: 0 },
        { board: step.after, marks, drops: empty, durationMs: TIMING.externalMs - half, moveMs: step.kind === 'shuffle' ? 260 : 0 },
      ];
    }
  }
}

// ---------------------------------------------------------------------------
// Floating text / juice
// ---------------------------------------------------------------------------

export type FxKind = 'damage' | 'heal' | 'shield' | 'spell' | 'basic' | 'status' | 'stun' | 'ultimate';

export interface FloatFx {
  id: number;
  kind: FxKind;
  /** Which side of the screen it appears on. */
  side: PlayerIndex;
  text: string;
  color?: string;
  born: number;
}

interface Scheduled {
  at: number;
  run: () => void;
  /** Pending display adjustment for HP/shield so bars don't move before the hit animation. */
  hpDelta?: { p: PlayerIndex; hp: number; shield: number };
}

export interface BattleSetup {
  seed: number;
  player: string;
  opponent: string;
  aiLevel: AiLevel;
  hp?: [number, number];
}

export interface BattleResult {
  won: boolean;
  state: BattleState;
  durationMs: number;
  /** Your lowest HP during the match. */
  lowestHp: number;
  startHp: number;
}

const FX_LIFETIME = 1500;

// ---------------------------------------------------------------------------
// Spell visuals (projectiles, board auras, ultimate banners). Driven by the controller clock so
// they freeze with the pause menu.
// ---------------------------------------------------------------------------

export type VfxKind =
  | 'projectile'
  | 'impact'
  | 'heal'
  | 'shield'
  | 'poison'
  | 'burn'
  | 'freeze'
  | 'shatter'
  | 'petrify'
  | 'stun'
  | 'empower'
  | 'cleanse'
  | 'ultimate';

export interface Vfx {
  id: number;
  kind: VfxKind;
  /** The board it plays on (projectiles: the target). */
  side: PlayerIndex;
  /** Projectiles: the caster's side. */
  from?: PlayerIndex;
  /** CSS color. */
  color: string;
  born: number;
  duration: number;
  /** 0..1 strength (bigger hits, ultimates). */
  power: number;
  gem?: GemColor;
  theme?: string;
  /** Ultimate banner text. */
  label?: string;
}

/** How long a spell takes to fly from one board to the other. Its effects land on arrival. */
export const PROJECTILE_MS = 420;

const VFX_MS: Record<VfxKind, number> = {
  projectile: PROJECTILE_MS,
  impact: 650,
  heal: 1100,
  shield: 900,
  poison: 1300,
  burn: 1300,
  freeze: 1100,
  shatter: 800,
  petrify: 900,
  stun: 900,
  empower: 1000,
  cleanse: 900,
  ultimate: 1250,
};

/** Effects that land on the opponent (so the spell flies across). */
const OFFENSIVE = new Set<Effect['kind']>([
  'damage',
  'multiHit',
  'drain',
  'poison',
  'freeze',
  'petrify',
  'destroy',
  'shatter',
  'stun',
  'damageIfPoisoned',
]);

const gemColor = (c: GemColor) => `var(--gem-${c})`;

export class BattleController {
  readonly state: BattleState;
  readonly setup: BattleSetup;
  readonly display: [DisplayBoard, DisplayBoard];
  fx: FloatFx[] = [];
  vfx: Vfx[] = [];
  shake: [number, number] = [0, 0]; // real-time ms of last hit per side
  flash: [{ color: string; at: number } | null, { color: string; at: number } | null] = [null, null];
  paused = false;
  ended = false;
  /** Your lowest HP so far (for achievements). */
  lowestHp: number;
  readonly startHp: number;
  /** Damage sources that are status ticks (Poison, Burn, ...), which shouldn't thud every second. */
  private dotLabels = new Set<string>();

  private realNow = 0;
  private lastReal = -1;
  private scheduled: Scheduled[] = [];
  /** Board animations from spells still in flight, per side (see deferBoard). */
  private pendingBoards: [Scheduled[], Scheduled[]] = [[], []];
  private fxId = 1;
  private aiRng: { rng: number };
  private aiNextAt: number | null = null;
  private endAt: number | null = null;
  private onEnd: (r: BattleResult) => void;

  constructor(setup: BattleSetup, onEnd: (r: BattleResult) => void) {
    this.setup = setup;
    this.onEnd = onEnd;
    this.state = createBattle({ seed: setup.seed, characters: [setup.player, setup.opponent], hp: setup.hp });
    this.aiRng = { rng: (setup.seed * 2654435761) >>> 0 };
    const mk = (p: PlayerIndex): DisplayBoard => ({
      frame: { board: cloneBoard(this.state.players[p].board), marks: new Map(), drops: new Map(), durationMs: 0, moveMs: 0 },
      queue: [],
      elapsed: 0,
    });
    this.display = [mk(0), mk(1)];
    this.startHp = this.lowestHp = this.state.players[0].hp;
  }

  /** Snapshot for an unfinished match (forfeit). */
  snapshot(): BattleResult {
    return { won: false, state: this.state, durationMs: this.state.time, lowestHp: this.lowestHp, startHp: this.startHp };
  }

  // ---- input --------------------------------------------------------------

  boardIdle(p: PlayerIndex): boolean {
    const d = this.display[p];
    return d.queue.length === 0 && d.elapsed >= d.frame.durationMs;
  }

  canAct(p: PlayerIndex = 0): boolean {
    return !this.paused && !this.ended && this.boardIdle(p) && canMove(this.state, p) === null;
  }

  humanMove(a: Pos, b: Pos) {
    if (!this.canAct(0)) return;
    this.handleEvents(applyMove(this.state, 0, a, b));
  }

  // ---- loop ---------------------------------------------------------------

  update(realMs: number) {
    if (this.lastReal < 0) this.lastReal = realMs;
    const dt = Math.min(50, realMs - this.lastReal);
    this.lastReal = realMs;
    if (this.paused) return;
    this.realNow += dt;

    if (!this.state.over) this.handleEvents(tick(this.state, dt));
    this.lowestHp = Math.min(this.lowestHp, this.state.players[0].hp);
    this.runAi();
    for (const d of this.display) this.advanceDisplay(d, dt);

    const due = this.scheduled.filter((s) => s.at <= this.realNow);
    if (due.length) {
      this.scheduled = this.scheduled.filter((s) => s.at > this.realNow);
      due.forEach((s) => s.run());
    }
    this.fx = this.fx.filter((f) => this.realNow - f.born < FX_LIFETIME);
    this.vfx = this.vfx.filter((v) => this.realNow - v.born < v.duration);

    if (this.state.over && !this.ended) {
      const settled = this.display.every((d) => d.queue.length === 0) && this.scheduled.length === 0;
      if (settled && this.endAt === null) this.endAt = this.realNow + 1100;
      if (this.endAt !== null && this.realNow >= this.endAt) {
        this.ended = true;
        this.lowestHp = Math.min(this.lowestHp, this.state.players[0].hp);
        this.onEnd({ won: this.state.winner === 0, state: this.state, durationMs: this.state.time, lowestHp: this.lowestHp, startHp: this.startHp });
      }
    }
  }

  get now() {
    return this.realNow;
  }

  /** HP/shield as shown (engine value, minus hits whose animations haven't landed yet). */
  shownVitals(p: PlayerIndex) {
    const pl = this.state.players[p];
    let hp = pl.hp;
    let shield = pl.shield;
    for (const s of this.scheduled) {
      if (s.hpDelta && s.hpDelta.p === p) {
        hp -= s.hpDelta.hp;
        shield -= s.hpDelta.shield;
      }
    }
    return { hp: Math.max(0, Math.min(pl.maxHp, hp)), shield: Math.max(0, shield), maxHp: pl.maxHp };
  }

  // ---- internals ----------------------------------------------------------

  private runAi() {
    const s = this.state;
    if (s.over) return;
    const free = this.boardIdle(1) && canMove(s, 1) === null;
    if (!free) {
      if (s.time < s.players[1].stunnedUntil) this.aiNextAt = null;
      return;
    }
    if (this.aiNextAt === null) this.aiNextAt = s.time + thinkDelay(this.setup.aiLevel, this.aiRng);
    if (s.time >= this.aiNextAt) {
      this.aiNextAt = null;
      const m = chooseMove(s, 1, this.setup.aiLevel, this.aiRng);
      if (m) this.handleEvents(applyMove(s, 1, m.a, m.b));
    }
  }

  private advanceDisplay(d: DisplayBoard, dt: number) {
    d.elapsed += dt;
    while (d.queue.length && d.elapsed >= d.frame.durationMs) {
      d.elapsed -= d.frame.durationMs;
      d.frame = d.queue.shift()!;
    }
    if (!d.queue.length && d.elapsed >= d.frame.durationMs) d.elapsed = d.frame.durationMs;
  }

  private enqueue(p: PlayerIndex, frames: Frame[]) {
    const d = this.display[p];
    if (d.queue.length === 0 && d.elapsed >= d.frame.durationMs) {
      // Idle: start immediately.
      d.elapsed = 0;
      d.frame = frames[0];
      d.queue.push(...frames.slice(1));
    } else {
      d.queue.push(...frames);
    }
  }

  private pushFx(side: PlayerIndex, kind: FxKind, text: string, color?: string) {
    this.fx.push({ id: this.fxId++, side, kind, text, color, born: this.realNow });
  }

  private pushVfx(v: Omit<Vfx, 'id' | 'born' | 'duration' | 'power'> & { power?: number; duration?: number }) {
    this.vfx.push({ power: 0.5, duration: VFX_MS[v.kind], ...v, id: this.fxId++, born: this.realNow });
  }

  /**
   * Show a spell's effect on the target board when its projectile arrives. If that board's owner
   * moves first, play it immediately so animations never run out of order.
   */
  private deferBoard(p: PlayerIndex, delay: number, run: () => void) {
    if (delay <= 0) return run();
    const entry: Scheduled = { at: this.realNow + delay, run: () => {} };
    entry.run = () => {
      this.pendingBoards[p] = this.pendingBoards[p].filter((x) => x !== entry);
      run();
    };
    this.pendingBoards[p].push(entry);
    this.scheduled.push(entry);
  }

  private flushBoards(p: PlayerIndex) {
    const pending = this.pendingBoards[p];
    if (!pending.length) return;
    this.scheduled = this.scheduled.filter((s) => !pending.includes(s));
    [...pending].forEach((s) => s.run());
  }

  private later(delay: number, run: () => void, hpDelta?: Scheduled['hpDelta']) {
    if (!delay || delay <= 0) {
      run();
      return;
    }
    this.scheduled.push({ at: this.realNow + delay, run, hpDelta });
  }

  /**
   * Sounds for a board animation. Your own moves get swap/pop sounds; the opponent's own moves are
   * silent. Spell effects landing on a board (freeze, stone, destroy, shatter) always play: on your
   * board that's their spell hitting you, on theirs it's yours landing.
   */
  private boardSounds(player: PlayerIndex, steps: BoardStep[], startDelay: number, external: boolean) {
    if (player === 1 && !external) return;
    const vol = player === 0 ? 1 : 0.7;
    let t = startDelay;
    for (const step of steps) {
      let name: Sfx | null = null;
      let pitch = 1;
      // Cascades triggered by a spell on someone's board are side effects; only the hit itself sounds.
      if (external && (step.kind === 'match' || step.kind === 'swap')) {
        t += stepDuration(step);
        continue;
      }
      switch (step.kind) {
        case 'swap':
          name = 'swap';
          break;
        case 'match':
          name = 'match';
          pitch = Math.min(2, 1 + 0.12 * step.depth);
          break;
        case 'freeze':
          name = 'freeze';
          break;
        case 'petrify':
          name = 'stone';
          break;
        case 'shatter':
          name = 'shatter';
          break;
        case 'destroy':
          name = 'hit';
          break;
        case 'shuffle':
          name = 'swap';
          pitch = 0.7;
          break;
      }
      if (name) {
        const n = name;
        const p = pitch;
        this.later(t, () => audio.play(n, { volume: vol, pitch: p }));
      }
      t += stepDuration(step);
    }
  }

  private handleEvents(events: BattleEvent[]) {
    // Events after a 'spell' belong to it until the next spell/basic. If it targets the opponent,
    // everything landing on them waits for the projectile.
    let flying: { caster: PlayerIndex } | null = null;
    for (const e of events) {
      if (e.type === 'spell') {
        const spell = getCharacter(this.state.players[e.caster].characterId).spells[e.color][e.tier];
        flying = spell.effects.some((x) => OFFENSIVE.has(x.kind)) ? { caster: e.caster } : null;
      } else if (e.type === 'basic') {
        flying = null;
      }
      const target = 'target' in e ? e.target : e.type === 'board' && e.external ? e.player : null;
      const travel = flying && target !== null && target !== flying.caster ? PROJECTILE_MS : 0;
      const delay = (e.delayMs ?? 0) + travel;
      switch (e.type) {
        case 'board': {
          const frames = e.steps.flatMap(stepToFrames);
          if (!e.external) {
            this.flushBoards(e.player);
            if (frames.length) this.enqueue(e.player, frames);
            this.boardSounds(e.player, e.steps, 0, false);
            break;
          }
          const first = e.steps[0]?.kind;
          this.deferBoard(e.player, travel ? delay : 0, () => {
            if (frames.length) this.enqueue(e.player, frames);
            if (first === 'freeze') this.pushVfx({ kind: 'freeze', side: e.player, color: '#bfeaff' });
            else if (first === 'shatter') this.pushVfx({ kind: 'shatter', side: e.player, color: '#dff6ff', power: 0.9 });
            else if (first === 'petrify') this.pushVfx({ kind: 'petrify', side: e.player, color: '#b9a98f' });
          });
          this.boardSounds(e.player, e.steps, travel ? delay : 0, true);
          break;
        }
        case 'invalidMove': {
          if (e.reason === 'noMatch') {
            const base = this.display[e.player].frame.board;
            const swapped = cloneBoard(base);
            swapCells(swapped, e.a, e.b);
            const half = TIMING.invalidMs / 2;
            this.enqueue(e.player, [
              { board: swapped, marks: new Map(), drops: new Map(), durationMs: half, moveMs: half },
              { board: cloneBoard(base), marks: new Map(), drops: new Map(), durationMs: half, moveMs: half },
            ]);
            if (e.player === 0) audio.play('invalid');
          }
          break;
        }
        case 'basic':
          break; // damage event carries the number
        case 'spell': {
          const ch = getCharacter(this.state.players[e.caster].characterId);
          const flyingNow = !!flying;
          this.later(delay, () => {
            this.pushFx(e.caster, e.tier === 'ultimate' ? 'ultimate' : 'spell', `${e.name}${e.tier === 'ultimate' ? '!!' : '!'}`, ch.palette.primary);
            this.flash[e.caster] = { color: `var(--gem-${e.color})`, at: this.realNow };
            // Only your casts chime; the opponent's spells are heard when they land on you.
            if (e.caster === 0) audio.play(e.tier === 'ultimate' ? 'ultimate' : 'spell');
            const ult = e.tier === 'ultimate';
            if (ult) this.pushVfx({ kind: 'ultimate', side: e.caster, color: ch.palette.primary, label: e.name, theme: ch.id, power: 1 });
            if (flyingNow) {
              this.pushVfx({
                kind: 'projectile',
                side: (1 - e.caster) as PlayerIndex,
                from: e.caster,
                color: gemColor(e.color),
                gem: e.color,
                theme: ch.id,
                power: ult ? 1 : 0.55,
              });
            }
          });
          break;
        }
        case 'damage': {
          const total = e.amount + e.absorbed;
          if (total <= 0) break;
          this.later(
            delay,
            () => {
              this.pushFx(e.target, 'damage', `-${total}${e.absorbed ? ` (${e.absorbed} blocked)` : ''}`);
              this.shake[e.target] = this.realNow;
              if (!this.dotLabels.has(e.source) && e.source !== 'basic') {
                this.pushVfx({ kind: 'impact', side: e.target, color: e.absorbed > e.amount ? '#7fc8ff' : '#ff7a4d', power: Math.min(1, total / 24) });
              }
              // You hear: your hits on them, and their spells hitting you (not their basic 3-match
              // chip damage). Poison/burn ticks get a soft bubble instead of a hit.
              if (this.dotLabels.has(e.source)) {
                audio.play('poison', { volume: e.target === 0 ? 0.3 : 0.18, pitch: 0.85 });
              } else if (e.target === 1 || e.source !== 'basic') {
                audio.play('hit', { volume: e.target === 0 ? 1 : 0.7, pitch: e.target === 0 ? 0.9 : 1.05 });
              }
            },
            { p: e.target, hp: e.amount, shield: e.absorbed },
          );
          break;
        }
        case 'heal':
          this.later(
            delay,
            () => {
              this.pushFx(e.target, 'heal', `+${e.amount}`);
              if (e.source !== 'Regen') this.pushVfx({ kind: 'heal', side: e.target, color: '#7dffa8', power: Math.min(1, e.amount / 14) });
              if (e.target === 0 && e.source !== 'Regen') audio.play('heal');
            },
            { p: e.target, hp: -e.amount, shield: 0 },
          );
          break;
        case 'shield':
          this.later(
            delay,
            () => {
              this.pushFx(e.target, 'shield', `+${e.amount} shield`);
              this.pushVfx({ kind: 'shield', side: e.target, color: '#7fc8ff', power: Math.min(1, e.amount / 12) });
              if (e.target === 0) audio.play('shield');
            },
            { p: e.target, hp: 0, shield: -e.amount },
          );
          break;
        case 'statusAdded':
          this.dotLabels.add(e.status.label);
          this.later(delay, () => {
            this.pushFx(e.target, 'status', e.status.label);
            if (e.status.kind === 'poison') {
              const burn = /burn|fire|flame/i.test(e.status.label);
              this.pushVfx({ kind: burn ? 'burn' : 'poison', side: e.target, color: burn ? '#ff9a3c' : '#9be15d' });
            } else {
              this.pushVfx({ kind: 'heal', side: e.target, color: '#b8ff9c', power: 0.35 });
            }
            if (e.status.kind === 'poison' && e.target === 0) audio.play('poison');
          });
          break;
        case 'stun':
          this.later(delay, () => {
            this.pushFx(e.target, 'stun', 'Stunned!');
            this.pushVfx({ kind: 'stun', side: e.target, color: '#ffe45c', duration: Math.max(700, Math.min(1600, e.durationMs)) });
            audio.play('stun', { volume: e.target === 0 ? 1 : 0.7 });
          });
          break;
        case 'empower':
          this.later(delay, () => {
            this.pushFx(e.target, 'status', `Empowered x${e.mult}`);
            this.pushVfx({ kind: 'empower', side: e.target, color: '#ffd36b' });
          });
          break;
        case 'cleanse':
          this.later(delay, () => {
            this.pushFx(e.target, 'heal', 'Cleansed');
            this.pushVfx({ kind: 'cleanse', side: e.target, color: '#e8fff4' });
          });
          break;
        case 'statusRemoved':
        case 'gameOver':
          break;
      }
    }
  }
}

export { COLOR_LABEL };
