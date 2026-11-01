import { G } from './goals';
import { StoryChapter } from './types';

const N = 'narrator';

/** Chapter 4: Nyx hunts whoever framed her, tracking the void magic with curse-craft. */
export const NYX_CHAPTER: StoryChapter = {
  hero: 'nyx',
  title: 'Sweet Venom',
  unlocks: 'volt',
  nodes: [
    {
      kind: 'lesson',
      id: 'nyx-venom-and-burst',
      title: 'Lesson: Venom and Burst',
      lesson: 'nyx-venom-and-burst',
      intro: [
        { speaker: 'nyx', text: 'Lesson one in curse-craft: poison first, payoff second.' },
        { speaker: 'nyx', text: "Lesson two: never frame a hexweaver." },
      ],
      outro: [{ speaker: 'nyx', text: 'Venom, Burst, Siphon. Now let\'s find our little impostor.' }],
    },
    {
      kind: 'gauntlet',
      id: 'nyx-the-hunt',
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
      intro: [
        { speaker: N, text: "Nyx traces the gray dust with a finding-hex. It leads into the catacombs under the Academy, and they are full of Echoes." },
        { speaker: 'nyx', text: 'Copies of my friends. Rude. Let\'s clear them out.' },
      ],
      outro: [{ speaker: 'nyx', text: "Every Echo I break leaves more dust. It all drifts the same way: down, toward the Heartstone." }],
    },
    {
      kind: 'fight',
      id: 'nyx-hex-trial',
      title: 'Hex Trial',
      opponent: 'briar',
      aiLevel: 3,
      spotlight: ['topaz'],
      twist: 'The catacomb floor is cursed: both boards start with 6 stones.',
      rules: { start: [{ target: 'both', stones: 6 }] },
      goals: [G.spells(5), G.under(120_000)],
      intro: [
        { speaker: 'briar', text: 'The tunnel is sealed with petrified roots. Spar with me while we wait for Rime to find a way through.' },
        { speaker: N, text: 'Stone everywhere. Matching next to a stone crumbles it; Hex (topaz) adds more to your opponent\'s board.', gem: 'topaz' },
      ],
      outro: [{ speaker: 'briar', text: "You fight cleaner than your reputation." }, { speaker: 'nyx', text: "Don't tell anyone." }],
    },
    {
      kind: 'fight',
      id: 'nyx-turned-curse',
      title: 'Turned Curse',
      opponent: 'nyx',
      aiLevel: 2,
      echo: true,
      twist: 'An Echo of Nyx using your own curse on you: you are poisoned every 15s.',
      rules: {
        pulses: [{ everyMs: 15_000, firstAtMs: 5000, target: 'player', label: 'Your own curse!', effects: [{ kind: 'poison', perSecond: 1.5, matches: 3, maxMs: 8000, label: 'Curse' }] }],
      },
      spotlight: ['sapphire'],
      goals: [G.hpAbove(40), G.under(120_000)],
      intro: [
        { speaker: N, text: 'At the bottom of the stairs: an Echo of Nyx, wearing her curse marks like a stolen coat.' },
        { speaker: 'nyx', text: "So THAT's who's been walking around in my face." },
        { speaker: N, text: 'Night Veil (sapphire) shields you and cleanses your poison.', gem: 'sapphire' },
      ],
      outro: [
        { speaker: 'nyx', text: 'It whispered before it broke. "The storm will open the way."' },
        { speaker: 'rime', text: 'The storm. Volt.' },
      ],
    },
    {
      kind: 'fight',
      id: 'nyx-quick-venom',
      title: 'Challenge: Quick Venom',
      optional: true,
      opponent: 'volt',
      aiLevel: 3,
      twist: 'Volt at full speed. Can you poison lightning?',
      goals: [G.under(45_000), G.ultimate()],
      intro: [{ speaker: 'volt', text: "Poison takes seconds. I only need one!" }],
      outro: [{ speaker: 'nyx', text: 'Even lightning slows down when it\'s dying.' }],
    },
    {
      kind: 'boss',
      id: 'nyx-boss',
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
            effects: [{ kind: 'stun', durationMs: 600 }, { kind: 'destroy', count: 3, damagePerGem: 0 }],
            fromPhase: 1,
          },
        ],
      },
      barks: { phase: { 1: { speaker: 'volt', text: "Can't catch lightning!" } } },
      goals: [G.ultimate(), G.under(150_000)],
      intro: [
        { speaker: 'volt', text: 'The gray stuff, the Echoes, all of it started when YOU showed up in the catacombs. Explain. Fast.' },
        { speaker: 'nyx', text: "I'm hunting the one who did this. Same as you, if you'd slow down for one second." },
        { speaker: 'volt', text: "I don't do slow." },
      ],
      outro: [
        { speaker: 'volt', text: "Okay. Okay! Not you. But I know who it might be. There's someone living in the old Observatory. Hood. Gray eyes." },
        { speaker: 'volt', text: "I'm going to go look. Alone. I'm fastest." },
        { speaker: 'nyx', text: "That's a terrible plan." },
      ],
    },
  ],
};
