export type GemColor = 'ruby' | 'sapphire' | 'emerald' | 'topaz' | 'amethyst';
export const GEM_COLORS: readonly GemColor[] = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'];

export const COLOR_LABEL: Record<GemColor, string> = {
  ruby: 'Ruby',
  sapphire: 'Sapphire',
  emerald: 'Emerald',
  topaz: 'Topaz',
  amethyst: 'Amethyst',
};

export type CellKind = GemColor | 'stone';

export interface Gem {
  id: number;
  kind: CellKind;
  /** Battle time (ms) when the ice melts. 0 = not frozen. */
  frozenUntil: number;
  /** A hollowed gem: drained to a gray shell (kind = 'stone') that remembers its color. */
  hollowOf?: GemColor;
}

export type Cell = Gem | null;

export interface Pos {
  r: number;
  c: number;
}

export interface Board {
  rows: number;
  cols: number;
  /** Row-major, index = r * cols + c. Row 0 is the top. */
  cells: Cell[];
  nextId: number;
  /** Seeded RNG state so the board is fully deterministic and serializable. */
  rng: number;
}

export interface MatchGroup {
  color: GemColor;
  cells: Pos[];
}

export type PlayerIndex = 0 | 1;

// ---------------------------------------------------------------------------
// Spells
// ---------------------------------------------------------------------------

export type Effect =
  | { kind: 'damage'; amount: number }
  | { kind: 'multiHit'; hits: number; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'shield'; amount: number }
  | { kind: 'drain'; amount: number }
  | { kind: 'poison'; perSecond: number; matches: number; maxMs: number; label?: string }
  | { kind: 'regen'; perSecond: number; durationMs: number }
  | { kind: 'freeze'; count: number; durationMs: number }
  | { kind: 'petrify'; count: number }
  | { kind: 'hollow'; count: number }
  | { kind: 'destroy'; count: number; damagePerGem: number }
  | { kind: 'shatter'; damagePerGem: number; minDamage: number }
  | { kind: 'stun'; durationMs: number }
  | { kind: 'empower'; mult: number; charges: number }
  | { kind: 'convert'; count: number; to: GemColor }
  | { kind: 'cleanse' }
  | { kind: 'damageIfPoisoned'; amount: number; bonus: number };

export interface SpellTier {
  name: string;
  effects: Effect[];
  /** Optional flavor line; the mechanical text is generated from effects. */
  flavor?: string;
}

export interface ColorSpell {
  active: SpellTier;
  ultimate: SpellTier;
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  role: string;
  blurb: string;
  /** UI accent colors. */
  palette: { primary: string; secondary: string };
  /** Emoji-free glyph used for placeholder portraits until art exists. */
  sigil: string;
  spells: Record<GemColor, ColorSpell>;
}

// ---------------------------------------------------------------------------
// Battle state
// ---------------------------------------------------------------------------

export interface Status {
  kind: 'poison' | 'regen';
  label: string;
  perTick: number;
  /** Fractional damage/heal carried between ticks. */
  carry: number;
  nextTickAt: number;
  /** For poison: wears off after the victim makes this many more matches. -1 = n/a */
  matchesLeft: number;
  expiresAt: number;
}

export interface PlayerStats {
  moves: number;
  matches: number;
  spells: number;
  ultimates: number;
  damageDealt: number;
  healed: number;
  biggestCombo: number;
  /** Damage past zero on the blow that won the match (0 if you didn't win by damage). */
  overkill: number;
}

export interface PlayerState {
  index: PlayerIndex;
  characterId: string;
  hp: number;
  maxHp: number;
  shield: number;
  board: Board;
  statuses: Status[];
  stunnedUntil: number;
  busyUntil: number;
  empower: { mult: number; charges: number } | null;
  stats: PlayerStats;
}

export interface BattleState {
  time: number;
  players: [PlayerState, PlayerState];
  over: boolean;
  winner: PlayerIndex | null;
  /** Story encounter rules (absent for normal battles and online play). */
  rules?: BattleRules;
  /** Current boss phase (0 = first). */
  phase?: number;
  /** When each rules.pulses entry fires next (battle time, ms). */
  pulseNext?: number[];
  /** Protect fights: the ally's current HP. */
  ally?: { hp: number; maxHp: number; carry: number };
}

// ---------------------------------------------------------------------------
// Encounter rules (story mode). Plain data, so fights are tuned by editing numbers.
// ---------------------------------------------------------------------------

/** Who a rule applies to, from the player's point of view. */
export type RuleTarget = 'player' | 'opponent' | 'both';

