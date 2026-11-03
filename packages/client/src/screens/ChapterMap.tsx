import { chapterId, CharacterDef, StoryChapter, StoryNode } from '@magepop/core';
import { Portrait } from '../components/Hud';

/**
 * A story chapter drawn as a map of the Academy grounds (or what lies beneath them): stages sit on
 * the map, joined by an inked trail. Required stages are joined by solid lines; optional challenges
 * branch off on dashed lines. The chapter's mage stands on the stage you're up to.
 */

/** Stage positions in percent of the map (x across, y down). Missing chapters fall back to an auto layout. */
const MAP_LAYOUTS: Record<string, Record<string, [number, number]>> = {
  // Spring on the Academy grounds: gate → arena → Heartstone Hall → dorms → arena → fountain.
  ember: {
    'ember-first-spark': [21, 73],
    'ember-trial': [42, 60],
    'ember-wild-magic': [63, 25],
    'ember-hold-the-line': [88, 25],
    'ember-first-echo': [55, 46],
    'ember-glass-cannon': [67, 60],
    'ember-boss': [81, 57],
  },
  // Deep winter: fountain plaza → arena → frosted greenhouse → pine grove (frozen pond on the side).
  rime: {
    'rime-cold-equation': [87, 46],
    'rime-mirror': [79, 60],
    'rime-thaw': [50, 50],
    'rime-echo-hunt': [15, 52],
    'rime-frostbitten': [27, 22],
    'rime-boss': [8, 22],
  },
  // The blight spreads from the grove: heart-tree → grove edge → gray avenue → library tower.
  briar: {
    'briar-deep-roots': [17, 47],
    'briar-sapling': [30, 53],
    'briar-blight': [43, 67],
    'briar-ashes': [26, 30],
    'briar-withered': [40, 39],
    'briar-boss': [8, 22],
  },
  // Night: library → graveyard → stairs → catacomb door, then across the grounds to the dorms.
  nyx: {
    'nyx-venom-and-burst': [10, 24],
    'nyx-the-hunt': [15, 38],
    'nyx-hex-trial': [22, 51],
    'nyx-turned-curse': [13, 62],
    'nyx-quick-venom': [42, 74],
    'nyx-boss': [91, 68],
  },
  // The storm: dorms → observatory → hedge garden → arena, and down into the crack.
  volt: {
    'volt-overcharge': [90, 27],
    'volt-ambush': [9, 22],
    'volt-drained': [24, 42],
    'volt-recharge': [45, 54],
    'volt-nightmare-echo': [82, 57],
    'volt-boss': [66, 37],
  },
  // Beneath the Academy: down the stairs → the gray garden → the Heartstone (rematch on a far ledge).
  finale: {
    'finale-fracture': [26, 42],
    'finale-gray-garden': [13, 64],
    'finale-boss': [78, 60],
    'finale-colorless': [72, 28],
  },
};

/** Art per chapter in public/assets/maps/<chapterId>.jpg; a location scene stands in until it exists. */
const FALLBACK_SCENE: Record<string, string> = {
  ember: 'gate',
  rime: 'fountain',
  briar: 'greenhouse',
  nyx: 'library',
  volt: 'observatory',
  finale: 'gray-garden',
};

export const NODE_ICON: Record<StoryNode['kind'], string> = { lesson: '📖', fight: '⚔️', survival: '⏳', boss: '👑', gauntlet: '🔥' };

type Pt = [number, number];

/** A gentle S-curve across the map for chapters without a hand-placed layout. */
function autoLayout(chap: StoryChapter): Record<string, Pt> {
  const req = chap.nodes.filter((n) => !n.optional);
  const out: Record<string, Pt> = {};
  req.forEach((n, i) => {
    const t = req.length === 1 ? 0.5 : i / (req.length - 1);
    out[n.id] = [10 + t * 80, 60 + Math.sin(t * Math.PI * 2) * 22];
  });
  chap.nodes.forEach((n, i) => {
    if (!n.optional) return;
    const prev = chap.nodes[i - 1];
    const p = (prev && out[prev.id]) ?? [50, 50];
    out[n.id] = [p[0] + 6, p[1] > 50 ? p[1] - 30 : p[1] + 28];
  });
  return out;
}

