import { G } from './goals';
import { scene } from './script';
import { StoryChapter } from './types';

/** Chapter 4: Nyx hunts whoever framed her, tracking the void magic with curse-craft. */
export const NYX_CHAPTER: StoryChapter = {
  hero: 'nyx',
  title: 'Sweet Venom',
  unlocks: 'volt',
  nodes: [
    {
      kind: 'lesson',
      id: 'nyx-venom-and-burst',
      ...scene('nyx-venom-and-burst'),
      title: 'Lesson: Venom and Burst',
      lesson: 'nyx-venom-and-burst',
    },
    {
      kind: 'gauntlet',
      id: 'nyx-the-hunt',
      ...scene('nyx-the-hunt'),
      title: 'The Hunt',
      twist: 'Three Echoes in a row. HP carries over (30% restored between).',
      healBetweenPct: 30,
      waves: [
        { opponent: 'briar', aiLevel: 1, echo: true },
        { opponent: 'ember', aiLevel: 2, echo: true },
        { opponent: 'rime', aiLevel: 2, echo: true },
      ],
      spotlight: ['amethyst', 'emerald'],
      goals: [G.neverBelow(25), G.under(270_000)],
    },
    {
      kind: 'fight',
      id: 'nyx-hex-trial',
      ...scene('nyx-hex-trial'),
      title: 'Hex Trial',
      opponent: 'briar',
      aiLevel: 3,
      spotlight: ['topaz'],
      twist: 'The catacomb floor is cursed: both boards start with 6 stones.',
      rules: { start: [{ target: 'both', stones: 6 }] },
      goals: [G.spells(5), G.under(120_000)],
    },
    {
      kind: 'fight',
      id: 'nyx-turned-curse',
      ...scene('nyx-turned-curse'),
      title: 'Turned Curse',
      opponent: 'nyx',
      aiLevel: 2,
      echo: true,
      twist: 'An Echo of Nyx using your own curse on you: you are poisoned every 15s.',
      rules: {
        pulses: [
          {
            everyMs: 15_000,
            firstAtMs: 5000,
            target: 'player',
            label: 'Your own curse!',
            effects: [{ kind: 'poison', perSecond: 1.5, matches: 3, maxMs: 8000, label: 'Curse' }],
          },
        ],
      },
      spotlight: ['sapphire'],
      goals: [G.hpAbove(40), G.under(120_000)],
    },
    {
      kind: 'fight',
      id: 'nyx-quick-venom',
      ...scene('nyx-quick-venom'),
      title: 'Challenge: Quick Venom',
      optional: true,
      opponent: 'volt',
      aiLevel: 3,
      twist: 'Volt at full speed. Can you poison lightning?',
      goals: [G.under(45_000), G.ultimate()],
    },
    {
      kind: 'boss',
      id: 'nyx-boss',
      ...scene('nyx-boss'),
      title: 'Boss: Volt',
      opponent: 'volt',
      aiLevel: 3,
      opponentHp: 255,
      twist: 'At half HP Volt summons a static storm every 16s: a short stun and scrambled gems.',
      rules: {
        phases: [{ atHpPct: 50, onEnter: [{ kind: 'empower', mult: 1.5, charges: 1 }] }],
        pulses: [
          {
            everyMs: 16_000,
            firstAtMs: 3000,
            target: 'player',
            label: 'Static storm!',
            effects: [
              { kind: 'stun', durationMs: 600 },
              { kind: 'destroy', count: 3, damagePerGem: 0 },
            ],
            fromPhase: 1,
          },
        ],
      },
      barks: { phase: { 1: { speaker: 'volt', text: "Can't catch lightning!" } } },
      goals: [G.ultimate(), G.under(150_000)],
    },
  ],
};
