import { BattleRules, GemColor } from '../types';

/** A mage's face for a line (each has a portrait per expression; neutral is their main portrait). */
export type Expression = 'neutral' | 'happy' | 'angry' | 'surprised' | 'sad';
export const EXPRESSIONS: readonly Expression[] = ['neutral', 'happy', 'angry', 'surprised', 'sad'];

/** Location backgrounds for story scenes (assets/scenes/<id>.jpg). */
export const SCENE_LOCATIONS = [
  'gate',
  'arena',
  'heartstone-hall',
  'fountain',
  'greenhouse',
  'grove',
  'library',
  'catacombs',
  'dorm',
  'observatory',
  'stairway',
  'gray-garden',
  'heartstone',
] as const;
export type SceneLocation = (typeof SCENE_LOCATIONS)[number];

/**
 * One line of a visual-novel scene.
 * speaker: a mage id, 'narrator' (storybook voice), 'guide' (gameplay tip, gold box) or 'hero'
 * (the mage the player is using; for "pick any mage" chapters, see heroText).
 */
export interface DialogueLine {
  speaker: string;
  text: string;
  /** Gem to show with a guide tip. */
  gem?: GemColor;
  /** The speaker's face (default neutral). */
  expr?: Expression;
  /** Change the background from this line on. */
  bg?: SceneLocation;
  /** A staging beat when the line appears. */
  fx?: 'shake' | 'flash' | 'flicker';
  /** Stage side for the speaker (default: the hero on the left, everyone else on the right). */
  side?: 'left' | 'right';
  /** Shown as a gray, glitching Echo copy. */
  echo?: boolean;
  /** Portrait variant: the Hollow's hood-down face. */
  revealed?: boolean;
  /** Name plate override (e.g. '???' for a hidden identity). */
  name?: string;
  /** A voice from offstage: name plate only, nobody moves on stage. */
  offstage?: boolean;
  /** speaker 'hero': what each mage says (falls back to text). */
  heroText?: Record<string, string>;
}

/** What happened in a fight, for star goals. */
export interface FightSummary {
  won: boolean;
  durationMs: number;
  hpLeft: number;
  maxHp: number;
  lowestHp: number;
  spells: number;
  ultimates: number;
  healed: number;
  damageDealt: number;
}

/** A bonus star: short text for the UI and a check against the fight's result. */
export interface StarGoal {
  text: string;
  check: (r: FightSummary) => boolean;
}

interface NodeBase {
  id: string;
  title: string;
  intro: DialogueLine[];
  outro: DialogueLine[];
  /** Optional challenge: doesn't block the chapter. */
  optional?: boolean;
}

/** A battle: a plain duel, a survival round or a boss (with phases). */
export interface FightNode extends NodeBase {
  kind: 'fight' | 'survival' | 'boss';
  opponent: string;
  aiLevel: number;
  /** A gray "Echo" copy rather than the mage themself. */
  echo?: boolean;
  rules?: BattleRules;
  playerHp?: number;
  opponentHp?: number;
  /** Colors this fight teaches (highlighted in the spell list). */
  spotlight?: GemColor[];
  /** Two bonus stars (the first star is for winning). */
  goals: [StarGoal, StarGoal];
  /** Lines shown mid-fight: when a boss phase starts, and when a pulse fires. */
  barks?: { phase?: Record<number, { speaker: string; text: string }>; pulse?: string };
  /** One-line description of the twist, shown on the map. */
  twist?: string;
  /** Hide who this really is (a hooded figure): shown as `name` with a "?" portrait. */
  mystery?: { name: string };
}

/** One opponent in a gauntlet. */
export interface GauntletWave {
  opponent: string;
  aiLevel: number;
  echo?: boolean;
  opponentHp?: number;
  rules?: BattleRules;
}

/** Back-to-back opponents; your HP carries over between them. */
export interface GauntletNode extends NodeBase {
  kind: 'gauntlet';
  waves: GauntletWave[];
  /** HP restored between waves, as a percent of max (default 15). */
  healBetweenPct?: number;
  goals: [StarGoal, StarGoal];
  twist?: string;
  spotlight?: GemColor[];
}

/** A puzzle lesson (stages live in story/lessons.ts). */
export interface LessonNode extends NodeBase {
  kind: 'lesson';
  lesson: string;
}

export type StoryNode = FightNode | LessonNode | GauntletNode;

export interface StoryChapter {
  /** Unique key (defaults to the hero's id). */
  id?: string;
  /** The mage you play as (with `anyHero`, only the default pick). */
  hero: string;
  /** The player picks any unlocked mage for this chapter. */
  anyHero?: boolean;
  /** Hero id of a chapter that must be finished first (for chapters not tied to an unlock). */
  requires?: string;
  /** Mage shown on the chapter's tab instead of the hero (e.g. the villain). */
  cover?: string;
  title: string;
  nodes: StoryNode[];
  /** Mage recruited by finishing the chapter. */
  unlocks: string | null;
}
