import { CHARACTERS, getCharacter } from './characters';
import { describeSpell } from './describe';
import { EMBER_CHAPTER } from './story/ember';
import { G } from './story/goals';
import { DialogueLine, FightNode, StoryChapter, StoryNode } from './story/types';
import { GemColor } from './types';

export * from './story/types';
export { G as STAR_GOALS } from './story/goals';
export { LESSONS } from './story/lessons';

function teach(heroId: string, color: GemColor): DialogueLine[] {
  const ch = getCharacter(heroId);
  const s = ch.spells[color];
  return [
    {
      speaker: 'narrator',
      gem: color,
      text: `Match 4 of these to cast ${s.active.name}: ${describeSpell(s.active, ch)}`,
    },
    {
      speaker: 'narrator',
      gem: color,
      text: `Match 5 or more (lines, L or T shapes) for the ultimate, ${s.ultimate.name}: ${describeSpell(s.ultimate, ch)}`,
    },
  ];
}

const BASICS: DialogueLine[] = [
  { speaker: 'narrator', text: 'Swap two neighboring gems to line up 3 or more of the same color. Each player has their own board — and a health bar.' },
  { speaker: 'narrator', text: 'A 3-match is a basic hit: a little damage, any color. A 4-match casts that color\'s spell. A 5-match unleashes its ultimate.' },
  { speaker: 'narrator', text: 'Cascades power up every match after the first. Bring their HP to zero before they do the same to you!' },
];

/** Hand-written flavor per chapter; spell explanations are generated from data so they never go stale. */
const FLAVOR: Record<string, { title: string; lines: [string, string, string][] }> = {
  ember: {
    title: 'Spark of Talent',
    lines: [
      ['Okay, Academy entrance trial. Burn everything in sight. That\'s the plan.', 'A Novice? This will be quick.', 'Ha! Did you see that? Did EVERYONE see that?'],
      ['Fire\'s great for offense, but I can\'t burn if I\'m dead. Time to learn some defense.', 'You\'re not getting past me!', 'Shields up, flames on. I could get used to this.'],
      ['Rime. The ice queen of the Academy. Nobody\'s ever melted her.', 'Your fire is loud. Mine is patient. Let us see which lasts.', 'You... actually thawed me. Fine. I\'ll walk with you, firebrand.'],
    ],
  },
  rime: {
    title: 'The Long Winter',
    lines: [
      ['Ember taught me something: patience alone doesn\'t win. Patience and timing do.', 'Frozen solid already? Ha!', 'Exactly as calculated.'],
      ['Freeze them, then shatter the ice. Two moves, one cold equation.', 'My board! I can\'t move!', 'Every crack in the ice was a choice.'],
      ['The Wildwarden, Briar. Her grove heals faster than I can freeze it.', 'Winter always ends, little frost. Spring always comes.', 'Spring arrived. And so did I.'],
    ],
  },
  briar: {
    title: 'Roots and Thorns',
    lines: [
      ['The grove is restless. Something poisons the roots.', 'You talk to trees? Weird.', 'Even a sprout can split stone.'],
      ['Healing alone loses slowly. I must grow thorns too.', 'Why won\'t you just fall down?!', 'Deep roots do not fear the storm.'],
      ['The poison has a name: Nyx. The Hexweaver.', 'Oh, the gardener came to visit! How sweet. Shall I wilt your flowers?', 'Your venom is cleansed. Now, will you help me heal what you hurt?'],
    ],
  },
  nyx: {
    title: 'Sweet Venom',
    lines: [
      ['Briar thinks I\'m redeemable. Cute. Let\'s show the Academy what curses can do.', 'Stay back, witch!', 'Shh. It only hurts for... well, a while.'],
      ['Poison first. Then Toxic Burst to cash it all in. Delicious.', 'I feel... sick...', 'Told you. Patience is a poison too.'],
      ['Volt, the Stormcaller. Too fast for poison to matter, they say.', 'Poison takes seconds. I only need one!', 'Even lightning slows down when it\'s dying.'],
    ],
  },
  volt: {
    title: 'Eye of the Storm',
    lines: [
      ['Five mages, one Academy, and I\'m the fastest. Let\'s prove it.', 'Wait, I\'m not ready—', 'Too slow!'],
      ['Overcharge, then hit. Rewire my board for combos. Chaos is a ladder.', 'You can\'t keep this pace forever!', 'Watch me.'],
      ['Final exam: Ember, the one who started all this. At full power.', 'You\'ve all grown so much. Show me everything!', 'The Academy has a new champion... for now.'],
    ],
  },
};