/** Quadratic curve between two points, bowed slightly so the trail looks hand-drawn. */
function trail(a: Pt, b: Pt, bow: number) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * bow;
  const cy = my + (dx / len) * bow;
  return `M ${a[0]} ${a[1]} Q ${cx} ${cy} ${b[0]} ${b[1]}`;
}

export interface MapNodeState {
  cleared: boolean;
  open: boolean;
  next: boolean;
  stars: number;
}

export function ChapterMap({
  chap,
  hero,
  selected,
  stateOf,
  onSelect,
}: {
  chap: StoryChapter;
  hero: CharacterDef;
  selected: string;
  stateOf: (n: StoryNode, i: number) => MapNodeState;
  onSelect: (id: string) => void;
}) {
  const id = chapterId(chap);
  const pos = { ...autoLayout(chap), ...(MAP_LAYOUTS[id] ?? {}) };
  const states = chap.nodes.map((n, i) => stateOf(n, i));

  // Segments: each required stage to the next required one; each optional off the stage before it.
  const segs: { a: StoryNode; b: StoryNode; dashed: boolean; lit: boolean; reachable: boolean }[] = [];
  let prevReq: number | null = null;
  chap.nodes.forEach((n, i) => {
    if (n.optional) {
      const from = chap.nodes[i - 1];
      if (from) segs.push({ a: from, b: n, dashed: true, lit: states[i].cleared, reachable: states[i].open });
      return;
    }
    if (prevReq !== null) segs.push({ a: chap.nodes[prevReq], b: n, dashed: false, lit: states[i].cleared, reachable: states[i].open });
    prevReq = i;
  });

  // The mage stands on the next stage to play, or the last one cleared.
  const standIdx = Math.max(
    states.findIndex((s) => s.next),
    states.findIndex((s) => s.open && !s.cleared),
  );
  const lastCleared = states.map((s, i) => (s.cleared && !chap.nodes[i].optional ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
  const stand = chap.nodes[standIdx >= 0 ? standIdx : Math.max(0, lastCleared)];

  return (
    <div className="chapter-map" style={{ '--accent': hero.palette.primary } as React.CSSProperties}>
      <img
        className="cm-art"
        src={`assets/maps/${id}.jpg`}
        alt=""
        draggable={false}
        onError={(e) => {
          const fb = `assets/scenes/${FALLBACK_SCENE[id] ?? 'gate'}.jpg`;
          if (!e.currentTarget.src.endsWith(fb)) e.currentTarget.src = fb;
        }}
      />
      <div className="cm-vignette" />
      <svg className="cm-trails" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {segs.map((s, k) => {
          const d = trail(pos[s.a.id], pos[s.b.id], k % 2 ? 4 : -4);
          const cls = `cm-trail ${s.dashed ? 'dashed' : ''} ${s.lit ? 'lit' : s.reachable ? 'reachable' : 'dim'}`;
          return (
            <g key={k} className={cls}>
              <path d={d} className="cm-trail-under" vectorEffect="non-scaling-stroke" />
              <path d={d} className="cm-trail-ink" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
      {chap.nodes.map((n, i) => {
        const st = states[i];
        const [x, y] = pos[n.id];
        return (
          <button
            key={n.id}
            className={`cm-node k-${n.kind} ${n.optional ? 'optional' : ''} ${st.cleared ? 'cleared' : ''} ${st.open ? '' : 'locked'} ${st.next ? 'next' : ''} ${n.id === selected ? 'sel' : ''}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => onSelect(n.id)}
            title={n.title}
          >
            <span className="cm-medal">{st.open ? NODE_ICON[n.kind] : '🔒'}</span>
            <span className="cm-label">{n.optional ? 'Challenge' : n.title.replace(/^(Lesson|Boss|Challenge): /, '')}</span>
            {st.cleared && (
              <span className="cm-stars">
                {[0, 1, 2].map((k) => (
                  <i key={k} className={k < st.stars ? 'on' : ''}>
                    ★
                  </i>
                ))}
              </span>
            )}
          </button>
        );
      })}
      {stand && (
        <div className="cm-hero" style={{ left: `${pos[stand.id][0]}%`, top: `${pos[stand.id][1]}%` }} aria-hidden="true">
          <Portrait ch={hero} size={44} />
        </div>
      )}
    </div>
  );
}
