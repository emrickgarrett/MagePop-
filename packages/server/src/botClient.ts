/**
 * Headless bot clients for testing the server end to end:
 *   npm run server            (terminal 1)
 *   npm run bots -w @magepop/server   (terminal 2) — two bots queue and fight over the wire.
 *
 * Bots keep a mirror of the battle by replaying nothing: they ask the engine for moves on the
 * state snapshot they got at match start, kept in sync by applying the same moves locally.
 * (A real client will render from the event stream the same way the AI mode does.)
 */
import WebSocket from 'ws';
import { aiLevel, BattleState, chooseMove, ClientMessage, PROTOCOL_VERSION, ServerMessage, applyMove, tick } from '@magepop/core';

const URL = process.env.SERVER ?? 'ws://localhost:8787';

export function runBot(name: string, characterId: string, level = 3): Promise<{ won: boolean; reason: string; desyncs: number; moves: number }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const out = (m: ClientMessage) => ws.send(JSON.stringify(m));
    let state: BattleState | null = null;
    let seat: 0 | 1 = 0;
    let seq = 0;
    let lastServerTime = 0;
    let desyncs = 0;
    let moves = 0;
    const rng = { rng: Math.floor(Math.random() * 1e9) };
    let thinkTimer: NodeJS.Timeout | null = null;

    const think = () => {
      thinkTimer = setTimeout(() => {
        if (!state) return;
        const me = state.players[seat];
        if (!state.over && state.time >= me.busyUntil && state.time >= me.stunnedUntil) {
          const m = chooseMove(state, seat, aiLevel(level), rng);
          if (m) out({ t: 'move', a: m.a, b: m.b, seq: ++seq });
        }
        think();
      }, 700);
    };

    ws.on('open', () => out({ t: 'hello', version: PROTOCOL_VERSION, name }));
    ws.on('error', reject);
    ws.on('message', (data) => {
      const msg = JSON.parse(String(data)) as ServerMessage;
      switch (msg.t) {
        case 'welcome':
          out({ t: 'queue', characterId });
          break;
        case 'matchFound':
          state = msg.state;
          seat = msg.you;
          lastServerTime = msg.state.time;
          think();
          break;
        case 'events': {
          // Keep the local mirror in sync: advance time and re-apply moves reported via board events.
          if (!state) break;
          if (msg.time > lastServerTime) tick(state, msg.time - lastServerTime);
          lastServerTime = msg.time;
          for (const e of msg.events) {
            if (e.type === 'board' && !e.external && e.steps[0]?.kind === 'swap') {
              const s = e.steps[0];
              const moved = s.affected;
              const local = applyMove(state, e.player, moved[0], moved[1]);
              if (local[0]?.type === 'invalidMove') desyncs++;
              moves++;
            }
          }
          if (!state.over && (state.players[0].hp !== msg.hp[0] || state.players[1].hp !== msg.hp[1])) desyncs++;
          break;
        }
        case 'matchOver':
          if (thinkTimer) clearTimeout(thinkTimer);
          ws.close();
          resolve({ won: msg.winner === seat, reason: msg.reason, desyncs, moves });
          break;
        case 'pong':
        case 'queued':
          break;
        case 'error':
          console.error(`[${name}] server error: ${msg.message}`);
          break;
      }
    });
  });
}

if (process.argv[1] && /botClient\.ts$/.test(process.argv[1])) {
  Promise.all([runBot('BotA', 'ember'), runBot('BotB', 'nyx')]).then((r) => {
    console.log('results', r);
    process.exit(0);
  });
}
