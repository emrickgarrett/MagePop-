import { CHARACTERS, getCharacter } from './characters';
import { describeSpell } from './describe';
import { COLOR_LABEL, GemColor } from './types';

export interface DialogueLine {
  speaker: string; // character id or 'narrator'
  text: string;
  /** Gem to show while the guide explains a spell. */
  gem?: GemColor;
}

export interface StoryFight {
  id: string;
  title: string;
  opponent: string;
  aiLevel: number;
  /** Colors whose spells this fight teaches (highlighted in the HUD). */
  spotlight: GemColor[];
  intro: DialogueLine[];
  outro: DialogueLine[];
  boss?: boolean;
}

export interface StoryChapter {
  /** The character you play as in this chapter. */
  hero: string;
  title: string;
  fights: StoryFight[];
  /** Character unlocked by finishing the chapter. */
  unlocks: string | null;
}

function teach(heroId: string, color: GemColor): DialogueLine[] {
  const s = getCharacter(heroId).spells[color];
  return [
    {
      speaker: 'narrator',
      gem: color,
      text: `${COLOR_LABEL[color]} — match 4 to cast ${s.active.name}: ${describeSpell(s.active)}`,
    },
    {
      speaker: 'narrator',
      gem: color,
      text: `Match 5 or more (lines, L or T shapes) for the ultimate, ${s.ultimate.name}: ${describeSpell(s.ultimate)}`,
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

export function buildStory(): StoryChapter[] {
  const order = chapterOrder();
  return order.map((hero, ci) => {
    const flavor = FLAVOR[hero];
    const next = order[ci + 1] ?? null;
    const plan = spotlightPlan(hero);
    const regulars = order.filter((id) => id !== hero && id !== next);
    const bossId = next ?? order[0];
    const baseLevel = Math.min(ci, 3);
    const fights: StoryFight[] = [0, 1, 2].map((fi) => {
      const boss = fi === 2;
      const opponent = boss ? bossId : regulars[(ci + fi) % regulars.length];
      const [heroLine, foeLine, winLine] = flavor.lines[fi];
      const intro: DialogueLine[] = [
        ...(ci === 0 && fi === 0 ? BASICS : []),
        { speaker: hero, text: heroLine },
        ...plan[fi].flatMap((c) => teach(hero, c)),
        { speaker: opponent, text: foeLine },
      ];
      return {
        id: `${hero}-${fi + 1}`,
        title: boss ? `Boss: ${getCharacter(opponent).name}` : `Trial ${fi + 1}`,
        opponent,
        aiLevel: Math.min(5, baseLevel + (boss ? 1 : 0) + (ci === 4 && boss ? 1 : 0)),
        spotlight: plan[fi],
        intro,
        outro: [{ speaker: boss ? opponent : hero, text: winLine }],
        boss,
      };
    });
    return { hero, title: flavor.title, fights, unlocks: next };
  });
}

export const STORY: StoryChapter[] = buildStory();
