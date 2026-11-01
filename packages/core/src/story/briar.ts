import { G } from './goals';
import { StoryChapter } from './types';

const N = 'narrator';

/** Chapter 3: the grove is dying. The poison looks like Nyx's work, but it isn't. */
export const BRIAR_CHAPTER: StoryChapter = {
  hero: 'briar',
  title: 'Roots and Thorns',
  unlocks: 'nyx',
  nodes: [
    {
      kind: 'lesson',
      id: 'briar-deep-roots',
      title: 'Lesson: Deep Roots',
      lesson: 'briar-deep-roots',
      intro: [
        { speaker: 'briar', text: 'A grove survives by healing faster than it is hurt. So do I.' },
        { speaker: 'briar', text: 'Mend, Barkskin, and when it is needed: thorns.' },
      ],
      outro: [{ speaker: 'briar', text: 'Roots deep, thorns sharp. The grove is waiting.' }],
    },
    {
      kind: 'fight',
      id: 'briar-sapling',
      title: 'Protect the Sapling',
      opponent: 'nyx',
      aiLevel: 2,
      echo: true,
      spotlight: ['emerald', 'sapphire'],
      twist: "The Heartwood Sapling is withering. Your healing goes to it, and you lose if it falls.",
      rules: { protect: { name: 'Heartwood Sapling', hp: 150, drainPerSec: 2 } },
      goals: [G.spells(5), G.under(120_000)],
      intro: [
        { speaker: N, text: "At the heart of the grove grows the Heartwood Sapling. Gray rot creeps up its trunk." },
        { speaker: 'briar', text: 'Something is feeding on it. And here comes its guard dog.' },
        { speaker: N, text: "An Echo of Nyx. Keep the Sapling alive: Mend (emerald) and Regrowth (sapphire) heal the Sapling instead of you.", gem: 'emerald' },
      ],
      outro: [
        { speaker: 'briar', text: 'It lives. But this rot... it carries the scent of curses. Nyx\'s curses.' },
        { speaker: 'rime', text: "Echoes copy people. Don't assume." },
      ],
    },
    {
      kind: 'fight',
      id: 'briar-blight',
      title: 'Blight',
      opponent: 'rime',
      aiLevel: 2,
      spotlight: ['amethyst'],
      twist: 'The blight spreads: a gem on your board turns to stone every 10s.',
      rules: { pulses: [{ everyMs: 10_000, target: 'player', label: 'The blight spreads.', effects: [{ kind: 'petrify', count: 1 }] }] },
      goals: [G.noHealing(), G.under(120_000)],
      intro: [
        { speaker: 'rime', text: "The rot is turning your roots to stone. Fight in it. Learn how it moves." },
        { speaker: N, text: 'Matches next to stone crumble it. Entangle (amethyst) turns your opponent\'s gems to stone too.', gem: 'amethyst' },
      ],
      outro: [{ speaker: 'briar', text: 'The stone follows a path. Toward the old curse library.' }],
    },
    {
      kind: 'fight',
      id: 'briar-ashes',
      title: 'Ashes',
      opponent: 'ember',
      aiLevel: 2,
      echo: true,
      spotlight: ['ruby', 'topaz'],
      twist: 'An Echo of Ember, burning everything in its path.',
      goals: [G.hpAbove(50), G.ultimate()],
      intro: [
        { speaker: N, text: 'At the library doors, an Echo of Ember stands among scorched leaves.' },
        { speaker: 'ember', text: 'Hey! That is NOT what my hair looks like.' },
        { speaker: 'briar', text: "Stand back. Fire is a grove's oldest enemy. I know how to fight it." },
      ],
      outro: [{ speaker: 'ember', text: "Thanks. Weird to watch yourself lose. Weirder to cheer." }],
    },
    {
      kind: 'fight',
      id: 'briar-withered',
      title: 'Challenge: Withered',
      optional: true,
      opponent: 'volt',
      aiLevel: 2,
      twist: 'Your healing does nothing. All thorns, no roots.',
      rules: { sides: [{ noHealing: true }, undefined] },
      goals: [G.under(105_000), G.neverBelow(40)],
      intro: [{ speaker: 'volt', text: "Healer with no heals? This I gotta see." }],
      outro: [{ speaker: 'briar', text: 'Thorns are enough, when they must be.' }],
    },
    {
      kind: 'boss',
      id: 'briar-boss',
      title: 'Boss: Nyx',
      opponent: 'nyx',
      aiLevel: 3,
      opponentHp: 240,
      twist: 'At half HP Nyx curses you every 14s.',
      rules: {
        phases: [{ atHpPct: 50 }],
        pulses: [
          {
            everyMs: 14_000,
            firstAtMs: 2000,
            target: 'player',
            label: 'Nyx curses you!',
            effects: [{ kind: 'poison', perSecond: 1.2, matches: 3, maxMs: 6000, label: 'Curse' }],
            fromPhase: 1,
          },
        ],
      },
      barks: { phase: { 1: { speaker: 'nyx', text: "You want poison? Here's poison." } } },
      goals: [G.ultimate(), G.under(150_000)],
      intro: [
        { speaker: 'nyx', text: "The gardener, in MY library. Come to accuse me of something?" },
        { speaker: 'briar', text: 'Your curses are in my grove, Nyx.' },
        { speaker: 'nyx', text: "My curses are wherever I put them. And I didn't put them there. But you won't believe that, will you?" },
      ],
      outro: [
        { speaker: N, text: "Briar's cleansing light washes over Nyx. The curse marks don't fade. They crack, and gray dust spills out." },
        { speaker: 'briar', text: "This isn't your magic. It's hollow. Someone wore your curses like a mask." },
        { speaker: 'nyx', text: '...Someone framed me. Oh, they are going to regret that.' },
      ],
    },
  ],
};
