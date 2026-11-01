import { G } from './goals';
import { scene } from './script';
import { StoryChapter } from './types';

/** Chapter 2: Rime maps the cracks and finds a pattern. Someone is doing this on purpose. */
export const RIME_CHAPTER: StoryChapter = {
  hero: 'rime',
  title: 'The Long Winter',
  unlocks: 'briar',
  nodes: [
    {
      kind: 'lesson',
      id: 'rime-cold-equation',
      ...scene('rime-cold-equation'),
      title: 'Lesson: Cold Equation',
      lesson: 'rime-cold-equation',
    },
    {
      kind: 'fight',
      id: 'rime-mirror',
      ...scene('rime-mirror'),
      title: 'Mirror, Mirror',
      opponent: 'rime',
      aiLevel: 1,
      echo: true,
      spotlight: ['sapphire', 'topaz'],
      twist: 'An Echo of Rime herself: same spells, same tricks.',
      goals: [G.spells(4), G.under(100_000)],
    },
    {
      kind: 'fight',
      id: 'rime-thaw',
      ...scene('rime-thaw'),
      title: 'Thaw',
      opponent: 'ember',
      aiLevel: 2,
      spotlight: ['ruby', 'amethyst'],
      twist: 'A sparring match with Ember. Her heat melts your ice twice as fast on her board.',
      rules: { sides: [undefined, { iceMult: 0.5 }] },
      goals: [G.hpAbove(50), G.under(120_000)],
    },
    {
      kind: 'gauntlet',
      id: 'rime-echo-hunt',
      ...scene('rime-echo-hunt'),
      title: 'Echo Hunt',
      twist: 'Two Echoes back to back. Your HP carries over (15% restored between).',
      waves: [
        { opponent: 'volt', aiLevel: 1, echo: true },
        { opponent: 'nyx', aiLevel: 2, echo: true },
      ],
      spotlight: ['emerald'],
      goals: [G.neverBelow(30), G.under(210_000)],
    },
    {
      kind: 'fight',
      id: 'rime-frostbitten',
      ...scene('rime-frostbitten'),
      title: 'Challenge: Frostbitten',
      optional: true,
      opponent: 'volt',
      aiLevel: 2,
      twist: 'Your Sapphire gems are silenced: no Flash Freeze.',
      rules: { sides: [{ silenced: ['sapphire'] }, undefined] },
      goals: [G.under(90_000), G.ultimate()],
    },
    {
      kind: 'boss',
      id: 'rime-boss',
      ...scene('rime-boss'),
      title: 'Boss: Briar',
      opponent: 'briar',
      aiLevel: 2,
      opponentHp: 300,
      twist: 'At half HP the grove fights back: Briar heals every 12s.',
      rules: {
        phases: [{ atHpPct: 50, onEnter: [{ kind: 'shield', amount: 15 }] }],
        pulses: [
          { everyMs: 12_000, firstAtMs: 3000, target: 'opponent', label: 'The grove heals Briar!', effects: [{ kind: 'heal', amount: 10 }], fromPhase: 1 },
        ],
      },
      barks: { phase: { 1: { speaker: 'briar', text: 'The grove remembers every wound.' } } },
      goals: [G.ultimate(), G.under(150_000)],
    },
  ],
};
