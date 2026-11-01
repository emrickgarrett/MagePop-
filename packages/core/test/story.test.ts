import { describe, expect, it } from 'vitest';
import {
  chapterComplete,
  createBattle,
  findGroups,
  isCharacterId,
  LESSONS,
  nodeAvailable,
  solvePuzzle,
  startPuzzle,
  STORY,
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
        expect(isCharacterId(n.opponent), n.id).toBe(true);
        expect(n.goals).toHaveLength(2);
        expect(() =>
          createBattle({
            seed: 1,
            characters: [c.hero, n.opponent],
            maxHp: [n.playerHp ?? 250, n.opponentHp ?? 250],
            rules: n.rules,
          }),
        ).not.toThrow();
      }
  });

  it('every lesson stage starts with no matches and can be solved within its move limit', () => {
    for (const [id, stages] of Object.entries(LESSONS))
      stages.forEach((stage, i) => {
        const run = startPuzzle(stage, 'ember');
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
