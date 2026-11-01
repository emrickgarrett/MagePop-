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
  | { type: 'gameOver'; winner: PlayerIndex };
