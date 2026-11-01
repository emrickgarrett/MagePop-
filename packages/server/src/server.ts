/**
 * MagePop PVP server.
 *
 * Security model: this code is public and every client is assumed hostile.
 *  - The server is authoritative. Clients send intents; the shared engine validates every move and
 *    paces players, so a modified client can't move faster, fake matches or change HP.
 *  - No hidden information leaves the server: board RNG state is stripped from every snapshot and
 *    event (see publicState/publicEvents), so upcoming gems can't be predicted.
 *  - All input is size-capped, strictly parsed (parseClientMessage) and rate limited; connections
 *    are capped globally and per IP; dead sockets are reaped by heartbeat; matches have a hard time
 *    limit; resume tokens are random 192-bit secrets sent only to their owner.
 *  - No accounts, cookies or other ambient credentials exist, so there is nothing to steal or forge
 *    cross-site. Errors never include stack traces or internal details.
 *  - No secrets live in this repo; deployment config comes from environment variables.
 */
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  applyMove,
  BattleEvent,
  BattleState,
  ClientMessage,
  createBattle,
  ErrorCode,
  LIMITS,
  MatchEndReason,
  OpponentInfo,
  parseClientMessage,
  PlayerIndex,
  PROTOCOL_VERSION,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  publicEvents,
  publicPlayer,
  publicState,
  ServerMessage,
  tick,
} from '@magepop/core';

export interface ServerOptions {
  port: number;
  /** Header holding the real client IP when behind a trusted proxy (e.g. "fly-client-ip"). Never trust it otherwise. */
  trustedIpHeader?: string;
  maxConnections: number;
  maxConnectionsPerIp: number;
  /** Countdown before a match starts. */
  startDelayMs: number;
  /** How long a disconnected player has to come back before they lose. */
  reconnectGraceMs: number;
  /** Hard cap on match length; the higher HP wins after this (tie = no winner). */
  maxMatchMs: number;
  /** Must say hello within this long after connecting. */
  helloTimeoutMs: number;
  heartbeatMs: number;
  /** Token bucket per connection. */
  rate: { burst: number; perSecond: number };
  maxQueue: number;
  /** Friend rooms: how long a code stays valid, how many can exist. */
  roomTtlMs: number;
  maxRooms: number;
  /** Room-code join attempts allowed per IP per minute (stops code guessing). */
  joinAttemptsPerMinute: number;
  /** How long both players have to agree to a friend rematch. */
  rematchWindowMs: number;
  log: (msg: string) => void;
}

export const DEFAULT_OPTIONS: ServerOptions = {
  port: 8787,
  maxConnections: 2000,
  maxConnectionsPerIp: 8,
  startDelayMs: 3000,
  reconnectGraceMs: 20_000,
  maxMatchMs: 10 * 60_000,
  helloTimeoutMs: 10_000,
  heartbeatMs: 15_000,
  rate: { burst: 40, perSecond: 20 },
  maxQueue: 1000,
  roomTtlMs: 10 * 60_000,
  maxRooms: 5000,
  joinAttemptsPerMinute: 10,
  rematchWindowMs: 60_000,
  log: (m) => console.log(`${new Date().toISOString()} ${m}`),
};

const TICK_MS = 50;

interface Conn {
  id: string;
  ws: WebSocket;
  ip: string;
  name: string | null; // null until hello
  characterId?: string;
  match?: Match;
  seat?: PlayerIndex;
  /** The friend room this player is hosting, if any. */
  room?: Room;
  /** A pending friend rematch, if any. */
  rematch?: RematchOffer;
  /** Who you just played, so quick chat ("GG!") still reaches them for a minute after. */
  lastOpponent?: { conn: Conn; until: number };
  /** Recent quick-chat send times, for the chat cooldown. */
  chatTimes: number[];
  alive: boolean;
  tokens: number;
  lastRefill: number;
}

interface Room {
  code: string;
  host: Conn;
  characterId: string;
  timer: NodeJS.Timeout;
}

interface RematchOffer {
  players: [Conn, Conn];
  wants: Set<Conn>;
  timer: NodeJS.Timeout;
}

