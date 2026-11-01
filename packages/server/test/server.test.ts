/**
 * Server tests, written as a hostile client would behave. Each test runs a real server on a
 * random port with short timeouts.
 */
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { PROTOCOL_VERSION, ServerMessage } from '@magepop/core';
import { PvpServer, ServerOptions } from '../src/server';
import { runBot } from '../src/botClient';

let server: PvpServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

async function start(opts: Partial<ServerOptions> = {}) {
  server = new PvpServer({ port: 0, startDelayMs: 50, log: () => {}, ...opts });
  const port = await server.listen();
  return `ws://127.0.0.1:${port}`;
}

/** A raw client that records everything it receives. */
function raw(url: string) {
  const ws = new WebSocket(url);
  const got: ServerMessage[] = [];
  const rawText: string[] = [];
  let closed: { code: number } | null = null;
  ws.on('message', (d) => {
    rawText.push(String(d));
    got.push(JSON.parse(String(d)));
  });
  ws.on('close', (code) => (closed = { code }));
  const open = new Promise<void>((r) => ws.on('open', () => r()));
  const send = (m: unknown) => ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  const waitFor = async (pred: (m: ServerMessage) => boolean, ms = 3000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const m = got.find(pred);
      if (m) return m;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`timed out; got ${JSON.stringify(got.map((g) => g.t))}`);
  };
  const waitClosed = async (ms = 3000) => {
    const t0 = Date.now();
    while (!closed && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 10));
    return closed;
  };
  return { ws, got, rawText, open, send, waitFor, waitClosed };
}

const hello = { t: 'hello', version: PROTOCOL_VERSION, name: 'Tester' };

