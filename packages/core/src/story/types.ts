import { BattleRules, GemColor } from '../types';

export interface DialogueLine {
  speaker: string; // character id or 'narrator'
  text: string;
  /** Gem to show while the guide explains a spell. */
  gem?: GemColor;
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
  /** The mage you play as. */
  hero: string;
  title: string;
  nodes: StoryNode[];
  /** Mage recruited by finishing the chapter. */
  unlocks: string | null;
}