function send(c: Conn | null | undefined, m: ServerMessage) {
  if (c && c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(m));
}

function fail(c: Conn, code: ErrorCode, message: string, close = false) {
  send(c, { t: 'error', code, message });
  if (close) c.ws.close(1008, code);
}

export class PvpServer {
  readonly opts: ServerOptions;
  private http: Server;
  private wss: WebSocketServer;
  private conns = new Set<Conn>();
  private perIp = new Map<string, number>();
  private queue: Conn[] = [];
  private matches = new Set<Match>();
  /** resume token -> match + seat */
  readonly resumeTokens = new Map<string, { match: Match; seat: PlayerIndex }>();
  private rooms = new Map<string, Room>();
  private joinAttempts = new Map<string, { count: number; resetAt: number }>();
  private heartbeat: NodeJS.Timeout;

  constructor(opts: Partial<ServerOptions> = {}) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
    this.http = createServer((req, res) => {
      // Only a health check over plain HTTP; everything else is the WebSocket upgrade.
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      } else {
        res.writeHead(426, { 'content-type': 'text/plain' }).end('MagePop PVP server: connect with a WebSocket');
      }
    });
    this.wss = new WebSocketServer({ server: this.http, maxPayload: LIMITS.maxClientMessageBytes, perMessageDeflate: false });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    this.heartbeat = setInterval(() => this.reap(), this.opts.heartbeatMs);
  }

  listen(): Promise<number> {
    return new Promise((resolve) =>
      this.http.listen(this.opts.port, () => {
        const addr = this.http.address();
        resolve(typeof addr === 'object' && addr ? addr.port : this.opts.port);
      }),
    );
  }

  /** Graceful stop (deploys): tell everyone, end matches without a result, close. */
  async close(notice = 'The server is restarting. Please reconnect in a moment.') {
    clearInterval(this.heartbeat);
    for (const room of this.rooms.values()) clearTimeout(room.timer);
    this.rooms.clear();
    for (const c of this.conns) this.cancelRematch(c);
    for (const m of [...this.matches]) m.end(null, 'server');
    for (const c of this.conns) {
      send(c, { t: 'notice', message: notice });
      c.ws.close(1001, 'restart');
    }
    await new Promise<void>((r) => this.wss.close(() => r()));
    await new Promise<void>((r) => this.http.close(() => r()));
  }

  get stats() {
    return { connections: this.conns.size, queued: this.queue.length, matches: this.matches.size, rooms: this.rooms.size };
  }

  // ---- connections ----------------------------------------------------------------------

  private clientIp(req: IncomingMessage): string {
    const h = this.opts.trustedIpHeader;
    const fromProxy = h ? req.headers[h.toLowerCase()] : undefined;
    const ip = (Array.isArray(fromProxy) ? fromProxy[0] : fromProxy) ?? req.socket.remoteAddress ?? 'unknown';
    return ip.slice(0, 64);
  }

  private onConnection(ws: WebSocket, req: IncomingMessage) {
    const ip = this.clientIp(req);
    const ipCount = this.perIp.get(ip) ?? 0;
    if (this.conns.size >= this.opts.maxConnections || ipCount >= this.opts.maxConnectionsPerIp) {
      ws.send(JSON.stringify({ t: 'error', code: 'full', message: 'Server is busy. Try again soon.' } satisfies ServerMessage));
      ws.close(1013, 'busy');
      return;
    }
    const c: Conn = { id: randomUUID(), ws, ip, name: null, alive: true, tokens: this.opts.rate.burst, lastRefill: Date.now(), chatTimes: [] };
    this.conns.add(c);
    this.perIp.set(ip, ipCount + 1);

    const helloTimer = setTimeout(() => {
      if (c.name === null) fail(c, 'notReady', 'Say hello first.', true);
    }, this.opts.helloTimeoutMs);

    ws.on('pong', () => (c.alive = true));
    ws.on('message', (data, isBinary) => {
      if (isBinary || !this.takeToken(c)) {
        if (!isBinary) fail(c, 'rateLimited', 'Too many messages.', true);
        else fail(c, 'badMessage', 'Text messages only.', true);
        return;
      }
      const msg = parseClientMessage(data.toString());
      if (!msg) return fail(c, 'badMessage', 'Malformed message.');
      try {
        this.handle(c, msg);
      } catch (err) {
        // Never leak internals to the client; keep a short log line for us.
        this.opts.log(`handler error (${msg.t}): ${err instanceof Error ? err.message.slice(0, 200) : 'unknown'}`);
        fail(c, 'badMessage', 'Something went wrong.');
      }
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      this.conns.delete(c);
      const n = (this.perIp.get(ip) ?? 1) - 1;
      if (n > 0) this.perIp.set(ip, n);
      else this.perIp.delete(ip);
      this.removeFromQueue(c);
      this.closeRoom(c, false);
      this.cancelRematch(c);
      c.match?.disconnected(c);
    });
    ws.on('error', () => ws.terminate());
  }

  private takeToken(c: Conn): boolean {
    const now = Date.now();
    c.tokens = Math.min(this.opts.rate.burst, c.tokens + ((now - c.lastRefill) / 1000) * this.opts.rate.perSecond);
    c.lastRefill = now;
    if (c.tokens < 1) return false;
    c.tokens -= 1;
    return true;
  }

  private reap() {
    for (const c of this.conns) {
      if (!c.alive) {
        c.ws.terminate();
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
  }

  // ---- messages -------------------------------------------------------------------------

  private handle(c: Conn, msg: ClientMessage) {
    if (msg.t === 'hello') {
      if (msg.version !== PROTOCOL_VERSION) return fail(c, 'version', 'Your game is out of date. Please update to play online.', true);
      c.name = msg.name;
      return send(c, { t: 'welcome' });
    }
    if (c.name === null) return fail(c, 'notReady', 'Say hello first.', true);

    switch (msg.t) {
      case 'queue':
        if (c.match) return fail(c, 'busy', 'Already in a match.');
        if (this.queue.length >= this.opts.maxQueue) return fail(c, 'full', 'Matchmaking is full. Try again soon.');
        c.characterId = msg.characterId;
        this.closeRoom(c, false);
        this.cancelRematch(c);
        this.removeFromQueue(c);
        this.queue.push(c);
        send(c, { t: 'queued' });
        return this.matchmake();
      case 'cancelQueue':
        return this.removeFromQueue(c);
      case 'move':
        return c.match?.move(c, msg);
      case 'forfeit':
        return c.match?.forfeit(c);
      case 'ping':
        return send(c, { t: 'pong', at: msg.at, serverTime: c.match?.state.time ?? 0 });
      case 'createRoom':
        return this.createRoom(c, msg.characterId);
      case 'joinRoom':
        return this.joinRoom(c, msg.code, msg.characterId);
      case 'closeRoom':
        return this.closeRoom(c, true);
      case 'rematch':
        return this.acceptRematch(c);
      case 'declineRematch':
        return this.cancelRematch(c);
      case 'chat':
        return this.chat(c, msg.id);
      case 'resume': {
        const entry = this.resumeTokens.get(msg.token);
        if (!entry || c.match) return fail(c, 'resumeFailed', 'That match is no longer available.');
        this.removeFromQueue(c);
        return entry.match.rejoin(entry.seat, c);
      }
    }
  }

  // ---- friend rooms -----------------------------------------------------------------------

  private newRoomCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  private createRoom(c: Conn, characterId: string) {
    if (c.match) return fail(c, 'busy', 'Already in a match.');
    this.removeFromQueue(c);
    this.cancelRematch(c);
    this.closeRoom(c, false); // one room per player: a new code replaces the old one
    if (this.rooms.size >= this.opts.maxRooms) return fail(c, 'full', 'Too many rooms open right now. Try again soon.');
    const code = this.newRoomCode();
    const room: Room = {
      code,
      host: c,
      characterId,
      timer: setTimeout(() => {
        if (this.rooms.get(code) !== room) return;
        this.rooms.delete(code);
        if (c.room === room) c.room = undefined;
        send(c, { t: 'roomClosed', reason: 'expired' });
      }, this.opts.roomTtlMs),
    };
    this.rooms.set(code, room);
    c.room = room;
    send(c, { t: 'roomCreated', code, expiresInMs: this.opts.roomTtlMs });
  }

  /** Per-IP budget for join attempts, so codes can't be guessed by brute force. */
  private allowJoinAttempt(c: Conn): boolean {
    const now = Date.now();
    let a = this.joinAttempts.get(c.ip);
    if (!a || now >= a.resetAt) {
      a = { count: 0, resetAt: now + 60_000 };
      this.joinAttempts.set(c.ip, a);
      // Keep the map from growing without bound.
      if (this.joinAttempts.size > 10_000) for (const [ip, v] of this.joinAttempts) if (now >= v.resetAt) this.joinAttempts.delete(ip);
    }
    a.count++;
    return a.count <= this.opts.joinAttemptsPerMinute;
  }

  private joinRoom(c: Conn, code: string, characterId: string) {
    if (c.match) return fail(c, 'busy', 'Already in a match.');
    if (!this.allowJoinAttempt(c)) return fail(c, 'tooManyAttempts', 'Too many tries. Wait a minute and try again.');
    const room = this.rooms.get(code);
    // Same answer for every failure (unknown, expired, your own, host gone): nothing to learn by probing.
    if (!room || room.host === c || room.host.ws.readyState !== WebSocket.OPEN || room.host.match) {
      return fail(c, 'roomNotFound', 'No room with that code. Check it and try again.');
    }
    this.rooms.delete(code);
    clearTimeout(room.timer);
    const host = room.host;
    host.room = undefined;
    host.characterId = room.characterId;
    this.removeFromQueue(host);
    this.cancelRematch(host);
    this.removeFromQueue(c);
    this.closeRoom(c, false);
    this.cancelRematch(c);
    c.characterId = characterId;
    this.matches.add(new Match(this, [host, c], true));
  }

  private closeRoom(c: Conn, notify: boolean) {
    const room = c.room;
    if (!room) return;
    c.room = undefined;
    clearTimeout(room.timer);
    if (this.rooms.get(room.code) === room) this.rooms.delete(room.code);
    if (notify) send(c, { t: 'roomClosed', reason: 'cancelled' });
  }

  // ---- friend rematches ------------------------------------------------------------------

  /** Called when a friend battle ends with both players still connected. */
  offerRematch(players: [Conn, Conn]) {
    const offer: RematchOffer = {
      players,
      wants: new Set(),
      timer: setTimeout(() => this.cancelRematch(players[0]), this.opts.rematchWindowMs),
    };
    for (const p of players) {
      this.cancelRematch(p);
      p.rematch = offer;
      send(p, { t: 'rematch', status: 'available' });
    }
  }

  private acceptRematch(c: Conn) {
    const offer = c.rematch;
    if (!offer || c.match) return send(c, { t: 'rematch', status: 'cancelled' });
    offer.wants.add(c);
    const other = offer.players[0] === c ? offer.players[1] : offer.players[0];
    if (offer.wants.size < 2) {
      send(c, { t: 'rematch', status: 'waiting' });
      return send(other, { t: 'rematch', status: 'opponentWants' });
    }
    clearTimeout(offer.timer);
    for (const p of offer.players) p.rematch = undefined;
    if (offer.players.some((p) => p.ws.readyState !== WebSocket.OPEN || p.match)) {
      for (const p of offer.players) send(p, { t: 'rematch', status: 'cancelled' });
      return;
    }
    for (const p of offer.players) {
      this.removeFromQueue(p);
      this.closeRoom(p, false);
    }
    this.matches.add(new Match(this, offer.players, true));
  }

  private cancelRematch(c: Conn) {
    const offer = c.rematch;
    if (!offer) return;
    clearTimeout(offer.timer);
    for (const p of offer.players) {
      if (p.rematch === offer) p.rematch = undefined;
      if (p !== c) send(p, { t: 'rematch', status: 'cancelled' });
    }
  }

  // ---- quick chat -----------------------------------------------------------------------

  /** Chat cooldown: at most one message per 1.5s and 3 per 10s. Extra messages are dropped quietly. */
  private chatAllowed(c: Conn): boolean {
    const now = Date.now();
    c.chatTimes = c.chatTimes.filter((t) => now - t < 10_000);
    const last = c.chatTimes[c.chatTimes.length - 1];
    if ((last !== undefined && now - last < 1500) || c.chatTimes.length >= 3) return false;
    c.chatTimes.push(now);
    return true;
  }

  private chat(c: Conn, id: number) {
    const to = c.match ? c.match.opponentOf(c) : c.lastOpponent && Date.now() < c.lastOpponent.until ? c.lastOpponent.conn : null;
    if (!to || !this.chatAllowed(c)) return;
    send(to, { t: 'chat', id });
  }

  private removeFromQueue(c: Conn) {
    const i = this.queue.indexOf(c);
    if (i >= 0) this.queue.splice(i, 1);
  }

  private matchmake() {
    while (this.queue.length >= 2) {
      const a = this.queue.shift()!;
      const b = this.queue.shift()!;
      if (a.ws.readyState !== WebSocket.OPEN) {
        this.queue.unshift(b);
        continue;
      }
      if (b.ws.readyState !== WebSocket.OPEN) {
        this.queue.unshift(a);
        continue;
      }
      this.matches.add(new Match(this, [a, b], false));
    }
  }

  /** Called by a match when it finishes. */
  forget(m: Match) {
    this.matches.delete(m);
    for (const [token, entry] of this.resumeTokens) if (entry.match === m) this.resumeTokens.delete(token);
  }
}

// ---- matches ------------------------------------------------------------------------------

class Match {
  readonly id = randomUUID().slice(0, 8);
  readonly state: BattleState;
  private readonly seats: [Conn | null, Conn | null];
  private readonly info: [OpponentInfo, OpponentInfo];
  private readonly tokens: [string, string];
  private readonly startsAt: number;
  private readonly deadline: number;
  private graceTimers: [NodeJS.Timeout | null, NodeJS.Timeout | null] = [null, null];
  private timer: NodeJS.Timeout;
  private last: number;
  private ticks = 0;
  private done = false;

  constructor(
    private server: PvpServer,
    players: [Conn, Conn],
    /** A friend battle: offers a rematch when it ends. */
    private friendly: boolean,
  ) {
    const o = server.opts;
    this.seats = [players[0], players[1]];
    this.info = [
      { name: players[0].name ?? 'Mage', characterId: players[0].characterId! },
      { name: players[1].name ?? 'Mage', characterId: players[1].characterId! },
    ];
    this.state = createBattle({ seed: randomBytes(4).readUInt32LE(0), characters: [this.info[0].characterId, this.info[1].characterId] });
    this.startsAt = Date.now() + o.startDelayMs;
    this.deadline = this.startsAt + o.maxMatchMs;
    this.last = this.startsAt;
    this.tokens = [randomBytes(24).toString('base64url'), randomBytes(24).toString('base64url')];
    const snapshot = publicState(this.state);
    players.forEach((c, i) => {
      const seat = i as PlayerIndex;
      c.match = this;
      c.seat = seat;
      server.resumeTokens.set(this.tokens[seat], { match: this, seat });
      send(c, {
        t: 'matchFound',
        you: seat,
        opponent: this.info[1 - seat],
        state: snapshot,
        startsInMs: o.startDelayMs,
        resumeToken: this.tokens[seat],
        friendly: friendly || undefined,
      });
    });
    this.timer = setInterval(() => this.step(), TICK_MS);
    o.log(`match ${this.id} start: ${this.info[0].characterId} vs ${this.info[1].characterId}`);
  }

  private started() {
    return Date.now() >= this.startsAt;
  }

  private broadcast(events: BattleEvent[], ack?: { seat: PlayerIndex; seq: number }) {
    const pub = publicEvents(events);
    const players = events.length ? ([publicPlayer(this.state.players[0]), publicPlayer(this.state.players[1])] as const) : undefined;
    this.seats.forEach((c, seat) =>
      send(c, {
        t: 'events',
        time: this.state.time,
        events: pub,
        ackSeq: ack && ack.seat === seat ? ack.seq : undefined,
        players: players ? [players[0], players[1]] : undefined,
      }),
    );
  }

  private step() {
    if (this.done || !this.started()) return;
    const now = Date.now();
    const dt = Math.min(200, now - this.last);
    this.last = now;
    const events = tick(this.state, dt);
    // Something every 250ms so clients keep their clocks in sync.
    if (events.length || ++this.ticks % 5 === 0) this.broadcast(events);
    if (this.state.over) return this.end(this.state.winner, 'ko');
    if (now >= this.deadline) {
      const [a, b] = this.state.players;
      this.end(a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1, 'timeout');
    }
  }

  move(c: Conn, msg: Extract<ClientMessage, { t: 'move' }>) {
    if (this.done || c.seat === undefined || this.seats[c.seat] !== c) return;
    if (!this.started()) return; // countdown: ignore
    const events = applyMove(this.state, c.seat, msg.a, msg.b);
    this.broadcast(events, { seat: c.seat, seq: msg.seq });
    if (this.state.over) this.end(this.state.winner, 'ko');
  }

  /** The other player in this match (null if they're disconnected). */
  opponentOf(c: Conn): Conn | null {
    if (c.seat === undefined || this.seats[c.seat] !== c) return null;
    return this.seats[c.seat === 0 ? 1 : 0];
  }

  forfeit(c: Conn) {
    if (c.seat === undefined || this.seats[c.seat] !== c) return;
    this.end(c.seat === 0 ? 1 : 0, 'forfeit');
  }

  disconnected(c: Conn) {
    if (this.done || c.seat === undefined || this.seats[c.seat] !== c) return;
    const seat = c.seat;
    this.seats[seat] = null;
    // The battle keeps running (no free pause by pulling the plug); they have a grace window to return.
    send(this.seats[1 - seat], { t: 'opponentConnection', connected: false, graceMs: this.server.opts.reconnectGraceMs });
    this.graceTimers[seat] = setTimeout(() => this.end(seat === 0 ? 1 : 0, 'disconnect'), this.server.opts.reconnectGraceMs);
  }

  rejoin(seat: PlayerIndex, c: Conn) {
    if (this.done) return fail(c, 'resumeFailed', 'That match is no longer available.');
    const old = this.seats[seat];
    if (old && old !== c) {
      // Same player on a new connection (e.g. network switch) before the old one timed out.
      old.match = undefined;
      old.seat = undefined;
      old.ws.close(1000, 'replaced');
    }
    if (this.graceTimers[seat]) clearTimeout(this.graceTimers[seat]!);
    this.graceTimers[seat] = null;
    this.seats[seat] = c;
    c.match = this;
    c.seat = seat;
    c.characterId = this.info[seat].characterId;
    send(c, {
      t: 'resumed',
      you: seat,
      opponent: this.info[1 - seat],
      state: publicState(this.state),
      startsInMs: Math.max(0, this.startsAt - Date.now()),
    });
    send(this.seats[1 - seat], { t: 'opponentConnection', connected: true });
  }

  end(winner: PlayerIndex | null, reason: MatchEndReason) {
    if (this.done) return;
    this.done = true;
    clearInterval(this.timer);
    this.graceTimers.forEach((t) => t && clearTimeout(t));
    for (const c of this.seats) {
      send(c, { t: 'matchOver', winner, reason });
      if (c) {
        c.match = undefined;
        c.seat = undefined;
      }
    }
    this.server.forget(this);
    const [a, b] = this.seats;
    if (a && b) {
      const until = Date.now() + 60_000;
      a.lastOpponent = { conn: b, until };
      b.lastOpponent = { conn: a, until };
    }
    if (this.friendly && reason !== 'server' && a && b && a.ws.readyState === WebSocket.OPEN && b.ws.readyState === WebSocket.OPEN) {
      this.server.offerRematch([a, b]);
    }
    this.server.opts.log(`match ${this.id} over: winner=${winner ?? 'none'} reason=${reason} t=${(this.state.time / 1000).toFixed(1)}s`);
  }
}
