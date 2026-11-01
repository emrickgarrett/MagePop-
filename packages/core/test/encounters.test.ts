import { describe, expect, it } from 'vitest';
import { applyMove, BattleRules, createBattle, findValidMoves, getCell, PlayerIndex, tick } from '../src';

const battle = (rules: BattleRules, seed = 42) => createBattle({ seed, characters: ['ember', 'rime'], rules });
const run = (s: ReturnType<typeof battle>, ms: number) => {
  const events = [];
  for (let t = 0; t < ms; t += 50) events.push(...tick(s, 50));
  return events;
};
const frozenCount = (s: ReturnType<typeof battle>, p: PlayerIndex) => s.players[p].board.cells.filter((g) => g && g.frozenUntil > s.time).length;
const stoneCount = (s: ReturnType<typeof battle>, p: PlayerIndex) => s.players[p].board.cells.filter((g) => g?.kind === 'stone').length;

describe('encounter rules', () => {
  it('fires timed pulses on the right boards', () => {
    const s = battle({ pulses: [{ everyMs: 1000, target: 'both', label: 'The Heartstone pulses!', effects: [{ kind: 'freeze', count: 3, durationMs: 5000 }] }] });
    const ev = run(s, 1050);
    expect(ev.filter((e) => e.type === 'pulse')).toHaveLength(1);
    expect(frozenCount(s, 0)).toBe(3);
    expect(frozenCount(s, 1)).toBe(3);
    run(s, 1000);
    expect(ev.length).toBeGreaterThan(0);
  });

  it('pulses can target one side only, and hurt the target', () => {
    const s = battle({ pulses: [{ everyMs: 500, target: 'player', label: 'Blight', effects: [{ kind: 'damage', amount: 10 }] }] });
    run(s, 2050);
    expect(s.players[0].hp).toBe(250 - 40);
    expect(s.players[1].hp).toBe(250);
  });

  it('places starting hazards and keeps the board playable', () => {
    const s = battle({ start: [{ target: 'both', stones: 6 }, { target: 'player', frozen: 4 }] });
    expect(stoneCount(s, 0)).toBe(6);
    expect(stoneCount(s, 1)).toBe(6);
    expect(frozenCount(s, 0)).toBe(4);
    expect(findValidMoves(s.players[0].board, s.time).length).toBeGreaterThan(0);
  });

  it('survival: the player wins by lasting until the timer', () => {
    const s = battle({ surviveMs: 3000 });
    const ev = run(s, 3100);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(ev.some((e) => e.type === 'survived')).toBe(true);
  });

  it('no healing and no shields', () => {
    const s = battle({
      sides: [{ noHealing: true, noShields: true }, undefined],
      pulses: [{ everyMs: 500, target: 'both', label: 'Bloom', effects: [{ kind: 'shield', amount: 20 }] }],
    });
    run(s, 600);
    expect(s.players[0].shield).toBe(0);
    expect(s.players[1].shield).toBe(20);
  });

  it('silenced colors do nothing', () => {
    // Row 0 is r r b r: swapping (0,2)<->(0,3) makes a ruby line, but ruby is silenced for the player.
    const s = battle({ sides: [{ silenced: ['ruby'] }, undefined], layout: ['rrbrgy', 'gbypgb', 'ypgbyp', 'bgypgb', 'pygbyp', 'gbpygb'] });
    const ev = applyMove(s, 0, { r: 0, c: 2 }, { r: 0, c: 3 });
    expect(ev.some((e) => e.type === 'silenced')).toBe(true);
    expect(ev.some((e) => e.type === 'damage')).toBe(false);
    expect(s.players[1].hp).toBe(250);
  });

  it('builds puzzle boards from a layout, with frozen and stone cells', () => {
    const s = battle({ layout: ['rgbS', 'Ypgs', 'bgpr'] });
    const b = s.players[0].board;
    expect([b.rows, b.cols]).toEqual([3, 4]);
    expect(getCell(b, 0, 0)?.kind).toBe('ruby');
    expect(getCell(b, 0, 3)?.kind).toBe('stone');
    expect(getCell(b, 1, 0)?.kind).toBe('topaz');
    expect(getCell(b, 1, 0)!.frozenUntil).toBeGreaterThan(0);
    expect(() => battle({ layout: ['rgb', 'rg'] })).toThrow();
    expect(() => battle({ layout: ['rgx'] })).toThrow();
  });

  it('boss phases trigger at HP thresholds, apply on-enter effects and start phase pulses', () => {
    const s = battle({
      phases: [{ atHpPct: 50, onEnter: [{ kind: 'shield', amount: 30 }] }],
      pulses: [{ everyMs: 1000, target: 'player', label: 'Enough games.', effects: [{ kind: 'freeze', count: 2, durationMs: 4000 }], fromPhase: 1 }],
    });
    run(s, 3000);
    expect(frozenCount(s, 0)).toBe(0); // phase-1 pulse not active yet
    // Knock the boss below half with a damage pulse from the player's side.
    s.rules!.pulses!.push({ everyMs: 100000, firstAtMs: s.time + 50, target: 'opponent', label: 'test', effects: [{ kind: 'damage', amount: 130 }] });
    s.pulseNext!.push(s.time + 50);
    const ev = run(s, 100);
    expect(ev.some((e) => e.type === 'phase' && e.phase === 1)).toBe(true);
    expect(s.phase).toBe(1);
    expect(s.players[1].shield).toBe(30);
    run(s, 1100);
    expect(frozenCount(s, 0)).toBe(2);
  });

  it('slowed sides stay busy longer after a move', () => {
    const fast = battle({ layout: ['rrbrgy', 'gbypgb', 'ypgbyp', 'bgypgb', 'pygbyp', 'gbpygb'] });
    const slow = battle({ sides: [{ slowMult: 2 }, undefined], layout: ['rrbrgy', 'gbypgb', 'ypgbyp', 'bgypgb', 'pygbyp', 'gbpygb'] });
    applyMove(fast, 0, { r: 0, c: 2 }, { r: 0, c: 3 });
    applyMove(slow, 0, { r: 0, c: 2 }, { r: 0, c: 3 });
    expect(slow.players[0].busyUntil).toBeGreaterThan(fast.players[0].busyUntil * 1.5);
  });

  it('normal battles are untouched (no rules fields)', () => {
    const s = createBattle({ seed: 1, characters: ['ember', 'rime'] });
    expect(s.rules).toBeUndefined();
    expect(run(s, 5000).filter((e) => e.type === 'pulse')).toHaveLength(0);
  });
});