export interface SideRules {
  /** Healing does nothing. */
  noHealing?: boolean;
  /** Shields do nothing. */
  noShields?: boolean;
  /** Matching these colors does nothing (no spell, no damage). */
  silenced?: GemColor[];
  /** Multiplies how long each move keeps you busy (1.5 = 50% slower). */
  slowMult?: number;
  /** Multiplies how long ice lasts on this side's board (0.5 = thaws twice as fast). */
  iceMult?: number;
}

/** Protect fights: an ally whose HP drains; your heals go to them instead of you. */
export interface ProtectRule {
  name: string;
  hp: number;
  /** HP the ally loses per second. */
  drainPerSec: number;
}

/** Something "the world" does on a timer: the Heartstone pulsing, a blight spreading... */
export interface Pulse {
  everyMs: number;
  /** First firing (default: everyMs after it becomes active). */
  firstAtMs?: number;
  target: RuleTarget;
  /** Effects are applied as if cast at the target (freeze, petrify, destroy, poison, stun, damage...). */
  effects: Effect[];
  /** Shown in the UI when it fires, e.g. "The Heartstone pulses!". */
  label: string;
  /** Only active from this boss phase on (default 0). */
  fromPhase?: number;
}

export interface BossPhase {
  /** Enters this phase when the opponent's HP falls to this percent or lower. */
  atHpPct: number;
  /** Applied to the opponent on entering (e.g. a heal or shield). */
  onEnter?: Effect[];
}

export interface StartHazards {
  target: RuleTarget;
  stones?: number;
  frozen?: number;
  /** How long starting ice lasts (default 15s). */
  frozenMs?: number;
}

export interface BattleRules {
  /** Per-side tweaks: [player, opponent]. */
  sides?: [SideRules | undefined, SideRules | undefined];
  pulses?: Pulse[];
  start?: StartHazards[];
  /** Survival: the player wins by still being alive at this battle time. */
  surviveMs?: number;
  /** Boss phases for the opponent, in order of falling HP. */
  phases?: BossPhase[];
  /** Protect an ally: you lose if they fall. */
  protect?: ProtectRule;
  /**
   * Fixed starting layout for the player's board (puzzles): one string per row, one letter per cell:
   * r ruby, b sapphire, g emerald, y topaz, p amethyst, s stone; uppercase = frozen.
   */
  layout?: string[];
}

// ---------------------------------------------------------------------------
// Events (what the client animates and what the server broadcasts)
// ---------------------------------------------------------------------------

export type StepKind = 'swap' | 'match' | 'freeze' | 'petrify' | 'destroy' | 'shatter' | 'convert' | 'shuffle';

export interface BoardStep {
  kind: StepKind;
  /** Board just before this step (with cleared gems still present). */
  before: Board;
  /** Board after this step settled (gravity + refill applied). */
  after: Board;
  /** Cells that were cleared / affected in `before` coordinates. */
  affected: Pos[];
  /** Cascade depth for match steps. */
  depth: number;
}

export type BattleEvent = BattleEventBody & {
  /** How long after the event is emitted the client should show it (lines popups up with the cascade). */
  delayMs?: number;
};

export type BattleEventBody =
  | { type: 'board'; player: PlayerIndex; steps: BoardStep[]; external: boolean }
  | { type: 'invalidMove'; player: PlayerIndex; a: Pos; b: Pos; reason: string }
  | { type: 'basic'; caster: PlayerIndex; color: GemColor; damage: number; depth: number }
  | { type: 'spell'; caster: PlayerIndex; color: GemColor; tier: 'active' | 'ultimate'; name: string; size: number; depth: number }
  /** amount = HP lost, absorbed = shield lost. */
  | { type: 'damage'; target: PlayerIndex; amount: number; absorbed: number; source: string }
  | { type: 'heal'; target: PlayerIndex; amount: number; source: string }
  | { type: 'shield'; target: PlayerIndex; amount: number }
  | { type: 'statusAdded'; target: PlayerIndex; status: Status }
  | { type: 'statusRemoved'; target: PlayerIndex; kind: Status['kind'] }
  | { type: 'stun'; target: PlayerIndex; durationMs: number }
  | { type: 'empower'; target: PlayerIndex; mult: number; charges: number }
  | { type: 'cleanse'; target: PlayerIndex }
  | { type: 'gameOver'; winner: PlayerIndex }
  /** Story: a timed pulse fired (label for the UI). */
  | { type: 'pulse'; target: RuleTarget; label: string }
  /** Story: the boss entered a new phase. */
  | { type: 'phase'; phase: number }
  /** Story: a silenced color was matched and did nothing. */
  | { type: 'silenced'; caster: PlayerIndex; color: GemColor }
  /** Story: survival timer ran out with the player alive. */
  | { type: 'survived' }
  /** Story (protect): your healing went to the ally. */
  | { type: 'allyHeal'; amount: number }
  /** Story (protect): the ally fell, so the battle is lost. */
  | { type: 'allyDown' };
