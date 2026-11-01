/**
 * Online play: the connection to the PVP server and the controller that renders a server-run
 * battle with the same visuals as offline play.
 *
 * The server is authoritative; this client only sends intents and draws what the server says.
 * Messages from the network are still validated before use (shape checks, names re-sanitized,
 * mage ids checked) so a bad server or proxy can't crash or spoof the UI. Names are only ever
 * rendered as text by React, never as HTML.
 */
import {
  aiLevel,
  BattleEvent,
  BattleState,
  cloneBoard,
  findGroups,
  isAdjacent,
  isSwappable,
  swapCells,
  TIMING,
  ClientMessage,
  eventsForSeat,
  isCharacterId,
  MatchEndReason,
  normalizeRoomCode,
  OpponentInfo,
  PlayerIndex,
  PlayerState,
  playersForSeat,
  Pos,
  PROTOCOL_VERSION,
  sanitizeName,
  ServerMessage,
  stateForSeat,
} from '@magepop/core';
import { audio } from './audio';
import { BattleController, BattleResult, Frame } from './BattleController';

/** Where to play: set in vite.config.ts (also feeds the Content Security Policy). */
declare const __PVP_SERVER__: string;
export const PVP_SERVER: string = typeof __PVP_SERVER__ === 'string' ? __PVP_SERVER__ : 'ws://localhost:8787';

// ---- validating what the server sends ------------------------------------------------------

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isSeat = (x: unknown): x is PlayerIndex => x === 0 || x === 1;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isPlayers = (x: unknown): x is [PlayerState, PlayerState] =>
  Array.isArray(x) && x.length === 2 && x.every((p) => isObj(p) && isCharacterId(p.characterId) && isNum(p.hp) && isObj(p.board));
const isState = (x: unknown): x is BattleState => isObj(x) && isNum(x.time) && isPlayers(x.players);

function cleanOpponent(x: unknown): OpponentInfo | null {
  if (!isObj(x) || !isCharacterId(x.characterId)) return null;
  return { name: sanitizeName(x.name), characterId: x.characterId };
}

/** Parse and sanity-check one server message. Unknown or malformed messages are dropped. */
export function parseServerMessage(text: string): ServerMessage | null {
  let m: unknown;
  try {
    m = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(m) || typeof m.t !== 'string') return null;
  switch (m.t) {
    case 'welcome':
    case 'queued':
      return { t: m.t };
    case 'matchFound':
    case 'resumed': {
      const opponent = cleanOpponent(m.opponent);
      if (!isSeat(m.you) || !opponent || !isState(m.state) || !isNum(m.startsInMs)) return null;
      const startsInMs = Math.max(0, Math.min(10_000, m.startsInMs));
      if (m.t === 'resumed') return { t: 'resumed', you: m.you, opponent, state: m.state, startsInMs };
      if (typeof m.resumeToken !== 'string') return null;
      return { t: 'matchFound', you: m.you, opponent, state: m.state, startsInMs, resumeToken: m.resumeToken, friendly: m.friendly === true };
    }
    case 'events':
      if (!isNum(m.time) || !Array.isArray(m.events)) return null;
      if (m.players !== undefined && !isPlayers(m.players)) return null;
      return {
        t: 'events',
        time: m.time,
        events: m.events.filter((e): e is BattleEvent => isObj(e) && typeof e.type === 'string'),
        ackSeq: isNum(m.ackSeq) ? m.ackSeq : undefined,
        players: m.players as [PlayerState, PlayerState] | undefined,
      };
    case 'opponentConnection':
      return typeof m.connected === 'boolean' ? { t: m.t, connected: m.connected, graceMs: isNum(m.graceMs) ? m.graceMs : undefined } : null;
    case 'matchOver': {
      const reasons: MatchEndReason[] = ['ko', 'forfeit', 'disconnect', 'timeout', 'server'];
      if (!(m.winner === null || isSeat(m.winner)) || !reasons.includes(m.reason as MatchEndReason)) return null;
      return { t: 'matchOver', winner: m.winner, reason: m.reason as MatchEndReason };
    }
    case 'error':
      return { t: 'error', code: String(m.code).slice(0, 32) as never, message: String(m.message).slice(0, 200) };
    case 'roomCreated': {
      const code = normalizeRoomCode(m.code);
      return code && isNum(m.expiresInMs) ? { t: 'roomCreated', code, expiresInMs: m.expiresInMs } : null;
    }
    case 'roomClosed':
      return m.reason === 'expired' || m.reason === 'cancelled' ? { t: 'roomClosed', reason: m.reason } : null;
    case 'rematch':
      return ['available', 'opponentWants', 'waiting', 'cancelled'].includes(m.status as string)
        ? { t: 'rematch', status: m.status as 'available' | 'opponentWants' | 'waiting' | 'cancelled' }
        : null;
    case 'notice':
      return { t: 'notice', message: String(m.message).slice(0, 200) };
    case 'pong':
      return isNum(m.at) && isNum(m.serverTime) ? { t: 'pong', at: m.at, serverTime: m.serverTime } : null;
    default:
      return null;
  }
}

