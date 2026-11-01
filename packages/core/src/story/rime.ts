import { G } from './goals';
import { StoryChapter } from './types';

const N = 'narrator';

/** Chapter 2: Rime maps the cracks and finds a pattern. Someone is doing this on purpose. */
export const RIME_CHAPTER: StoryChapter = {
  hero: 'rime',
  title: 'The Long Winter',
  unlocks: 'briar',
  nodes: [
    {
      kind: 'lesson',
      id: 'rime-cold-equation',
      title: 'Lesson: Cold Equation',
      lesson: 'rime-cold-equation',
      intro: [
        { speaker: 'rime', text: 'Ember sets things on fire and hopes. I prefer equations.' },
        { speaker: 'rime', text: 'Freeze their gems. Then shatter the ice for damage. Two moves, one answer.' },
      ],
      outro: [{ speaker: 'rime', text: 'Freeze, shatter, strike. Now: the cracks.' }],
    },
    {
      kind: 'fight',
      id: 'rime-mirror',
      title: 'Mirror, Mirror',
      opponent: 'rime',
      aiLevel: 1,
      echo: true,
      spotlight: ['sapphire', 'topaz'],
      twist: 'An Echo of Rime herself: same spells, same tricks.',
      goals: [G.spells(4), G.under(100_000)],
      intro: [
        { speaker: N, text: "Rime follows a crack in the floor to the frozen fountain. Something is waiting in the ice: her own face, gray and hollow." },
        { speaker: 'rime', text: 'An Echo of me. How unflattering.' },
        { speaker: 'ember', text: "Want me to melt it?" },
        { speaker: 'rime', text: "No. If it fights like me, I already know how to beat it." },
      ],
      outro: [
        { speaker: 'rime', text: "The Echoes aren't random. Each one appears where the Heartstone's cracks surface." },
        { speaker: 'ember', text: 'So we follow the cracks and find whoever is making them.' },
      ],
    },
    {
      kind: 'fight',
      id: 'rime-thaw',
      title: 'Thaw',
      opponent: 'ember',
      aiLevel: 2,
      spotlight: ['ruby', 'amethyst'],
      twist: "A sparring match with Ember. Her heat melts your ice twice as fast on her board.",
      rules: { sides: [undefined, { iceMult: 0.5 }] },
      goals: [G.hpAbove(50), G.under(120_000)],
      intro: [
        { speaker: 'ember', text: "If we're chasing Echoes, you need to beat someone who doesn't sit still. Spar with me." },
        { speaker: 'rime', text: "Your heat melts my ice. That changes the equation." },
        { speaker: N, text: 'Your frozen gems melt fast on Ember\'s board. Use Ice Shard (ruby) and Chill (amethyst) to stun her while it holds.', gem: 'amethyst' },
      ],
      outro: [{ speaker: 'ember', text: "Okay, that was cold. In a good way. I think." }],
    },
    {
      kind: 'gauntlet',
      id: 'rime-echo-hunt',
      title: 'Echo Hunt',
      twist: 'Two Echoes back to back. Your HP carries over (15% restored between).',
      waves: [
        { opponent: 'volt', aiLevel: 1, echo: true },
        { opponent: 'nyx', aiLevel: 2, echo: true },
      ],
      spotlight: ['emerald'],
      goals: [G.neverBelow(30), G.under(210_000)],
      intro: [
        { speaker: N, text: 'The cracks lead to the greenhouse wing. Two Echoes stand guard among the frosted plants.' },
        { speaker: 'rime', text: 'Two at once. Pace yourself. Frost Armor (emerald) will keep you standing.', gem: 'emerald' },
      ],
      outro: [
        { speaker: 'rime', text: "The cracks don't stop here. They run under the grove. Briar's grove." },
        { speaker: 'ember', text: "Briar's going to love hearing that." },
      ],
    },
    {
      kind: 'fight',
      id: 'rime-frostbitten',
      title: 'Challenge: Frostbitten',
      optional: true,
      opponent: 'volt',
      aiLevel: 2,
      twist: 'Your Sapphire gems are silenced: no Flash Freeze.',
      rules: { sides: [{ silenced: ['sapphire'] }, undefined] },
      goals: [G.under(90_000), G.ultimate()],
      intro: [{ speaker: 'volt', text: 'Bet you can\'t win without freezing anything. Loser buys lunch.' }],
      outro: [{ speaker: 'volt', text: "...I'll get lunch." }],
    },
    {
      kind: 'boss',
      id: 'rime-boss',
      title: 'Boss: Briar',
      opponent: 'briar',
      aiLevel: 2,
      opponentHp: 300,
      twist: 'At half HP the grove fights back: Briar heals every 12s.',
      rules: {
        phases: [{ atHpPct: 50, onEnter: [{ kind: 'shield', amount: 15 }] }],
        pulses: [{ everyMs: 12_000, firstAtMs: 3000, target: 'opponent', label: 'The grove heals Briar!', effects: [{ kind: 'heal', amount: 10 }], fromPhase: 1 }],
      },
      barks: { phase: { 1: { speaker: 'briar', text: 'The grove remembers every wound.' } } },
      goals: [G.ultimate(), G.under(150_000)],
      intro: [
        { speaker: 'briar', text: 'Frost on my saplings. Cracks under my roots. And here you are, ice queen.' },
        { speaker: 'rime', text: "I'm following the cracks, not making them. Let me pass." },
        { speaker: 'briar', text: 'The grove will decide that.' },
      ],
      outro: [
        { speaker: 'briar', text: "Your ice is cold, but it isn't rotten. The grove's sickness is something else. Something gray." },
        { speaker: 'rime', text: 'Then show me where it starts.' },
      ],
    },
  ],
};
