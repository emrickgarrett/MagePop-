/**
 * PVP wire protocol (JSON over WebSocket). The server is authoritative: clients only send
 * intents, the server runs the shared engine and broadcasts the resulting events.
 */
import { BattleEvent, BattleState, PlayerIndex, Pos } from './types';

export const PROTOCOL_VERSION = 1;

export type ClientMessage =
  | { t: 'hello'; version: number; name: string }
  | { t: 'queue'; characterId: string }
  | { t: 'cancelQueue' }
  | { t: 'move'; a: Pos; b: Pos; /** client-side sequence number for acks */ seq: number }
  | { t: 'forfeit' }
  | { t: 'ping'; at: number };

export type ServerMessage =
  | { t: 'welcome'; playerId: string }
  | { t: 'queued'; position: number }
  | { t: 'matchFound'; matchId: string; you: PlayerIndex; opponentName: string; state: BattleState }
  /** Engine events, already applied on the server, plus server battle time for clock sync. */
  | { t: 'events'; time: number; events: BattleEvent[]; ackSeq?: number; /** authoritative HP, for desync checks */ hp: [number, number] }
  | { t: 'matchOver'; winner: PlayerIndex; reason: 'ko' | 'forfeit' | 'disconnect' }
  | { t: 'error'; message: string }
  | { t: 'pong'; at: number; serverTime: number };
