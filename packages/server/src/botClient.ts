/**
 * Headless bot clients for testing the server end to end:
 *   npm run server                     (terminal 1)
 *   npm run bots -w @magepop/server    (terminal 2): two bots queue and fight over the wire.
 *
 * Bots see exactly what a real client sees: the public state snapshots the server sends (no RNG),
 * and they pick moves from that mirror.
 */
import WebSocket from 'ws';
import { aiLevel, BattleState, chooseMove, ClientMessage, PlayerIndex, PROTOCOL_VERSION, ServerMessage } from '@magepop/core';

const URL = process.env.SERVER ?? 'ws://localhost:8787';

export interface BotResult {
  won: boolean;
  winner: PlayerIndex | null;
  reason: string;
  moves: number;
  rejected: number;
}

export function runBot(name: string, characterId: string, opts: { level?: number; url?: string; thinkMs?: number } = {}): Promise<BotResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(opts.url ?? URL);
    const out = (m: ClientMessage) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
    let state: BattleState | null = null;
    let seat: PlayerIndex = 0;
    let seq = 0;
    let moves = 0;
    let rejected = 0;
    const rng = { rng: Math.floor(Math.random() * 1e9) };
    const timer = setInterval(() => {
      if (!state || state.over) return;
      const me = state.players[seat];
      if (state.time >= me.busyUntil && state.time >= me.stunnedUntil) {
        const m = chooseMove(state, seat, aiLevel(opts.level ?? 3), rng);
        if (m) {
          out({ t: 'move', a: m.a, b: m.b, seq: ++seq });
          moves++;
        }
      }
    }, opts.thinkMs ?? 600);

    ws.on('open', () => out({ t: 'hello', version: PROTOCOL_VERSION, name }));
    ws.on('message', (data) => {
      const msg = JSON.parse(String(data)) as ServerMessage;
      switch (msg.t) {
        case 'welcome':
          return out({ t: 'queue', characterId });
        case 'matchFound':
          state = msg.state;
          seat = msg.you;
          return;
        case 'events':
          if (!state) return;
          state.time = msg.time;
          if (msg.players) state.players = msg.players;
          rejected += msg.events.filter((e) => e.type === 'invalidMove' && e.player === seat).length;
          return;
        case 'matchOver':
          clearInterval(timer);
          ws.close();
          return resolve({ won: msg.winner === seat, winner: msg.winner, reason: msg.reason, moves, rejected });
        case 'error':
          clearInterval(timer);
          ws.close();
          return reject(new Error(`${msg.code}: ${msg.message}`));
      }
    });
    ws.on('error', (e) => {
      clearInterval(timer);
      reject(e);
    });
  });
}

if (process.argv[1] && /botClient\.ts$/.test(process.argv[1])) {
  Promise.all([runBot('BotA', 'ember'), runBot('BotB', 'rime')]).then(([a, b]) => {
    console.log('A', a);
    console.log('B', b);
  });
}
