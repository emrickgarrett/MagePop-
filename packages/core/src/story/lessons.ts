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
      text: 'A Meteor is coming! Line up 4 sapphires to cast Heat Shield and block it.',
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
  'rime-cold-equation': [
    {
      text: "Line up 4 sapphires to cast Flash Freeze and ice 5 of your opponent's gems.",
      moves: 1,
      goal: { kind: 'cast', color: 'sapphire', tier: 'active' },
      layout: [
        'bbgygr', //
        'pbgrbb',
        'rrbpgp',
        'gbrygg',
        'bypbyr',
        'yggrbb',
      ],
    }, // winning first moves: 1/5
    {
      text: 'Ice is worth damage: 4 topaz casts Shatter, hitting every frozen gem. Cast it!',
      moves: 1,
      goal: { kind: 'cast', color: 'topaz', tier: 'active' },
      layout: [
        'ybyygg', //
        'gbrygb',
        'brgryg',
        'grbybb',
        'ypprby',
        'bbpgyp',
      ],
    }, // winning first moves: 1/9
    {
      text: 'Ice Shard (ruby) hits hard. Deal 20 damage in 2 moves.',
      moves: 2,
      goal: { kind: 'damage', amount: 20 },
      layout: [
        'gbgpyg', //
        'rbgppb',
        'rrprgb',
        'prrbgp',
        'yypgrr',
        'pbggry',
      ],
    }, // winning first moves: 2/9
  ],
  'briar-deep-roots': [
    {
      text: "You're hurt. 4 emeralds cast Mend: heal 8.",
      moves: 1,
      startHp: 200,
      goal: { kind: 'heal', amount: 8 },
      layout: [
        'yrgpgr', //
        'rbbpry',
        'gyrryb',
        'gbygpg',
        'bggrgg',
        'prpbbp',
      ],
    }, // winning first moves: 1/7
    {
      text: 'Bark up: 4 topaz cast Barkskin for 8 shield.',
      moves: 1,
      goal: { kind: 'shield', amount: 8 },
      layout: [
        'prbybg', //
        'bbppbr',
        'rbpgyy',
        'gpyypy',
        'yrpygr',
        'brrgrb',
      ],
    }, // winning first moves: 1/9
    {
      text: 'Thorns too: make an L of 5 rubies for Bramble Storm.',
      moves: 1,
      goal: { kind: 'cast', color: 'ruby', tier: 'ultimate' },
      layout: [
        'pprprr', //
        'rbggyy',
        'rypbbg',
        'yrrypr',
        'rybppg',
        'byrgry',
      ],
    }, // winning first moves: 1/5
  ],
  'nyx-venom-and-burst': [
    {
      text: 'First the poison: 4 amethysts cast Venom.',
      moves: 1,
      goal: { kind: 'cast', color: 'amethyst', tier: 'active' },
      layout: [
        'rbppgg', //
        'rppgrp',
        'gpgbyy',
        'yrpbgr',
        'pggprr',
        'yyrbgy',
      ],
    }, // winning first moves: 1/7
    {
      text: 'Then cash it in: 4 emeralds cast Toxic Burst, extra painful on a poisoned foe.',
      moves: 1,
      goal: { kind: 'cast', color: 'emerald', tier: 'active' },
      layout: [
        'yrbygg', //
        'rpypbg',
        'gpbrgr',
        'pbrygg',
        'pgprbg',
        'yrbpbr',
      ],
    }, // winning first moves: 1/9
    {
      text: 'Siphon (ruby) steals their life. Cast it twice in 3 moves.',
      moves: 3,
      goal: { kind: 'cast', color: 'ruby', count: 2 },
      layout: [
        'ggbpbp', //
        'pgbrgp',
        'bpygrr',
        'rpprgg',
        'ggbbrg',
        'ppygry',
      ],
    }, // winning first moves: 1/7
  ],
  'volt-overcharge': [
    {
      text: 'Overcharge (4 rubies) powers up your next damage spell. Cast it.',
      moves: 1,
      goal: { kind: 'cast', color: 'ruby', tier: 'active' },
      layout: [
        'ybpgrb', //
        'yrypgy',
        'pprrgp',
        'rrbypp',
        'brbrgg',
        'gbgrbr',
      ],
    }, // winning first moves: 1/9
    {
      text: 'Now the big one: an L of 5 topaz for Chain Lightning!',
      moves: 1,
      goal: { kind: 'cast', color: 'topaz', tier: 'ultimate' },
      layout: [
        'pyrpgb', //
        'pybppr',
        'bgyygg',
        'yypyrb',
        'ppggrp',
        'gyggyg',
      ],
    }, // winning first moves: 1/8
    {
      text: 'Storms chain. Set off a cascade in 2 moves.',
      moves: 2,
      goal: { kind: 'combo', depth: 1 },
      layout: [
        'gpbgyb', //
        'grybyy',
        'bpbpgr',
        'pryybp',
        'rbrggr',
        'pgybgg',
      ],
    }, // winning first moves: 5/5
  ],
};
