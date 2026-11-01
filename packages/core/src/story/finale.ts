import { G } from './goals';
import { scene } from './script';
import { StoryChapter } from './types';

/**
 * Finale: the five mages go down into the Fracture together. The player picks any unlocked mage;
 * `hero` is only the default pick.
 */
export const FINALE_CHAPTER: StoryChapter = {
  id: 'finale',
  hero: 'ember',
  anyHero: true,
  requires: 'volt',
  cover: 'hollow',
  title: 'The Hollow',
  unlocks: 'hollow',
  nodes: [
    {
      kind: 'gauntlet',
      id: 'finale-fracture',
      ...scene('finale-fracture'),
      title: 'Into the Fracture',
      twist: 'Echoes of all five mages, one after another. Your HP carries over (half restored between).',
      healBetweenPct: 50,
      waves: [
        { opponent: 'ember', aiLevel: 1, echo: true },
        { opponent: 'rime', aiLevel: 1, echo: true },
        { opponent: 'briar', aiLevel: 1, echo: true },
        { opponent: 'nyx', aiLevel: 2, echo: true },
        { opponent: 'volt', aiLevel: 2, echo: true },
      ],
      goals: [G.neverBelow(20), G.under(420_000)],
    },
    {
      kind: 'fight',
      id: 'finale-gray-garden',
      ...scene('finale-gray-garden'),
      title: 'The Gray Garden',
      opponent: 'briar',
      aiLevel: 2,
      echo: true,
      twist: 'The Fracture drains everything: every 10s three gems go hollow on both boards. Match next to a hollow gem to break it.',
      rules: {
        pulses: [{ everyMs: 10_000, firstAtMs: 4000, target: 'both', label: 'The Fracture drains the color.', effects: [{ kind: 'hollow', count: 3 }] }],
      },
      goals: [G.spells(6), G.under(150_000)],
    },
    {
      kind: 'fight',
      id: 'finale-colorless',
      ...scene('finale-colorless'),
      title: 'Challenge: Colorless',
      optional: true,
      opponent: 'hollow',
      aiLevel: 4,
      twist: 'The Hollow at Master difficulty. Nobody can heal or shield.',
      rules: {
        sides: [
          { noHealing: true, noShields: true },
          { noHealing: true, noShields: true },
        ],
      },
      goals: [G.under(150_000), G.hpAbove(30)],
    },
    {
      kind: 'boss',
      id: 'finale-boss',
      ...scene('finale-boss'),
      title: 'Boss: The Hollow',
      opponent: 'hollow',
      aiLevel: 3,
      opponentHp: 225,
      twist:
        'Three phases. At 66% she starts draining your board (a gem goes hollow every 8s). At 33% the Fracture collapses: more hollow gems, and she regenerates.',
      rules: {
        phases: [
          { atHpPct: 66, onEnter: [{ kind: 'shield', amount: 10 }] },
          { atHpPct: 33, onEnter: [{ kind: 'shield', amount: 15 }, { kind: 'cleanse' }] },
        ],
        pulses: [
          {
            everyMs: 8000,
            firstAtMs: 2000,
            target: 'player',
            label: 'Drain: your gems go hollow!',
            effects: [{ kind: 'hollow', count: 1 }],
            fromPhase: 1,
          },
          {
            everyMs: 10_000,
            firstAtMs: 4000,
            target: 'opponent',
            label: 'The Hollow feeds on the Fracture.',
            effects: [{ kind: 'heal', amount: 5 }],
            fromPhase: 2,
          },
        ],
      },
      barks: {
        phase: {
          1: { speaker: 'hollow', text: "Your colors are so bright. Let's fix that." },
          2: { speaker: 'hollow', text: 'If I cannot have the Heartstone, nobody can!' },
        },
      },
      goals: [G.ultimate(2), G.hpAbove(30)],
    },
  ],
};
