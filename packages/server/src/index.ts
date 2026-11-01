/**
 * MagePop PVP server (skeleton).
 *
 * - Matchmaking: a simple FIFO queue pairs the first two waiting players.
 * - Authoritative battles: the server owns the BattleState and runs the shared engine.
 *   Clients send swap intents; the server validates/applies them, ticks time at 20 Hz,
 *   and broadcasts engine events to both players.
 *
 * Not yet: accounts, ranked/ELO, reconnects, horizontal scaling, rate limiting.
 */
import { WebSocketServer, WebSocket } from 'ws';
import {
  applyMove,
  BattleEvent,
  BattleState,
  CHARACTER_BY_ID,
  ClientMessage,
  createBattle,
  PlayerIndex,
  PROTOCOL_VERSION,
  ServerMessage,
  tick,
} from '@magepop/core';

const PORT = Number(process.env.PORT ?? 8787);
const TICK_MS = 50;

interface Client {
  id: string;
  ws: WebSocket;
  name: string;
  characterId?: string;
  match?: Match;
  seat?: PlayerIndex;
}

const send = (c: Client, m: ServerMessage) => {
  if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(m));
};

class Match {
  readonly id = Math.random().toString(36).slice(2, 10);
  readonly state: BattleState;
  private timer: NodeJS.Timeout;
  private last = Date.now();
  private done = false;
  private ticks = 0;

  constructor(readonly seats: [Client, Client]) {
    this.state = createBattle({
      seed: (Math.random() * 2 ** 32) >>> 0,
      characters: [seats[0].characterId!, seats[1].characterId!],
    });
    seats.forEach((c, i) => {
      c.match = this;
      c.seat = i as PlayerIndex;
      send(c, { t: 'matchFound', matchId: this.id, you: i as PlayerIndex, opponentName: seats[1 - i].name, state: this.state });
    });
    this.timer = setInterval(() => this.step(), TICK_MS);
    console.log(`[match ${this.id}] ${seats[0].name} (${seats[0].characterId}) vs ${seats[1].name} (${seats[1].characterId})`);
  }

  private broadcast(events: BattleEvent[], ackFor?: { seat: PlayerIndex; seq: number }) {
    for (const c of this.seats) {
      send(c, {
        t: 'events',
        time: this.state.time,
        events,
        ackSeq: ackFor && ackFor.seat === c.seat ? ackFor.seq : undefined,
        hp: [this.state.players[0].hp, this.state.players[1].hp],
      });
    }
  }

  private step() {
    const now = Date.now();
    const dt = Math.min(200, now - this.last);
    this.last = now;
    const events = tick(this.state, dt);
    // Always send something every 250ms so clients can keep their clocks in sync.
    if (events.length || ++this.ticks % 5 === 0) this.broadcast(events);
    this.checkOver();
  }

  move(seat: PlayerIndex, msg: Extract<ClientMessage, { t: 'move' }>) {
    if (this.done) return;
    const events = applyMove(this.state, seat, msg.a, msg.b);
    this.broadcast(events, { seat, seq: msg.seq });
    this.checkOver();
  }

  end(winner: PlayerIndex, reason: 'ko' | 'forfeit' | 'disconnect') {
    if (this.done) return;
    this.done = true;
    clearInterval(this.timer);
    for (const c of this.seats) {
      send(c, { t: 'matchOver', winner, reason });
      c.match = undefined;
      c.seat = undefined;
    }
    console.log(`[match ${this.id}] over: ${this.seats[winner].name} wins (${reason}) at ${(this.state.time / 1000).toFixed(1)}s`);
  }

  private checkOver() {
    if (this.state.over && this.state.winner !== null) this.end(this.state.winner, 'ko');
  }
}

const queue: Client[] = [];
const removeFromQueue = (c: Client) => {
  const i = queue.indexOf(c);
  if (i >= 0) queue.splice(i, 1);
};

function handle(c: Client, msg: ClientMessage) {
  switch (msg.t) {
    case 'hello':
      if (msg.version !== PROTOCOL_VERSION) return send(c, { t: 'error', message: `Protocol mismatch: server ${PROTOCOL_VERSION}` });
      c.name = String(msg.name).slice(0, 24) || 'Player';
      return send(c, { t: 'welcome', playerId: c.id });
    case 'queue':
      if (c.match) return send(c, { t: 'error', message: 'Already in a match' });
      if (!CHARACTER_BY_ID[msg.characterId]) return send(c, { t: 'error', message: 'Unknown character' });
      // TODO: verify the character is unlocked for this account once accounts exist.
      c.characterId = msg.characterId;
      removeFromQueue(c);
      queue.push(c);
      if (queue.length >= 2) new Match([queue.shift()!, queue.shift()!]);
      else send(c, { t: 'queued', position: queue.length });
      return;
    case 'cancelQueue':
      return removeFromQueue(c);
    case 'move':
      if (c.match && c.seat !== undefined) c.match.move(c.seat, msg);
      return;
    case 'forfeit':
      if (c.match && c.seat !== undefined) c.match.end(c.seat === 0 ? 1 : 0, 'forfeit');
      return;
    case 'ping':
      return send(c, { t: 'pong', at: msg.at, serverTime: c.match?.state.time ?? 0 });
  }
}

export function startServer(port = PORT) {
  const wss = new WebSocketServer({ port });
  wss.on('connection', (ws) => {
    const c: Client = { id: Math.random().toString(36).slice(2, 10), ws, name: 'Player' };
    ws.on('message', (data) => {
      try {
        handle(c, JSON.parse(String(data)) as ClientMessage);
      } catch {
        send(c, { t: 'error', message: 'Bad message' });
      }
    });
    ws.on('close', () => {
      removeFromQueue(c);
      if (c.match && c.seat !== undefined) c.match.end(c.seat === 0 ? 1 : 0, 'disconnect');
    });
  });
  console.log(`MagePop server listening on ws://localhost:${port}`);
  return wss;
}

if (process.argv[1] && /index\.ts$/.test(process.argv[1])) startServer();
