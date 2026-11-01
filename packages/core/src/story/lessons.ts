import { PuzzleStage } from '../puzzle';

/**
 * Lesson puzzles, by id. Layout letters: r ruby, b sapphire, g emerald, y topaz, p amethyst,
 * s stone; uppercase = frozen. Every stage is checked by the tests: no match on the starting board,
 * and solvable within its move limit (core/test/story.test.ts).
 */
export const LESSONS: Record<string, PuzzleStage[]> = {
  'ember-first-spark': [
    {
      text: 'Swap two gems to line up 4 rubies and cast Fireball.',
      moves: 1,
      goal: { kind: 'cast', color: 'ruby', tier: 'active' },
      layout: [
        'rrgryb', //
        'bgrpgy',
        'gybgpb',
        'ypgbyg',
        'bgpygp',
        'pbygbr',
      ],
    },
    {
      text: 'Five or more in a line, an L or a T casts the ultimate. Make an L of rubies for Meteor!',
      moves: 1,
      goal: { kind: 'cast', color: 'ruby', tier: 'ultimate' },
      layout: [
        'rgybpg', //
        'rbpgyb',
        'grrypg',
        'rbgpby',
        'ypbgyp',
        'gbyppb',
      ],
    },
    {
      text: 'Gems fall into the gaps you clear. Make a match that makes another one as they fall: a cascade!',
      moves: 1,
      goal: { kind: 'combo', depth: 1 },
      layout: [
        'gpyrgp', //
        'ypgygb',
        'gbbpyg',
        'rrgbpy',
        'pyrgyp',
        'ygpyrg',
      ],
    },
  ],
  'ember-hold-the-line': [
    {
      text: "A Meteor is coming! Line up 4 sapphires to cast Heat Shield and block it.",
      moves: 1,
      goal: { kind: 'shield', amount: 7 },
      layout: [
        'gbbybr', //
        'ryybpg',
        'pgrbyp',
        'yrpgrg',
        'gpyrpy',
        'rygpgr',
      ],
    },
    {
      text: "You're hurt. Line up 4 emeralds to cast Warmth and heal.",
      moves: 2,
      startHp: 200,
      goal: { kind: 'heal', amount: 6 },
      layout: [
        'ggrgyb', //
        'ybgbrp',
        'rpgyby',
        'byprpr',
        'prbypb',
        'ybrpry',
      ],
    },
    {
      text: "Frozen gems can't be moved, but a match through them breaks the ice. Break all of it!",
      moves: 2,
      goal: { kind: 'clearIce' },
      layout: [
        'rbYypg', //
        'gybgrp',
        'bryPpy',
        'ygbrgr',
        'pbgybp',
        'gyrbpg',
      ],
    },
  ],
};
