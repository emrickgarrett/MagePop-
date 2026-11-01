import { G } from './goals';
import { StoryChapter } from './types';

const N = 'narrator';

/** Chapter 5: Volt chases a lead alone and is ambushed by the Hollow. */
export const VOLT_CHAPTER: StoryChapter = {
  hero: 'volt',
  title: 'Eye of the Storm',
  unlocks: null,
  nodes: [
    {
      kind: 'lesson',
      id: 'volt-overcharge',
      title: 'Lesson: Overcharge',
      lesson: 'volt-overcharge',
      intro: [
        { speaker: 'volt', text: "Speed is great. Speed plus a supercharged hit? Better." },
        { speaker: 'volt', text: 'Charge up, then let it rip.' },
      ],
      outro: [{ speaker: 'volt', text: "Charged. Fast. Ready. To the Observatory!" }],
    },
    {
      kind: 'survival',
      id: 'volt-ambush',
      title: 'Ambush',
      opponent: 'hollow',
      aiLevel: 3,
      mystery: { name: 'The Hollow' },
      opponentHp: 999,
      twist: "A hooded figure, far too strong. You can't win: survive 50 seconds.",
      rules: { surviveMs: 50_000 },
      goals: [G.hpAbove(40), G.spells(6)],
      intro: [
        { speaker: N, text: 'The Observatory is silent. Gray dust covers everything. In the center stands a hooded figure, hands on a cracked shard of the Heartstone.' },
        { speaker: 'volt', text: "Hey! You! You're the one making the Echoes!" },
        { speaker: N, text: '"Little storm. You came alone. How convenient."' },
        { speaker: N, text: 'This is the Hollow. You cannot beat them yet. Survive for 50 seconds.' },
      ],
      outro: [
        { speaker: N, text: 'The Hollow raises a hand. Lightning drains out of Volt like water from a cracked jar.' },
        { speaker: N, text: '"Your speed is mine now. Run along, if you still can."' },
        { speaker: 'volt', text: "...I can't feel the storm. Everything feels slow." },
      ],
    },
    {
      kind: 'fight',
      id: 'volt-drained',
      title: 'Drained',
      opponent: 'rime',
      aiLevel: 2,
      echo: true,
      spotlight: ['sapphire', 'emerald'],
      twist: 'Your speed was stolen: every move takes 25% longer.',
      rules: { sides: [{ slowMult: 1.25 }, undefined] },
      goals: [G.ultimate(), G.under(150_000)],
      intro: [
        { speaker: N, text: 'Volt limps back toward the Academy. Echoes follow, sensing weakness.' },
        { speaker: 'volt', text: 'Fine. Slow it is. Static Shock (sapphire) stuns them; Recharge (emerald) keeps me up.', gem: 'sapphire' },
      ],
      outro: [{ speaker: 'volt', text: "Still got it. Slower. But still got it." }],
    },
    {
      kind: 'gauntlet',
      id: 'volt-recharge',
      title: 'Recharge',
      twist: 'Two Echoes back to back. Each win brings some of your spark back (30% HP restored).',
      healBetweenPct: 30,
      waves: [
        { opponent: 'ember', aiLevel: 2, echo: true },
        { opponent: 'briar', aiLevel: 2, echo: true },
      ],
      spotlight: ['amethyst'],
      goals: [G.neverBelow(30), G.under(240_000)],
      intro: [
        { speaker: 'nyx', text: "There you are. Alone, slow, and surrounded. Terrible plan, as predicted." },
        { speaker: 'volt', text: 'Help me break these Echoes. Every one I beat, I feel a little more charge.' },
        { speaker: N, text: 'Polarity (amethyst) rewires your own gems into Spark gems: set up big chains.', gem: 'amethyst' },
      ],
      outro: [{ speaker: 'volt', text: "There it is. The storm's back. Not all of it, but enough." }],
    },
    {
      kind: 'fight',
      id: 'volt-nightmare-echo',
      title: 'Challenge: Master Echo',
      optional: true,
      opponent: 'rime',
      aiLevel: 4,
      echo: true,
      twist: 'An Echo at Master difficulty.',
      goals: [G.under(150_000), G.hpAbove(25)],
      intro: [{ speaker: 'rime', text: "This one is stronger than the rest. Like it learned from all of them." }],
      outro: [{ speaker: 'volt', text: 'Learned from them, sure. Still not fast enough.' }],
    },
    {
      kind: 'boss',
      id: 'volt-boss',
      title: 'Boss: Ember, Final Exam',
      opponent: 'ember',
      aiLevel: 3,
      opponentHp: 235,
      twist: 'Ember at full power, in three phases: a shield at 60% HP, then burning pressure at 30%.',
      rules: {
        phases: [
          { atHpPct: 60, onEnter: [{ kind: 'shield', amount: 20 }] },
          { atHpPct: 30, onEnter: [{ kind: 'heal', amount: 25 }] },
        ],
        pulses: [
          {
            everyMs: 12_000,
            firstAtMs: 3000,
            target: 'player',
            label: 'Ember: Wildfire!',
            effects: [{ kind: 'poison', perSecond: 1.5, matches: 3, maxMs: 7000, label: 'Burn' }],
            fromPhase: 2,
          },
        ],
      },
      barks: {
        phase: {
          1: { speaker: 'ember', text: "Okay, you're good. Now I'm serious!" },
          2: { speaker: 'ember', text: 'Everything I have got!' },
        },
      },
      goals: [G.ultimate(2), G.under(180_000)],
      intro: [
        { speaker: 'ember', text: "The Hollow is under the Heartstone, and we're going down there together. But first: are you actually ready?" },
        { speaker: 'volt', text: 'Final exam?' },
        { speaker: 'ember', text: 'Final exam. Everything I have. Show me the storm is back.' },
      ],
      outro: [
        { speaker: 'ember', text: "...Yeah. The storm's back." },
        { speaker: N, text: 'Five mages stand at the stairway down to the Heartstone: fire, ice, root, venom and storm.' },
        { speaker: 'rime', text: 'Whoever the Hollow is, they are waiting for us.' },
        { speaker: N, text: 'The Finale is open: pick any mage and go down into the Fracture.' },
      ],
    },
  ],
};
