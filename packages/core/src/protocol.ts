/**
 * PVP wire protocol (JSON over WebSocket).
 *
 * The server is authoritative: clients only send intents ("swap these two gems"), the server runs
 * the shared engine and broadcasts the results. This file is public, so assume every client is
 * hostile: everything a client sends goes through parseClientMessage (strict shape + range
 * checks), and everything the server sends goes through the public* helpers, which strip the
 * board RNG state so nobody can predict upcoming gems.
 */
import { CHARACTER_BY_ID } from './characters';
import { BattleEvent, BattleState, Board, BoardStep, PlayerIndex, PlayerState, Pos } from './types';

export const PROTOCOL_VERSION = 2;

export const LIMITS = {
  /** Longest display name, after cleanup. */
  nameMax: 20,
  /** Largest message the server accepts (bytes). Real messages are well under 200. */
  maxClientMessageBytes: 1024,
} as const;

// ---- messages -------------------------------------------------------------------------

export type ClientMessage =
  | { t: 'hello'; version: number; name: string }
  | { t: 'queue'; characterId: string }
  | { t: 'cancelQueue' }
  /** seq: client-chosen sequence number, echoed back as ackSeq. */
  | { t: 'move'; a: Pos; b: Pos; seq: number }
  | { t: 'forfeit' }
  | { t: 'ping'; at: number }
  /** Rejoin a match after a dropped connection. */
  | { t: 'resume'; token: string };

export interface OpponentInfo {
  name: string;
  characterId: string;
}

export type MatchEndReason = 'ko' | 'forfeit' | 'disconnect' | 'timeout' | 'server';

export type ErrorCode = 'version' | 'badMessage' | 'rateLimited' | 'notReady' | 'unknownCharacter' | 'busy' | 'full' | 'resumeFailed';

export type ServerMessage =
  | { t: 'welcome' }
  | { t: 'queued' }
  | {
      t: 'matchFound';
      you: PlayerIndex;
      opponent: OpponentInfo;
      state: BattleState;
      /** Battle starts (and moves are accepted) after this countdown. */
      startsInMs: number;
      /** Secret for rejoining this match after a disconnect. Only ever sent to its owner. */
      resumeToken: string;
    }
  | { t: 'resumed'; you: PlayerIndex; opponent: OpponentInfo; state: BattleState; startsInMs: number }
  /**
   * Engine events, already applied on the server. `time` is server battle time (for clock sync).
   * `players` is the public state after the events (sent whenever something changed).
   */
  | { t: 'events'; time: number; events: BattleEvent[]; ackSeq?: number; players?: [PlayerState, PlayerState] }
  | { t: 'opponentConnection'; connected: boolean; graceMs?: number }
  | { t: 'matchOver'; winner: PlayerIndex | null; reason: MatchEndReason }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong'; at: number; serverTime: number }
  | { t: 'notice'; message: string };

// ---- validation of client input -------------------------------------------------------

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
const isPos = (x: unknown): x is Pos => isObj(x) && isInt(x.r, 0, 63) && isInt(x.c, 0, 63);

/** True only for real mage ids (never inherited keys like "constructor" or "__proto__"). */
export function isCharacterId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= 32 && Object.prototype.hasOwnProperty.call(CHARACTER_BY_ID, id);
}

/**
 * Clean up a display name: printable characters only (no control or bidi-override characters
 * that could spoof other text), whitespace collapsed, length capped. Empty -> "Mage".
 */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Mage';
  const cleaned = raw
    .slice(0, 200)
    .normalize('NFKC')
    // Tabs, newlines and other whitespace become plain spaces...
    .replace(/\s+/g, ' ')
    // ...then control characters, zero-width characters and bidirectional overrides go.
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '')
    .replace(/ +/g, ' ')
    .trim();
  return [...cleaned].slice(0, LIMITS.nameMax).join('').trim() || 'Mage';
}

/**
 * Parse one raw client message. Returns null for anything malformed: unknown type, wrong field
 * types, out-of-range numbers, unknown mage. Never throws.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > LIMITS.maxClientMessageBytes) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(m) || typeof m.t !== 'string') return null;
  switch (m.t) {
    case 'hello':
      return isInt(m.version, 0, 1_000_000) && typeof m.name === 'string' ? { t: 'hello', version: m.version, name: sanitizeName(m.name) } : null;
    case 'queue':
      return isCharacterId(m.characterId) ? { t: 'queue', characterId: m.characterId } : null;
    case 'cancelQueue':
      return { t: 'cancelQueue' };
    case 'move':
      return isPos(m.a) && isPos(m.b) && isInt(m.seq, 0, Number.MAX_SAFE_INTEGER)
        ? { t: 'move', a: { r: m.a.r, c: m.a.c }, b: { r: m.b.r, c: m.b.c }, seq: m.seq }
        : null;
    case 'forfeit':
      return { t: 'forfeit' };
    case 'ping':
      return typeof m.at === 'number' && Number.isFinite(m.at) ? { t: 'ping', at: m.at } : null;
    case 'resume':
      return typeof m.token === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(m.token) ? { t: 'resume', token: m.token } : null;
    default:
      return null;
  }
}

// ---- public views of server state (no hidden information) ------------------------------

/** A board as clients may see it: the RNG state that decides future refills is removed. */
export function publicBoard(b: Board): Board {
  return { rows: b.rows, cols: b.cols, cells: b.cells.map((g) => (g ? { ...g } : null)), nextId: b.nextId, rng: 0 };
}

export function publicPlayer(p: PlayerState): PlayerState {
  return {
    ...p,
    board: publicBoard(p.board),
    statuses: p.statuses.map((s) => ({ ...s })),
    empower: p.empower ? { ...p.empower } : null,
    stats: { ...p.stats },
  };
}

export function publicState(s: BattleState): BattleState {
  return { time: s.time, over: s.over, winner: s.winner, players: [publicPlayer(s.players[0]), publicPlayer(s.players[1])] };
}

const publicStep = (s: BoardStep): BoardStep => ({ ...s, before: publicBoard(s.before), after: publicBoard(s.after) });

/** Events as clients may see them (board snapshots inside them are stripped too). */
export function publicEvents(events: BattleEvent[]): BattleEvent[] {
  return events.map((e) => (e.type === 'board' ? { ...e, steps: e.steps.map(publicStep) } : e));
}

// ---- seat mirroring (clients always see themselves as player 0) -------------------------

const flip = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

/** Re-index events so `you` becomes player 0. */
export function eventsForSeat(events: BattleEvent[], you: PlayerIndex): BattleEvent[] {
  if (you === 0) return events;
  return events.map((e) => {
    const x = { ...e } as Record<string, unknown>;
    for (const k of ['player', 'caster', 'target', 'winner'] as const) {
      if (typeof x[k] === 'number') x[k] = flip(x[k] as PlayerIndex);
    }
    return x as BattleEvent;
  });
}

export function playersForSeat<T>(players: [T, T], you: PlayerIndex): [T, T] {
  return you === 0 ? players : [players[1], players[0]];
}

export function stateForSeat(s: BattleState, you: PlayerIndex): BattleState {
  if (you === 0) return s;
  const players = playersForSeat(s.players, you).map((p, i) => ({ ...p, index: i as PlayerIndex })) as [PlayerState, PlayerState];
  return { ...s, players, winner: s.winner === null ? null : flip(s.winner) };
}