describe('protect and ice rules', () => {
  it('protect: the ally drains, takes your healing, and losing them loses the fight', () => {
    const s = battle({
      protect: { name: 'Sapling', hp: 100, drainPerSec: 10 },
      pulses: [{ everyMs: 2000, target: 'player', label: 'Bloom', effects: [{ kind: 'heal', amount: 15 }] }],
    });
    s.players[0].hp = 200;
    run(s, 2000);
    expect(s.ally!.hp).toBe(100 - 20 + 15); // drained 20, healed 15 by the pulse
    expect(s.players[0].hp).toBe(200); // your own HP isn't healed
    // Net drain is 10/s minus 7.5/s of healing: the ally falls within about 40s more.
    run(s, 45_000);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(1);
  });

  it('ice multiplier changes how long freezes last on that side', () => {
    const s = battle({
      sides: [{ iceMult: 0.5 }, { iceMult: 2 }],
      pulses: [{ everyMs: 1000, target: 'both', label: 'Frost', effects: [{ kind: 'freeze', count: 2, durationMs: 4000 }] }],
    });
    run(s, 1000);
    const until = (p: 0 | 1) => Math.max(...s.players[p].board.cells.map((g) => g?.frozenUntil ?? 0));
    expect(until(0)).toBe(1000 + 2000);
    expect(until(1)).toBe(1000 + 8000);
  });
});