describe('PVP server', () => {
  it('runs a full match between two bots, server-authoritative', async () => {
    const url = await start();
    const [a, b] = await Promise.all([runBot('A', 'ember', { url, thinkMs: 60, level: 4 }), runBot('B', 'volt', { url, thinkMs: 60, level: 4 })]);
    expect(a.reason).toBe('ko');
    expect(a.winner).toBe(b.winner);
    expect(a.won).not.toBe(b.won);
    expect(a.moves + b.moves).toBeGreaterThan(10);
  }, 60_000);

  it('never sends board RNG state to clients', async () => {
    const url = await start();
    const spy = raw(url);
    await spy.open;
    spy.send(hello);
    await spy.waitFor((m) => m.t === 'welcome');
    spy.send({ t: 'queue', characterId: 'rime' });
    const botDone = runBot('B', 'nyx', { url, thinkMs: 60, level: 4 });
    await spy.waitFor((m) => m.t === 'matchFound');
    // Play a few moves from the spy too, so board snapshots inside events are covered.
    for (let i = 0; i < 40; i++) {
      spy.send({ t: 'move', a: { r: i % 8, c: 0 }, b: { r: i % 8, c: 1 }, seq: i });
      await new Promise((r) => setTimeout(r, 40));
    }
    await botDone;
    const all = spy.rawText.join('\n');
    expect(all).toContain('"rng":0');
    expect(all).not.toMatch(/"rng":[1-9]/);
  }, 60_000);

  it('rejects malformed, oversized and prototype-poking input without crashing', async () => {
    const url = await start();
    const c = raw(url);
    await c.open;
    c.send(hello);
    await c.waitFor((m) => m.t === 'welcome');
    for (const bad of [
      'not json',
      '[]',
      '{"t":"move","a":{"r":"1","c":0},"b":{"r":1,"c":1},"seq":1}',
      '{"t":"move","a":{"r":1e9,"c":0},"b":{"r":1,"c":1},"seq":1}',
      '{"t":"queue","characterId":"constructor"}',
      '{"t":"queue","characterId":"__proto__"}',
      '{"t":"resume","token":"../../etc"}',
      '{"t":"nope"}',
    ]) {
      c.send(bad);
    }
    await new Promise((r) => setTimeout(r, 200));
    const errors = c.got.filter((m) => m.t === 'error');
    expect(errors.length).toBe(8);
    expect(errors.every((e) => e.t === 'error' && e.code === 'badMessage' && !/at |\.ts|stack/i.test(e.message))).toBe(true);
    // Still usable afterwards.
    c.send({ t: 'ping', at: 1 });
    await c.waitFor((m) => m.t === 'pong');
    // Oversized payloads are cut off at the socket.
    c.send(JSON.stringify({ t: 'hello', version: PROTOCOL_VERSION, name: 'x'.repeat(5000) }));
    expect(await c.waitClosed()).not.toBeNull();
  });

  it('requires hello first and the right protocol version', async () => {
    const url = await start();
    const c = raw(url);
    await c.open;
    c.send({ t: 'queue', characterId: 'ember' });
    await c.waitFor((m) => m.t === 'error' && m.code === 'notReady');
    expect(await c.waitClosed()).not.toBeNull();

    const old = raw(url);
    await old.open;
    old.send({ t: 'hello', version: 1, name: 'Old' });
    await old.waitFor((m) => m.t === 'error' && m.code === 'version');
    expect(await old.waitClosed()).not.toBeNull();
  });

  it('sanitizes display names', async () => {
    const url = await start();
    const a = raw(url);
    const b = raw(url);
    await Promise.all([a.open, b.open]);
    a.send({ t: 'hello', version: PROTOCOL_VERSION, name: '  Evil\u202e\u0000Name\n\twith a very long tail indeed  ' });
    b.send(hello);
    await a.waitFor((m) => m.t === 'welcome');
    await b.waitFor((m) => m.t === 'welcome');
    a.send({ t: 'queue', characterId: 'ember' });
    b.send({ t: 'queue', characterId: 'rime' });
    const found = (await b.waitFor((m) => m.t === 'matchFound')) as Extract<ServerMessage, { t: 'matchFound' }>;
    expect(found.opponent.name).toBe('EvilName with a very');
    expect(found.opponent.name.length).toBeLessThanOrEqual(20);
    // Tokens only go to their owner and are different per seat.
    const fa = (await a.waitFor((m) => m.t === 'matchFound')) as Extract<ServerMessage, { t: 'matchFound' }>;
    expect(fa.resumeToken).not.toBe(found.resumeToken);
    expect(b.rawText.join('')).not.toContain(fa.resumeToken);
  });

  it('rate limits floods', async () => {
    const url = await start({ rate: { burst: 10, perSecond: 5 } });
    const c = raw(url);
    await c.open;
    c.send(hello);
    for (let i = 0; i < 50; i++) c.send({ t: 'ping', at: i });
    await c.waitFor((m) => m.t === 'error' && m.code === 'rateLimited');
    expect(await c.waitClosed()).not.toBeNull();
  });

  it('caps connections per IP', async () => {
    const url = await start({ maxConnectionsPerIp: 2 });
    const c1 = raw(url);
    const c2 = raw(url);
    await Promise.all([c1.open, c2.open]);
    const c3 = raw(url);
    await c3.waitFor((m) => m.t === 'error' && m.code === 'full');
    expect(await c3.waitClosed()).not.toBeNull();
  });

  it('lets a dropped player rejoin with their token, and only with it', async () => {
    const url = await start({ reconnectGraceMs: 2000 });
    const a = raw(url);
    const b = raw(url);
    await Promise.all([a.open, b.open]);
    a.send(hello);
    b.send(hello);
    await a.waitFor((m) => m.t === 'welcome');
    await b.waitFor((m) => m.t === 'welcome');
    a.send({ t: 'queue', characterId: 'briar' });
    b.send({ t: 'queue', characterId: 'nyx' });
    const fa = (await a.waitFor((m) => m.t === 'matchFound')) as Extract<ServerMessage, { t: 'matchFound' }>;
    a.ws.close();
    await b.waitFor((m) => m.t === 'opponentConnection' && !m.connected);

    const thief = raw(url);
    await thief.open;
    thief.send(hello);
    await thief.waitFor((m) => m.t === 'welcome');
    thief.send({ t: 'resume', token: 'A'.repeat(32) });
    await thief.waitFor((m) => m.t === 'error' && m.code === 'resumeFailed');

    const back = raw(url);
    await back.open;
    back.send(hello);
    await back.waitFor((m) => m.t === 'welcome');
    back.send({ t: 'resume', token: fa.resumeToken });
    const r = (await back.waitFor((m) => m.t === 'resumed')) as Extract<ServerMessage, { t: 'resumed' }>;
    expect(r.you).toBe(fa.you);
    await b.waitFor((m) => m.t === 'opponentConnection' && m.connected);
    back.send({ t: 'forfeit' });
    const over = (await b.waitFor((m) => m.t === 'matchOver')) as Extract<ServerMessage, { t: 'matchOver' }>;
    expect(over.reason).toBe('forfeit');
    // Tokens die with the match.
    expect(server!.resumeTokens.size).toBe(0);
  });

  it('a player who never comes back loses after the grace window', async () => {
    const url = await start({ reconnectGraceMs: 300 });
    const a = raw(url);
    const b = raw(url);
    await Promise.all([a.open, b.open]);
    a.send(hello);
    b.send(hello);
    await a.waitFor((m) => m.t === 'welcome');
    await b.waitFor((m) => m.t === 'welcome');
    a.send({ t: 'queue', characterId: 'ember' });
    b.send({ t: 'queue', characterId: 'ember' });
    const fb = (await b.waitFor((m) => m.t === 'matchFound')) as Extract<ServerMessage, { t: 'matchFound' }>;
    a.ws.close();
    const over = (await b.waitFor((m) => m.t === 'matchOver')) as Extract<ServerMessage, { t: 'matchOver' }>;
    expect(over).toMatchObject({ reason: 'disconnect', winner: fb.you });
  });

  it('ends matches that run past the time limit', async () => {
    const url = await start({ maxMatchMs: 300 });
    const a = raw(url);
    const b = raw(url);
    await Promise.all([a.open, b.open]);
    a.send(hello);
    b.send(hello);
    await a.waitFor((m) => m.t === 'welcome');
    await b.waitFor((m) => m.t === 'welcome');
    a.send({ t: 'queue', characterId: 'rime' });
    b.send({ t: 'queue', characterId: 'rime' });
    const over = (await a.waitFor((m) => m.t === 'matchOver')) as Extract<ServerMessage, { t: 'matchOver' }>;
    expect(over).toMatchObject({ reason: 'timeout', winner: null });
  });

  it('ignores moves before the countdown ends and moves out of turn', async () => {
    const url = await start({ startDelayMs: 1000 });
    const a = raw(url);
    const b = raw(url);
    await Promise.all([a.open, b.open]);
    a.send(hello);
    b.send(hello);
    await a.waitFor((m) => m.t === 'welcome');
    await b.waitFor((m) => m.t === 'welcome');
    a.send({ t: 'queue', characterId: 'ember' });
    b.send({ t: 'queue', characterId: 'volt' });
    await a.waitFor((m) => m.t === 'matchFound');
    for (let i = 0; i < 8; i++) a.send({ t: 'move', a: { r: i, c: 0 }, b: { r: i, c: 1 }, seq: i });
    await new Promise((r) => setTimeout(r, 300));
    expect(a.got.filter((m) => m.t === 'events')).toHaveLength(0);
  });
});

