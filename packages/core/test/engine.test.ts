import { describe, expect, it } from 'vitest';
import {
  AI_LEVELS,
  applyMove,
  Board,
  CHARACTERS,
  chooseMove,
  createBattle,
  createBoard,
  findGroups,
  findValidMoves,
  GemColor,
  getCell,
  STORY,
  tick,
  TIMING,
  describeSpell,
  LESSONS,
} from '../src';

function boardFrom(rows: string[]): Board {
  const map: Record<string, GemColor | 'stone'> = { R: 'ruby', B: 'sapphire', G: 'emerald', Y: 'topaz', P: 'amethyst', S: 'stone' };
  let id = 1;
  return {
    rows: rows.length,
    cols: rows[0].length,
    nextId: 1000,
    rng: 42,
    cells: rows.flatMap((row) => [...row].map((ch) => ({ id: id++, kind: map[ch], frozenUntil: 0 }))),
  };
}

describe('board', () => {
  it('generates boards with no initial matches and at least one move', () => {
    for (let seed = 1; seed < 200; seed++) {
      const b = createBoard(seed);
      expect(findGroups(b)).toHaveLength(0);
      expect(findValidMoves(b, 0).length).toBeGreaterThan(0);
    }
  });

  it('is deterministic per seed', () => {
    expect(createBoard(7)).toEqual(createBoard(7));
    expect(createBoard(7)).not.toEqual(createBoard(8));
  });

  it('merges an L shape into one group of 5', () => {
    const b = boardFrom(['RBGYP', 'RGYPB', 'RRRBG', 'GYPBY', 'YPBGY']);
    const groups = findGroups(b);
    expect(groups).toHaveLength(1);
    expect(groups[0].color).toBe('ruby');
    expect(groups[0].cells).toHaveLength(5);
  });

  it('stones never match', () => {
    const b = boardFrom(['SSSG', 'GBYP', 'BYPG', 'YPGB']);
    expect(findGroups(b)).toHaveLength(0);
  });
});

describe('battle', () => {
  it('rejects non-matching swaps and paces moves', () => {
    const s = createBattle({ seed: 1, characters: ['ember', 'rime'] });
    const ev = applyMove(s, 0, { r: 0, c: 0 }, { r: 2, c: 2 });
    expect(ev[0]).toMatchObject({ type: 'invalidMove', reason: 'notAdjacent' });

    const [m] = findValidMoves(s.players[0].board, 0);
    const ok = applyMove(s, 0, m.a, m.b);
    expect(ok[0].type).toBe('board');
    expect(s.players[0].busyUntil).toBeGreaterThanOrEqual(TIMING.swapMs + TIMING.clearMs + TIMING.fallMs);
    const busy = applyMove(s, 0, m.a, m.b);
    expect(busy[0]).toMatchObject({ type: 'invalidMove', reason: 'busy' });
  });

  it('a 4-match casts the active spell, a 5-match the ultimate', () => {
    const s = createBattle({ seed: 3, characters: ['ember', 'rime'] });
    // Row 0: R R B R R  -> swap (1,2) 'R' up into (0,2) makes 5 rubies.
    s.players[0].board = boardFrom([
      'RRBRRGYP',
      'GYRPBGYB',
      'BGYPGYPG',
      'YPGBYPGY',
      'PBYGPBYP',
      'GYPBGYPB',
      'BPGYBPGY',
      'YGBPYGBP',
    ]);
    const ev = applyMove(s, 0, { r: 0, c: 2 }, { r: 1, c: 2 });
    const spell = ev.find((e) => e.type === 'spell');
    expect(spell).toMatchObject({ type: 'spell', tier: 'ultimate', name: 'Meteor', size: 5 });
    expect(s.players[1].hp).toBeLessThanOrEqual(250 - 24);
  });

  it('poison ticks over time and wears off with matches', () => {
    const s = createBattle({ seed: 5, characters: ['nyx', 'ember'] });
    s.players[1].statuses.push({ kind: 'poison', label: 'Poison', perTick: 2, carry: 0, nextTickAt: 1000, matchesLeft: 1, expiresAt: 10000 });
    tick(s, 3000);
    expect(s.players[1].hp).toBe(244);
    const [m] = findValidMoves(s.players[1].board, s.time);
    applyMove(s, 1, m.a, m.b);
    expect(s.players[1].statuses).toHaveLength(0);
  });

  it('frozen gems cannot be swapped', () => {
    const s = createBattle({ seed: 9, characters: ['rime', 'ember'] });
    const [m] = findValidMoves(s.players[0].board, 0);
    getCell(s.players[0].board, m.a.r, m.a.c)!.frozenUntil = 5000;
    expect(applyMove(s, 0, m.a, m.b)[0]).toMatchObject({ type: 'invalidMove', reason: 'locked' });
  });

  it('stun blocks moves until it expires', () => {
    const s = createBattle({ seed: 11, characters: ['volt', 'ember'] });
    s.players[1].stunnedUntil = 1500;
    const [m] = findValidMoves(s.players[1].board, 0);
    expect(applyMove(s, 1, m.a, m.b)[0]).toMatchObject({ reason: 'stunned' });
    tick(s, 1600);
    expect(applyMove(s, 1, m.a, m.b)[0].type).toBe('board');
  });
});

describe('content', () => {
  it('every character has 5 colors with active + ultimate and readable text', () => {
    for (const c of CHARACTERS) {
      expect(Object.keys(c.spells).sort()).toEqual(['amethyst', 'emerald', 'ruby', 'sapphire', 'topaz']);
      for (const s of Object.values(c.spells)) {
        expect(describeSpell(s.active).length).toBeGreaterThan(5);
        expect(describeSpell(s.ultimate).length).toBeGreaterThan(5);
      }
    }
  });

  it('story chapters unlock every character in order', () => {
    const mageChapters = STORY.filter((c) => !c.anyHero);
    expect(mageChapters.map((c) => c.hero)).toEqual(CHARACTERS.map((c) => c.id));
    expect(STORY.map((c) => c.unlocks)).toEqual(['rime', 'briar', 'nyx', 'volt', null, null]);
    // Every mage chapter teaches all five of its mage's spells, through lessons or fight highlights.
    for (const ch of mageChapters) {
      const taught = ch.nodes.flatMap((n) =>
        n.kind === 'lesson' ? LESSONS[n.lesson].flatMap((st) => ('color' in st.goal && st.goal.color ? [st.goal.color] : [])) : (n.spotlight ?? []),
      );
      expect(new Set(taught).size, ch.hero).toBe(5);
    }
  });
});

describe('full games', () => {
  it('bot vs bot games finish and are deterministic', () => {
    const play = (seed: number) => {
      const s = createBattle({ seed, characters: ['ember', 'nyx'] });
      const rng = [{ rng: seed }, { rng: seed + 1 }];
      const next = [0, 0];
      for (let t = 0; t < 600_000 && !s.over; t += 50) {
        tick(s, 50);
        for (const p of [0, 1] as const) {
          if (s.time >= next[p] && s.time >= s.players[p].busyUntil && s.time >= s.players[p].stunnedUntil) {
            const m = chooseMove(s, p, AI_LEVELS[p === 0 ? 4 : 1], rng[p]);
            if (m) applyMove(s, p, m.a, m.b);
            next[p] = s.time + 900;
          }
        }
      }
      return s;
    };
    const a = play(123);
    expect(a.over).toBe(true);
    expect(play(123)).toEqual(a);
  });
});
