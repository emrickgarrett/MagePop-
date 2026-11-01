import { G } from './goals';
import { scene } from './script';
import { StoryChapter } from './types';

/** Chapter 5: Volt chases a lead alone and is ambushed by the Hollow. */
export const VOLT_CHAPTER: StoryChapter = {
  hero: 'volt',
  title: 'Eye of the Storm',
  unlocks: null,
  nodes: [
    {
      kind: 'lesson',
      id: 'volt-overcharge',
      ...scene('volt-overcharge'),
      title: 'Lesson: Overcharge',
      lesson: 'volt-overcharge',
    },
    {
      kind: 'survival',
      id: 'volt-ambush',
      ...scene('volt-ambush'),
      title: 'Ambush',
      opponent: 'hollow',
      aiLevel: 3,
      mystery: { name: 'The Hollow' },
      opponentHp: 999,
      twist: "A hooded figure, far too strong. You can't win: survive 50 seconds.",
      rules: { surviveMs: 50_000 },
      goals: [G.hpAbove(40), G.spells(6)],
    },
    {
      kind: 'fight',
      id: 'volt-drained',
      ...scene('volt-drained'),
      title: 'Drained',
      opponent: 'rime',
      aiLevel: 2,
      echo: true,
      spotlight: ['sapphire', 'emerald'],
      twist: 'Your speed was stolen: every move takes 25% longer.',
      rules: { sides: [{ slowMult: 1.25 }, undefined] },
      goals: [G.ultimate(), G.under(150_000)],
    },
    {
      kind: 'gauntlet',
      id: 'volt-recharge',
      ...scene('volt-recharge'),
      title: 'Recharge',
      twist: 'Two Echoes back to back. Each win brings some of your spark back (30% HP restored).',
      healBetweenPct: 30,
      waves: [
        { opponent: 'ember', aiLevel: 2, echo: true },
        { opponent: 'briar', aiLevel: 2, echo: true },
      ],
      spotlight: ['amethyst'],
      goals: [G.neverBelow(30), G.under(240_000)],
    },
    {
      kind: 'fight',
      id: 'volt-nightmare-echo',
      ...scene('volt-nightmare-echo'),
      title: 'Challenge: Master Echo',
      optional: true,
      opponent: 'rime',
      aiLevel: 4,
      echo: true,
      twist: 'An Echo at Master difficulty.',
      goals: [G.under(150_000), G.hpAbove(25)],
    },
    {
      kind: 'boss',
      id: 'volt-boss',
      ...scene('volt-boss'),
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
    },
  ],
};