// ---- friend rooms --------------------------------------------------------------------------

async function ready(url: string, name = 'Tester') {
  const c = raw(url);
  await c.open;
  c.send({ t: 'hello', version: PROTOCOL_VERSION, name });
  await c.waitFor((m) => m.t === 'welcome');
  return c;
}

describe('friend rooms', () => {
  it('pairs a host and a friend by code, once', async () => {
    const url = await start();
    const host = await ready(url, 'Host');
    const friend = await ready(url, 'Friend');
    host.send({ t: 'createRoom', characterId: 'rime' });
    const room = (await host.waitFor((m) => m.t === 'roomCreated')) as Extract<ServerMessage, { t: 'roomCreated' }>;
    expect(room.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    // Typed loosely (lowercase, a dash) still works.
    friend.send({ t: 'joinRoom', code: `${room.code.slice(0, 3).toLowerCase()}-${room.code.slice(3)}`, characterId: 'volt' });
    const fh = (await host.waitFor((m) => m.t === 'matchFound')) as Extract<ServerMessage, { t: 'matchFound' }>;
    const ff = (await friend.waitFor((m) => m.t === 'matchFound')) as Extract<ServerMessage, { t: 'matchFound' }>;
    expect(fh.friendly && ff.friendly).toBe(true);
    expect(fh.opponent).toEqual({ name: 'Friend', characterId: 'volt' });
    expect(ff.opponent).toEqual({ name: 'Host', characterId: 'rime' });
    // Codes are single-use.
    const late = await ready(url, 'Late');
    late.send({ t: 'joinRoom', code: room.code, characterId: 'ember' });
    await late.waitFor((m) => m.t === 'error' && m.code === 'roomNotFound');
  });

  it("gives the same answer for unknown codes and your own room, and rejects junk", async () => {
    const url = await start();
    const host = await ready(url);
    host.send({ t: 'createRoom', characterId: 'ember' });
    const room = (await host.waitFor((m) => m.t === 'roomCreated')) as Extract<ServerMessage, { t: 'roomCreated' }>;
    host.send({ t: 'joinRoom', code: room.code, characterId: 'ember' });
    const own = await host.waitFor((m) => m.t === 'error');
    const other = await ready(url);
    other.send({ t: 'joinRoom', code: 'ZZZZZZ', characterId: 'ember' });
    const unknown = await other.waitFor((m) => m.t === 'error');
    expect(own).toEqual(unknown);
    other.send({ t: 'joinRoom', code: 'O0O0O0', characterId: 'ember' }); // not in the alphabet
    other.send({ t: 'joinRoom', code: room.code, characterId: 'constructor' });
    await new Promise((r) => setTimeout(r, 150));
    expect(other.got.filter((m) => m.t === 'error' && m.code === 'badMessage')).toHaveLength(2);
  });

  it('stops code guessing', async () => {
    const url = await start({ joinAttemptsPerMinute: 3 });
    const guesser = await ready(url);
    for (const code of ['AAAAAA', 'BBBBBB', 'CCCCCC', 'DDDDDD']) guesser.send({ t: 'joinRoom', code, characterId: 'ember' });
    await guesser.waitFor((m) => m.t === 'error' && m.code === 'tooManyAttempts');
    // A fresh connection from the same IP doesn't reset the budget.
    const again = await ready(url);
    again.send({ t: 'joinRoom', code: 'EEEEEE', characterId: 'ember' });
    await again.waitFor((m) => m.t === 'error' && m.code === 'tooManyAttempts');
  });

  it('expires rooms and closes them when the host leaves', async () => {
    const url = await start({ roomTtlMs: 150 });
    const host = await ready(url);
    host.send({ t: 'createRoom', characterId: 'nyx' });
    const room = (await host.waitFor((m) => m.t === 'roomCreated')) as Extract<ServerMessage, { t: 'roomCreated' }>;
    await host.waitFor((m) => m.t === 'roomClosed' && m.reason === 'expired');
    const friend = await ready(url);
    friend.send({ t: 'joinRoom', code: room.code, characterId: 'ember' });
    await friend.waitFor((m) => m.t === 'error' && m.code === 'roomNotFound');

    const host2 = await ready(url);
    host2.send({ t: 'createRoom', characterId: 'nyx' });
    const room2 = (await host2.waitFor((m) => m.t === 'roomCreated')) as Extract<ServerMessage, { t: 'roomCreated' }>;
    host2.ws.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(server!.stats.rooms).toBe(0);
    friend.send({ t: 'joinRoom', code: room2.code, characterId: 'ember' });
    await friend.waitFor((m) => m.t === 'error' && m.code === 'roomNotFound' && friend.got.filter((x) => x.t === 'error').length === 2);
  });

  it('offers a rematch after a friend battle, and starts it when both agree', async () => {
    const url = await start();
    const a = await ready(url, 'A');
    const b = await ready(url, 'B');
    a.send({ t: 'createRoom', characterId: 'briar' });
    const room = (await a.waitFor((m) => m.t === 'roomCreated')) as Extract<ServerMessage, { t: 'roomCreated' }>;
    b.send({ t: 'joinRoom', code: room.code, characterId: 'ember' });
    await a.waitFor((m) => m.t === 'matchFound');
    a.send({ t: 'forfeit' });
    await a.waitFor((m) => m.t === 'rematch' && m.status === 'available');
    await b.waitFor((m) => m.t === 'rematch' && m.status === 'available');
    a.send({ t: 'rematch' });
    await a.waitFor((m) => m.t === 'rematch' && m.status === 'waiting');
    await b.waitFor((m) => m.t === 'rematch' && m.status === 'opponentWants');
    b.send({ t: 'rematch' });
    await new Promise((r) => setTimeout(r, 150));
    const founds = a.got.filter((m) => m.t === 'matchFound') as Extract<ServerMessage, { t: 'matchFound' }>[];
    expect(founds).toHaveLength(2);
    expect(founds[1]).toMatchObject({ friendly: true, opponent: { name: 'B', characterId: 'ember' } });
  });

  it('cancels the rematch offer when one player declines or leaves', async () => {
    const url = await start();
    const a = await ready(url, 'A');
    const b = await ready(url, 'B');
    a.send({ t: 'createRoom', characterId: 'briar' });
    const room = (await a.waitFor((m) => m.t === 'roomCreated')) as Extract<ServerMessage, { t: 'roomCreated' }>;
    b.send({ t: 'joinRoom', code: room.code, characterId: 'ember' });
    await a.waitFor((m) => m.t === 'matchFound');
    b.send({ t: 'forfeit' });
    await a.waitFor((m) => m.t === 'rematch' && m.status === 'available');
    a.send({ t: 'rematch' });
    b.send({ t: 'declineRematch' });
    await a.waitFor((m) => m.t === 'rematch' && m.status === 'cancelled');
    // Too late to accept now.
    b.send({ t: 'rematch' });
    await b.waitFor((m) => m.t === 'rematch' && m.status === 'cancelled');
    // Quick Match players never get rematch offers.
    const q1 = await ready(url, 'Q1');
    const q2 = await ready(url, 'Q2');
    q1.send({ t: 'queue', characterId: 'ember' });
    q2.send({ t: 'queue', characterId: 'ember' });
    await q1.waitFor((m) => m.t === 'matchFound');
    q1.send({ t: 'forfeit' });
    await q2.waitFor((m) => m.t === 'matchOver');
    await new Promise((r) => setTimeout(r, 100));
    expect(q2.got.some((m) => m.t === 'rematch')).toBe(false);
  });
});
