import { G } from './goals';
import { StoryChapter } from './types';

const N = 'narrator';

/** Chapter 1 (the vertical slice of "The Fracture"). See the story design doc in the project. */
export const EMBER_CHAPTER: StoryChapter = {
  hero: 'ember',
  title: 'Spark of Talent',
  unlocks: 'rime',
  nodes: [
    {
      kind: 'lesson',
      id: 'ember-first-spark',
      title: 'Lesson: First Spark',
      lesson: 'ember-first-spark',
      intro: [
        { speaker: N, text: 'The Academy of Gems. Every year, hopefuls come to the entrance trials. Every year, most go home.' },
        { speaker: 'ember', text: "Not me. I've been practicing my fireballs since I was six. Mostly on my uncle's hedges." },
        { speaker: N, text: 'Before the trials: the basics. Gems are magic. Match them, and they answer.' },
      ],
      outro: [{ speaker: 'ember', text: 'Fireball, Meteor, cascades. Easy. Where do I sign up?' }],
    },
    {
      kind: 'fight',
      id: 'ember-trial',
      title: 'Entrance Trial',
      opponent: 'volt',
      aiLevel: 0,
      spotlight: ['ruby', 'topaz'],
      goals: [G.spells(3), G.under(90_000)],
      intro: [
        { speaker: N, text: 'The trials are duels. Each mage has their own board; wear the other down before they wear you down.' },
        { speaker: 'volt', text: "Trial one's me? Cool, cool. I'll go easy. Mostly." },
        { speaker: N, text: 'Topaz gems cast Ignite: a burn that hurts every second until your opponent makes enough matches.', gem: 'topaz' },
        { speaker: 'ember', text: 'Burn and blast. My kind of plan.' },
      ],
      outro: [
        { speaker: 'volt', text: "Okay, okay, you're good. Hey, did the floor just... hum?" },
        { speaker: 'ember', text: "That's the sound of me winning." },
      ],
    },
    {
      kind: 'fight',
      id: 'ember-wild-magic',
      title: 'Wild Magic',
      opponent: 'briar',
      aiLevel: 1,
      spotlight: ['amethyst'],
      twist: 'Every 12s the Heartstone pulses and freezes 3 gems on both boards.',
      rules: {
        pulses: [{ everyMs: 12_000, target: 'both', label: 'The Heartstone pulses!', effects: [{ kind: 'freeze', count: 3, durationMs: 6000 }] }],
      },
      barks: { pulse: 'The Heartstone pulses!' },
      goals: [G.hpAbove(60), G.under(100_000)],
      intro: [
        { speaker: N, text: 'Deep below the Academy beats the Heartstone, the source of all gem magic. Today, it skips a beat.' },
        { speaker: 'briar', text: 'Do you feel that? The gems are restless. Something is wrong with the Heartstone.' },
        { speaker: 'ember', text: "Something's wrong with your strategy, maybe." },
        { speaker: N, text: "Amethyst casts Scorch: it burns holes in your opponent's board. Frozen gems can't be swapped, but matching them breaks the ice.", gem: 'amethyst' },
      ],
      outro: [
        { speaker: 'briar', text: "You fight well. But those pulses weren't part of any trial. Be careful, firebrand." },
        { speaker: 'ember', text: 'Probably just the instructors being dramatic.' },
      ],
    },
    {
      kind: 'lesson',
      id: 'ember-hold-the-line',
      title: 'Lesson: Hold the Line',
      lesson: 'ember-hold-the-line',
      intro: [
        { speaker: N, text: 'Offense wins trials. Defense survives them. Shields, healing, and ice: learn them now.' },
        { speaker: 'ember', text: "Fine. But I'm still setting things on fire afterwards." },
      ],
      outro: [{ speaker: 'ember', text: 'Shield up, heal up, break the ice. Got it. Now where were we?' }],
    },
    {
      kind: 'survival',
      id: 'ember-first-echo',
      title: 'The First Echo',
      opponent: 'nyx',
      aiLevel: 2,
      echo: true,
      opponentHp: 900,
      twist: "An Echo you can't beat yet. Survive for 45 seconds.",
      rules: { surviveMs: 45_000 },
      goals: [G.hpAbove(50), G.ultimate()],
      intro: [
        { speaker: N, text: 'The trial hall goes dark. When the lights return, a figure stands in the arena: gray, flickering, with hollow eyes.' },
        { speaker: 'ember', text: "Nyx? No... that's not her. It's like a copy made of cracked glass." },
        { speaker: 'nyx', text: '...hhh... trial... continues...' },
        { speaker: N, text: "This Echo is too strong to defeat. Hold out until the instructors arrive: survive 45 seconds." },
      ],
      outro: [
        { speaker: N, text: 'The Echo shatters into gray dust as the instructors rush in.' },
        { speaker: 'ember', text: 'What WAS that? And why did everyone just look at me?' },
      ],
    },
    {
      kind: 'fight',
      id: 'ember-glass-cannon',
      title: 'Challenge: Glass Cannon',
      optional: true,
      opponent: 'volt',
      aiLevel: 2,
      playerHp: 100,
      opponentHp: 100,
      twist: '100 HP each and no shields. Pure race.',
      rules: { sides: [{ noShields: true }, { noShields: true }] },
      goals: [G.under(45_000), G.hpAbove(50)],
      intro: [
        { speaker: 'volt', text: 'Practice round! No shields, tiny health bars. First to blink loses.' },
        { speaker: 'ember', text: "I don't blink. I burn." },
      ],
      outro: [{ speaker: 'volt', text: "Rematch! No? Fine. Rematch later!" }],
    },
    {
      kind: 'boss',
      id: 'ember-boss',
      title: 'Boss: Rime',
      opponent: 'rime',
      aiLevel: 2,
      opponentHp: 320,
      spotlight: ['sapphire', 'emerald'],
      twist: 'At half HP Rime gets serious: she shields up and freezes your gems every 15s.',
      rules: {
        phases: [{ atHpPct: 50, onEnter: [{ kind: 'shield', amount: 25 }] }],
        pulses: [{ everyMs: 15_000, firstAtMs: 4000, target: 'player', label: 'Rime: Stay still.', effects: [{ kind: 'freeze', count: 6, durationMs: 7000 }], fromPhase: 1 }],
      },
      barks: { phase: { 1: { speaker: 'rime', text: 'Enough games.' } } },
      goals: [G.ultimate(), G.under(150_000)],
      intro: [
        { speaker: 'rime', text: "Ember. The Echo appeared at YOUR trial. The Heartstone cracked on YOUR first day." },
        { speaker: 'ember', text: "So it's my fault? You think I broke the Heartstone with a fireball?" },
        { speaker: 'rime', text: "I think fire breaks things. Prove me wrong. If you can." },
      ],
      outro: [
        { speaker: 'rime', text: "...You fight like someone with nothing to hide. Fine. If it isn't you, someone is doing this on purpose." },
        { speaker: 'rime', text: "I'll find out who. And you're coming with me, firebrand." },
      ],
    },
  ],
};
