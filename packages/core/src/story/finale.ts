import { G } from './goals';
import { StoryChapter } from './types';

const N = 'narrator';

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
  unlocks: null,
  nodes: [
    {
      kind: 'gauntlet',
      id: 'finale-fracture',
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
      intro: [
        { speaker: N, text: 'Beneath the Academy, the stairway ends at a wound in the world: the Fracture. Gray light leaks up from below.' },
        { speaker: 'rime', text: 'Every Echo we have fought came from down there. Expect all of them at once.' },
        { speaker: 'nyx', text: 'Copies of all five of us. Finally, a fair fight. For them.' },
        { speaker: 'volt', text: 'Pick who goes first. The rest of us hold the stairs. Go, go, go!' },
      ],
      outro: [
        { speaker: N, text: 'The last Echo crumbles into dust. The dust drifts down, toward the heart of the Fracture.' },
        { speaker: 'briar', text: 'They are not being destroyed. They are going home.' },
      ],
    },
    {
      kind: 'fight',
      id: 'finale-gray-garden',
      title: 'The Gray Garden',
      opponent: 'briar',
      aiLevel: 2,
      echo: true,
      twist: 'The Fracture drains everything: every 10s three gems go hollow on both boards. Match next to a hollow gem to break it.',
      rules: {
        pulses: [{ everyMs: 10_000, firstAtMs: 4000, target: 'both', label: 'The Fracture drains the color.', effects: [{ kind: 'hollow', count: 3 }] }],
      },
      goals: [G.spells(6), G.under(150_000)],
      intro: [
        { speaker: N, text: "A garden of stone flowers, every petal gray. An Echo of Briar tends it, humming someone else's tune." },
        { speaker: 'briar', text: 'She grew this from my grove. From what she stole.' },
        { speaker: N, text: 'Hollow gems are drained shells: they cannot be matched or moved. A match right next to one breaks it free.' },
      ],
      outro: [
        { speaker: N, text: 'A voice drifts up from below, calm and tired.' },
        { speaker: 'hollow', text: 'You keep breaking my things. Come down, then. Let us finish it.' },
      ],
    },
    {
      kind: 'fight',
      id: 'finale-colorless',
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
      intro: [{ speaker: 'hollow', text: 'No tricks. No healing, no walls. Just us. Are you as good as the Academy thinks?' }],
      outro: [{ speaker: 'hollow', text: '...Better than I was. Annoying.' }],
    },
    {
      kind: 'boss',
      id: 'finale-boss',
      title: 'Boss: The Hollow',
      opponent: 'hollow',
      aiLevel: 3,
      opponentHp: 240,
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
      intro: [
        { speaker: N, text: 'At the bottom of the Fracture floats the Heartstone, split down the middle. The hooded figure stands before it.' },
        { speaker: 'hollow', text: 'I failed the trials, you know. Six years ago. They said my magic had no color.' },
        { speaker: 'hollow', text: 'So I learned to take color from everything else. Your grove. Your curses. Your storm.' },
        { speaker: 'ember', text: 'And now you want the Heartstone too.' },
        { speaker: 'hollow', text: 'I want what you all were handed. Come. Take it back, if you can.' },
      ],
      outro: [
        {
          speaker: N,
          text: 'The Hollow falls to one knee. The gray drains out of the Heartstone, and color floods back into the Fracture: red, blue, green, gold, violet.',
        },
        { speaker: 'hollow', text: '...Then finish it. That is what heroes do.' },
        { speaker: 'briar', text: 'No. Roots grow back. So can people.' },
        { speaker: 'rime', text: 'The trials were wrong about you. Your magic has a color. It is just one nobody tested for.' },
        { speaker: 'nyx', text: 'And frankly, anyone who framed ME this well belongs at the Academy.' },
        { speaker: 'volt', text: 'Rematch tomorrow? Fair fight. Bring your weird gray gems.' },
        { speaker: 'ember', text: 'The Academy has room for one more. If you want it.' },
        { speaker: 'hollow', text: '...I will think about it.' },
        { speaker: N, text: 'The Heartstone is whole again. The Fracture is closed. Thanks for playing The Fracture!' },
      ],
    },
  ],
};