// ---- connection ------------------------------------------------------------------------------

export type LinkStatus = 'idle' | 'connecting' | 'ready' | 'queued' | 'hosting' | 'inMatch' | 'reconnecting' | 'closed';
type MatchFound = Extract<ServerMessage, { t: 'matchFound' }>;

/**
 * One connection to the PVP server. Handles hello/queue, and if the socket drops mid-match it
 * reconnects and rejoins with the match's resume token (kept in memory only).
 */
export class PvpLink {
  status: LinkStatus = 'idle';
  /** Last error to show the player, if any. */
  error: string | null = null;
  /** The friend-room code we're hosting, while waiting for a friend. */
  roomCode: string | null = null;
  roomExpiresAt = 0;
  /** Latest friend-rematch status (the result screen appears after the server sends it). */
  rematchStatus: 'available' | 'opponentWants' | 'waiting' | 'cancelled' | null = null;
  private ws: WebSocket | null = null;
  private name = 'Mage';
  private resumeToken: string | null = null;
  private reconnectUntil = 0;
  /** Smoothed round-trip time to the server in ms (null until measured). */
  rtt: number | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(m: ServerMessage) => void>();
  private statusListeners = new Set<() => void>();

  constructor(private url = PVP_SERVER) {}

  on(fn: (m: ServerMessage) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn: () => void) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  private setStatus(s: LinkStatus, error: string | null = this.error) {
    this.status = s;
    this.error = error;
    this.statusListeners.forEach((f) => f());
  }

  /** Connect (if needed) and say hello. Resolves once the server welcomes us. */
  connect(name: string): Promise<void> {
    this.name = sanitizeName(name);
    if (this.ws && (this.status === 'ready' || this.status === 'queued' || this.status === 'hosting')) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.setStatus('connecting', null);
      this.open(
        () => resolve(),
        (why) => reject(new Error(why)),
      );
    });
  }

  private open(onWelcome: () => void, onFail: (why: string) => void) {
    let welcomed = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.setStatus('closed', "Couldn't reach the server.");
      return onFail('connect');
    }
    this.ws = ws;
    ws.onopen = () => this.send({ t: 'hello', version: PROTOCOL_VERSION, name: this.name });
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string' || ev.data.length > 1_000_000) return;
      const msg = parseServerMessage(ev.data);
      if (!msg) return;
      if (msg.t === 'welcome' && !welcomed) {
        welcomed = true;
        this.startPing();
        onWelcome();
      }
      this.route(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.stopPing();
      if (!welcomed) {
        if (this.status === 'reconnecting') return this.retryLater();
        this.setStatus('closed', this.error ?? "Couldn't reach the server. Check your connection and try again.");
        return onFail('closed');
      }
      // Dropped mid-match: try to rejoin while the server holds our seat.
      if (this.status === 'inMatch' && this.resumeToken) {
        this.reconnectUntil = Date.now() + 18_000;
        this.setStatus('reconnecting');
        return this.retryLater();
      }
      this.setStatus('closed', this.status === 'closed' ? this.error : 'Disconnected from the server.');
    };
  }

  private retryLater() {
    if (Date.now() > this.reconnectUntil) {
      this.resumeToken = null;
      this.setStatus('closed', 'Lost connection to the match.');
      this.emit({ t: 'matchOver', winner: null, reason: 'disconnect' });
      return;
    }
    setTimeout(() => {
      if (this.status !== 'reconnecting') return;
      this.open(
        () => this.resumeToken && this.send({ t: 'resume', token: this.resumeToken }),
        () => {},
      );
    }, 1500);
  }

  private route(msg: ServerMessage) {
    switch (msg.t) {
      case 'queued':
        this.setStatus('queued', null);
        break;
      case 'rematch':
        this.rematchStatus = msg.status;
        break;
      case 'pong': {
        const sample = performance.now() - msg.at;
        if (sample >= 0 && sample < 30_000) this.rtt = this.rtt === null ? sample : this.rtt * 0.7 + sample * 0.3;
        break;
      }
      case 'matchFound':
        this.resumeToken = msg.resumeToken;
        this.roomCode = null;
        this.rematchStatus = null;
        this.setStatus('inMatch', null);
        break;
      case 'roomCreated':
        this.roomCode = msg.code;
        this.roomExpiresAt = Date.now() + msg.expiresInMs;
        this.setStatus('hosting', null);
        break;
      case 'roomClosed':
        this.roomCode = null;
        this.setStatus('ready', msg.reason === 'expired' ? 'Your room code expired. Make a new one to keep waiting.' : null);
        break;
      case 'resumed':
        this.setStatus('inMatch', null);
        break;
      case 'matchOver':
        this.resumeToken = null;
        this.setStatus(this.ws ? 'ready' : 'closed');
        break;
      case 'error':
        if (msg.code === 'resumeFailed') {
          this.resumeToken = null;
          this.setStatus('ready', 'Lost connection to the match.');
          this.emit({ t: 'matchOver', winner: null, reason: 'disconnect' });
          return;
        }
        this.setStatus(this.status === 'queued' || this.status === 'connecting' ? 'ready' : this.status, msg.message);
        break;
      case 'notice':
        this.error = msg.message;
        break;
    }
    this.emit(msg);
  }

  private emit(msg: ServerMessage) {
    this.listeners.forEach((f) => f(msg));
  }

  /** Measure latency every 2s while connected (well inside the server's rate limit). */
  private startPing() {
    this.stopPing();
    this.rtt = null;
    const ping = () => this.send({ t: 'ping', at: performance.now() });
    ping();
    this.pingTimer = setInterval(ping, 2000);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  queue(characterId: string) {
    this.send({ t: 'queue', characterId });
  }

  createRoom(characterId: string) {
    this.send({ t: 'createRoom', characterId });
  }

  joinRoom(code: string, characterId: string) {
    this.error = null;
    this.send({ t: 'joinRoom', code, characterId });
  }

  closeRoom() {
    this.send({ t: 'closeRoom' });
    this.roomCode = null;
    if (this.status === 'hosting') this.setStatus('ready', null);
  }

  requestRematch() {
    this.send({ t: 'rematch' });
  }

  declineRematch() {
    this.send({ t: 'declineRematch' });
  }

  cancelQueue() {
    this.send({ t: 'cancelQueue' });
    if (this.status === 'queued') this.setStatus('ready', null);
  }

  close() {
    this.stopPing();
    this.resumeToken = null;
    this.roomCode = null;
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.setStatus('idle', null);
  }
}