function chapterOrder(): string[] {
  return CHARACTERS.map((c) => c.id);
}

/** Spells taught per fight: fight 1 teaches 2 colors, fight 2 two more, fight 3 the last one. */
function spotlightPlan(heroId: string): GemColor[][] {
  const colors = Object.keys(getCharacter(heroId).spells) as GemColor[];
  return [colors.slice(0, 2), colors.slice(2, 4), colors.slice(4)];
}

/**
 * Chapters 2-5 in their original three-fight form, converted to story nodes. They get the full
 * "Fracture" rewrite in phase 2 (see the story design doc); their ids are unchanged so progress carries over.
 */
function legacyChapter(hero: string, ci: number, order: string[]): StoryChapter {
  const flavor = FLAVOR[hero];
  const next = order[ci + 1] ?? null;
  const plan = spotlightPlan(hero);
  const regulars = order.filter((id) => id !== hero && id !== next);
  const bossId = next ?? order[0];
  const baseLevel = Math.min(ci, 3);
  const nodes: FightNode[] = [0, 1, 2].map((fi) => {
    const boss = fi === 2;
    const opponent = boss ? bossId : regulars[(ci + fi) % regulars.length];
    const [heroLine, foeLine, winLine] = flavor.lines[fi];
    return {
      kind: boss ? 'boss' : 'fight',
      id: `${hero}-${fi + 1}`,
      title: boss ? `Boss: ${getCharacter(opponent).name}` : `Trial ${fi + 1}`,
      opponent,
      aiLevel: Math.min(5, baseLevel + (boss ? 1 : 0) + (ci === 4 && boss ? 1 : 0)),
      spotlight: plan[fi],
      intro: [{ speaker: hero, text: heroLine }, ...plan[fi].flatMap((c) => teach(hero, c)), { speaker: opponent, text: foeLine }],
      outro: [{ speaker: boss ? opponent : hero, text: winLine }],
      goals: [G.ultimate(), G.under(120_000)],
    };
  });
  return { hero, title: flavor.title, nodes, unlocks: next };
}

export function buildStory(): StoryChapter[] {
  const order = chapterOrder();
  return order.map((hero, ci) => (hero === 'ember' ? EMBER_CHAPTER : legacyChapter(hero, ci, order)));
}

export const STORY: StoryChapter[] = buildStory();

// ---- progress helpers (shared by the game and the tests) ----------------------------------

/** Nodes that must be cleared to finish the chapter (optional challenges don't count). */
export const requiredNodes = (chap: StoryChapter) => chap.nodes.filter((n) => !n.optional);

export function chapterComplete(chap: StoryChapter, cleared: readonly string[]): boolean {
  return requiredNodes(chap).every((n) => cleared.includes(n.id));
}

/**
 * Can this node be played? The chapter's hero must be unlocked and every earlier required node
 * cleared (an optional node opens once the node before it is cleared).
 */
export function nodeAvailable(chap: StoryChapter, index: number, cleared: readonly string[], unlocked: readonly string[]): boolean {
  if (!unlocked.includes(chap.hero)) return false;
  const node = chap.nodes[index];
  const before = chap.nodes.slice(0, index);
  if (node.optional) return index === 0 || cleared.includes(chap.nodes[index - 1].id) || before.filter((n) => !n.optional).every((n) => cleared.includes(n.id));
  return before.filter((n) => !n.optional).every((n) => cleared.includes(n.id));
}

export const isFightNode = (n: StoryNode): n is FightNode => n.kind !== 'lesson';

export const STORY_NODE_COUNT = STORY.reduce((t, c) => t + requiredNodes(c).length, 0);
