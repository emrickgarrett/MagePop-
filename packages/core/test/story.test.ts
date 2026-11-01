import { describe, expect, it } from 'vitest';
import {
  applyMove,
  CHARACTER_BY_ID,
  chapterComplete,
  chapterOpen,
  findValidMoves,
  createBattle,
  findGroups,
  isCharacterId,
  parseClientMessage,
  LESSONS,
  nodeAvailable,
  solvePuzzle,
  startPuzzle,
  STORY,
  tick,
} from '../src';

describe('story data', () => {
  it('node ids are unique and every chapter ends with a boss', () => {
    const ids = STORY.flatMap((c) => c.nodes.map((n) => n.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of STORY) expect(c.nodes.filter((n) => !n.optional).at(-1)?.kind).toBe('boss');
  });

  it('every fight node is buildable (real mages, valid rules)', () => {
    for (const c of STORY)
      for (const n of c.nodes) {
        if (n.kind === 'lesson') {
          expect(LESSONS[n.lesson], n.id).toBeDefined();
          continue;
        }
        expect(n.goals).toHaveLength(2);
        const fights = n.kind === 'gauntlet' ? n.waves.map((w) => ({ ...w, playerHp: undefined })) : [n];
        if (n.kind === 'gauntlet') expect(n.waves.length).toBeGreaterThanOrEqual(2);
        for (const f of fights) {
          expect(CHARACTER_BY_ID[f.opponent], n.id).toBeDefined();
          expect(() =>
            createBattle({ seed: 1, characters: [c.hero, f.opponent], maxHp: [f.playerHp ?? 250, f.opponentHp ?? 250], rules: f.rules }),
          ).not.toThrow();
        }
      }
  });

  it('every lesson stage starts with no matches and can be solved within its move limit', () => {
    for (const [id, stages] of Object.entries(LESSONS))
      stages.forEach((stage, i) => {
        // Lessons are named after their mage (e.g. 'rime-cold-equation'), whose spells they use.
        const run = startPuzzle(stage, id.split('-')[0]);
        expect(findGroups(run.state.players[0].board), `${id}[${i}] starts with a match`).toHaveLength(0);
        expect(solvePuzzle(stage, run), `${id}[${i}] has no solution`).not.toBeNull();
      });
  });

  it('nodes open in order; optional challenges never block the chapter', () => {
    const ember = STORY[0];
    const req = ember.nodes.filter((n) => !n.optional).map((n) => n.id);
    const opt = ember.nodes.findIndex((n) => n.optional);
    expect(nodeAvailable(ember, 0, [], ['ember'])).toBe(true);
    expect(nodeAvailable(ember, 1, [], ['ember'])).toBe(false);
    expect(nodeAvailable(ember, 0, [], [])).toBe(false); // hero locked
    // Clear everything required: chapter complete without touching the challenge.
    expect(chapterComplete(ember, req)).toBe(true);
    expect(chapterComplete(ember, req.slice(0, -1))).toBe(false);
    // The boss is playable right after the node before the challenge.
    const boss = ember.nodes.length - 1;
    expect(nodeAvailable(ember, boss, req.slice(0, -1), ['ember'])).toBe(true);
    expect(nodeAvailable(ember, opt, req.slice(0, opt), ['ember'])).toBe(true);
  });
});

describe('finale and the Hollow', () => {
  const finale = STORY.find((c) => c.anyHero)!;
  const volt = STORY.find((c) => c.hero === 'volt' && !c.anyHero)!;
  const voltDone = volt.nodes.filter((n) => !n.optional).map((n) => n.id);

  it('opens only after Volt\'s chapter, for any mage', () => {
    expect(finale.id).toBe('finale');
    expect(chapterOpen(finale, [], ['ember'])).toBe(false);
    expect(chapterOpen(finale, voltDone, ['ember'])).toBe(true);
    expect(nodeAvailable(finale, 0, voltDone, ['rime'])).toBe(true);
    expect(nodeAvailable(finale, 1, voltDone, ['rime'])).toBe(false);
  });

  it('beating the finale recruits the Hollow, who is then a normal playable mage', () => {
    expect(finale.unlocks).toBe('hollow');
    expect(CHARACTER_BY_ID.hollow).toBeDefined();
    expect(isCharacterId('hollow')).toBe(true);
    expect(parseClientMessage(JSON.stringify({ t: 'queue', characterId: 'hollow' }))).toEqual({ t: 'queue', characterId: 'hollow' });
  });

  it('hollow gems keep their color, can\'t be matched, and break when matched next to', () => {
    // The Hollow's Unmake on the player's board, via a pulse.
    const s = createBattle({
      seed: 3,
      characters: ['ember', 'hollow'],
      rules: { pulses: [{ everyMs: 1000, target: 'player', label: 'drain', effects: [{ kind: 'hollow', count: 6 }] }] },
    });
    tick(s, 1000);
    const b = s.players[0].board;
    const hollow = b.cells.filter((g) => g?.hollowOf);
    expect(hollow.length).toBe(6);
    for (const g of hollow) expect(g!.kind).toBe('stone');
    // Play moves until one breaks a hollow gem.
    let broke = false;
    for (let i = 0; i < 40 && !broke; i++) {
      s.players[0].busyUntil = 0;
      const before = b.cells.filter((g) => g?.hollowOf).length;
      const mv = findValidMoves(b, s.time)[0];
      if (!mv) break;
      applyMove(s, 0, mv.a, mv.b);
      broke = b.cells.filter((g) => g?.hollowOf).length < before;
    }
    expect(broke).toBe(true);
  });
});