/** One shared connection for the whole app. */
export const pvp = new PvpLink();

// Dev-only hook for automated testing (stripped from release builds).
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__pvp = pvp;

// ---- a server-run battle, drawn locally ----------------------------------------------------

/**
 * Renders an online match. It never runs the engine itself: board animations, popups and HP all
 * come from server events, mirrored so you're always player 0. Swaps are sent as intents.
 */
export class NetBattleController extends BattleController {
  readonly you: PlayerIndex;
  readonly opponent: OpponentInfo;
  /** For the HUD: are we / they connected right now? */
  opponentGraceUntil: number | null = null;
  private serverTime: number;
  private seq = 0;
  /**
   * The swap we've sent and are waiting on. It's already drawn (optimistic), so when the server's
   * answer arrives we skip redrawing the swap, or slide the gems back if it was rejected.
   */
  private pending: { seq: number; since: number } | null = null;
  private endReason: MatchEndReason | undefined;
  private unsub: () => void;
  private startsAtReal: number;

  constructor(
    private link: PvpLink,
    found: MatchFound,
    onEnd: (r: BattleResult) => void,
  ) {
    const state = stateForSeat(found.state, found.you);
    super({ seed: 0, player: state.players[0].characterId, opponent: state.players[1].characterId, aiLevel: aiLevel(0) }, onEnd, state);
    this.you = found.you;
    this.opponent = found.opponent;
    this.serverTime = state.time;
    this.countdownMs = found.startsInMs;
    this.startsAtReal = performance.now() + found.startsInMs;
    this.unsub = link.on((m) => this.receive(m));
  }

  /** Online battles keep running while you look at the menu. */
  protected override isPaused() {
    return false;
  }

  get reconnecting() {
    return this.link.status === 'reconnecting';
  }

  /** Between server messages, keep the clock moving (capped so it can't run far ahead). */
  protected override simulate(dt: number) {
    // No answer to our swap (dropped message, or the match just ended): put the board back.
    if (this.pending && performance.now() - this.pending.since > 2000) {
      this.pending = null;
      this.snapBack();
    }
    if (this.state.over || performance.now() < this.startsAtReal) return;
    this.state.time = Math.min(this.state.time + dt, this.serverTime + 400);
  }

  override canAct(p: PlayerIndex = 0): boolean {
    return !this.pending && !this.reconnecting && performance.now() >= this.startsAtReal && super.canAct(p);
  }

  /**
   * Swaps animate instantly. We check the swap against our copy of the board: if it can't make a
   * match it bounces back right away and is never sent. Otherwise the swap is drawn now and sent;
   * the server (the only authority) answers with the result.
   */
  override humanMove(a: Pos, b: Pos) {
    if (!this.canAct(0)) return;
    const board = this.state.players[0].board;
    const t = this.state.time;
    const cell = (q: Pos) => board.cells[q.r * board.cols + q.c] ?? null;
    const inside = (q: Pos) => q.r >= 0 && q.c >= 0 && q.r < board.rows && q.c < board.cols;
    if (!inside(a) || !inside(b) || !isAdjacent(a, b) || !isSwappable(cell(a), t) || !isSwappable(cell(b), t)) return;
    const swapped = cloneBoard(board);
    swapCells(swapped, a, b);
    if (findGroups(swapped).length === 0) {
      this.bounce(0, a, b);
      return;
    }
    this.enqueue(0, [this.frameOf(swapped, TIMING.swapMs)]);
    audio.play('swap');
    this.pending = { seq: ++this.seq, since: performance.now() };
    this.link.send({ t: 'move', a, b, seq: this.seq });
  }

  private frameOf(board: Frame['board'], ms: number): Frame {
    return { board: cloneBoard(board), marks: new Map(), drops: new Map(), durationMs: ms, moveMs: ms };
  }

  /** Slide your board back to what the server says it is. */
  private snapBack() {
    this.enqueue(0, [this.frameOf(this.state.players[0].board, TIMING.swapMs)]);
  }

  forfeit() {
    this.link.send({ t: 'forfeit' });
  }

  override snapshot(): BattleResult {
    return { ...super.snapshot(), reason: this.endReason };
  }

  dispose() {
    this.unsub();
  }

  /**
   * The server's answer to our swap. Accepted: drop the swap step (we already drew it) and play
   * the rest. Rejected (e.g. a freeze landed on that gem first): slide the gems back.
   */
  private reconcile(events: BattleEvent[], swapShown: number): BattleEvent[] {
    const rejected = events.some((e) => e.type === 'invalidMove' && e.player === 0);
    if (rejected) {
      this.snapBack();
      audio.play('invalid');
      return events.filter((e) => !(e.type === 'invalidMove' && e.player === 0));
    }
    // Popups are timed from the start of the swap; part of it has already played on screen.
    return events.map((e) => {
      if (e.type === 'board' && e.player === 0 && !e.external && e.steps[0]?.kind === 'swap') return { ...e, steps: e.steps.slice(1) };
      return e.delayMs ? { ...e, delayMs: Math.max(0, e.delayMs - swapShown) } : e;
    });
  }

  private setPlayers(players: [PlayerState, PlayerState]) {
    const mine = playersForSeat(players, this.you);
    this.state.players = [
      { ...mine[0], index: 0 },
      { ...mine[1], index: 1 },
    ];
  }

  private receive(m: ServerMessage) {
    switch (m.t) {
      case 'events': {
        this.serverTime = m.time;
        this.state.time = m.time;
        // Apply the new state first so HP bars hold back until hits land, as offline.
        if (m.players) this.setPlayers(m.players);
        let events = eventsForSeat(m.events, this.you);
        if (m.ackSeq !== undefined && this.pending?.seq === m.ackSeq) {
          const swapShown = Math.min(TIMING.swapMs, performance.now() - this.pending.since);
          this.pending = null;
          events = this.reconcile(events, swapShown);
        }
        if (events.length) this.handleEvents(events);
        break;
      }
      case 'resumed': {
        const s = stateForSeat(m.state, m.you);
        this.serverTime = s.time;
        this.state.time = s.time;
        this.setPlayers(m.state.players);
        this.pending = null;
        // We may have missed animations while away: jump both boards to the real state.
        for (const p of [0, 1] as const) {
          this.display[p].queue.length = 0;
          this.display[p].frame = this.frameOf(this.state.players[p].board, 0);
          this.display[p].elapsed = 0;
        }
        break;
      }
      case 'opponentConnection':
        this.opponentGraceUntil = m.connected ? null : performance.now() + (m.graceMs ?? 20_000);
        break;
      case 'matchOver':
        this.endReason = m.reason;
        this.state.over = true;
        this.state.winner = m.winner === null ? null : m.winner === this.you ? 0 : 1;
        this.unsub();
        break;
    }
  }
}
