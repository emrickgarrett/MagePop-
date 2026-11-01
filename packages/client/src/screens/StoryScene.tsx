import { CHARACTER_BY_ID, DialogueLine, Expression, getCharacter } from '@magepop/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Gem } from '../components/Gem';

/**
 * Visual-novel scene: a location background, up to two mages on stage (the hero on the left),
 * expressions per line, typewriter text, auto-play and a backlog.
 */

const SCENE_SRC = (id: string) => `assets/scenes/${id}.jpg`;
const MAIN_PORTRAIT = (id: string) => `assets/portraits/${id}.png`;

function portraitSrc(id: string, expr: Expression | undefined, revealed?: boolean) {
  if (expr && expr !== 'neutral') return `assets/portraits/expr/${id}-${expr}.webp`;
  if (revealed) return `assets/portraits/expr/${id}-revealed.webp`;
  return MAIN_PORTRAIT(id);
}

/**
 * Which way each portrait looks ('front' = straight at the camera). Actors are mirrored so they
 * face the middle of the stage: the left one looks right, the right one looks left.
 * Key: '<mage>' for the default, '<mage>-<expression>' to override one picture.
 */
const FACING: Record<string, 'left' | 'right' | 'front'> = {
  ember: 'right',
  rime: 'left',
  briar: 'left',
  nyx: 'left',
  volt: 'front',
  'volt-sad': 'right',
  'volt-surprised': 'right',
  hollow: 'left',
};

function facingOf(id: string, expr: Expression | undefined) {
  return FACING[`${id}-${expr ?? 'neutral'}`] ?? FACING[id] ?? 'front';
}

interface Actor {
  id: string;
  src: string;
  /** Mirror the picture so the mage faces the center. */
  flip: boolean;
  echo: boolean;
  /** Changes when the actor first enters, so the slide-in plays once. */
  enteredAt: number;
}

interface Stage {
  bg: string | null;
  left: Actor | null;
  right: Actor | null;
  speakingSide: 'left' | 'right' | null;
}

const isMage = (id: string) => Object.prototype.hasOwnProperty.call(CHARACTER_BY_ID, id);

/** Replay the scene up to line `upTo` to know who is on stage and where. */
function stageAt(lines: DialogueLine[], upTo: number, hero: string): Stage {
  const st: Stage = { bg: null, left: null, right: null, speakingSide: null };
  for (let i = 0; i <= upTo && i < lines.length; i++) {
    const l = lines[i];
    if (l.bg) st.bg = l.bg;
    st.speakingSide = null;
    const id = l.speaker === 'hero' ? hero : l.speaker;
    if (!isMage(id) || l.offstage) continue;
    const side = l.side ?? (id === hero ? 'left' : 'right');
    const other = side === 'left' ? 'right' : 'left';
    if (st[other]?.id === id) st[other] = null;
    const prev = st[side];
    const facing = facingOf(id, l.expr);
    st[side] = {
      id,
      src: portraitSrc(id, l.expr, l.revealed),
      flip: facing === side,
      echo: !!l.echo,
      enteredAt: prev?.id === id ? prev.enteredAt : i,
    };
    st.speakingSide = side;
  }
  return st;
}

function textOf(l: DialogueLine, hero: string) {
  return l.speaker === 'hero' ? (l.heroText?.[hero] ?? l.text) : l.text;
}

function nameOf(l: DialogueLine, hero: string): string | null {
  if (l.name) return l.name;
  if (l.speaker === 'narrator') return null;
  if (l.speaker === 'guide') return 'Guide';
  const id = l.speaker === 'hero' ? hero : l.speaker;
  return isMage(id) ? getCharacter(id).name : null;
}

const CHAR_MS = 22;

export function StoryScene({ lines, hero, title, onDone }: { lines: DialogueLine[]; hero: string; title?: string; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const [auto, setAuto] = useState(false);
  const [log, setLog] = useState(false);
  const line = lines[i];
  const text = textOf(line, hero);
  const done = shown >= text.length;
  const stage = useMemo(() => stageAt(lines, i, hero), [lines, i, hero]);
  const speakerId = line.speaker === 'hero' ? hero : line.speaker;
  const ch = isMage(speakerId) ? getCharacter(speakerId) : null;
  const name = nameOf(line, hero);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };
  const advance = () => {
    if (!done) return setShown(text.length);
    if (i + 1 >= lines.length) return finish();
    setI(i + 1);
    setShown(0);
  };

  // Preload this scene's art so backgrounds and faces don't pop in.
  useEffect(() => {
    const urls = new Set<string>();
    for (let k = 0; k < lines.length; k++) {
      const l = lines[k];
      if (l.bg) urls.add(SCENE_SRC(l.bg));
      const id = l.speaker === 'hero' ? hero : l.speaker;
      if (isMage(id)) urls.add(portraitSrc(id, l.expr, l.revealed));
    }
    urls.forEach((u) => {
      const img = new Image();
      img.src = u;
    });
  }, [lines, hero]);

  // Typewriter.
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setShown((s) => Math.min(text.length, s + 1)), CHAR_MS);
    return () => clearTimeout(t);
  }, [shown, done, text.length]);

  // Auto mode: wait a reading pause after the line finishes.
  useEffect(() => {
    if (!auto || !done || log) return;
    const t = setTimeout(advance, 1100 + text.length * 32);
    return () => clearTimeout(t);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (log) {
        if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') setLog(false);
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        advance();
      } else if (e.key === 'a' || e.key === 'A') setAuto((v) => !v);
      else if (e.key === 'l' || e.key === 'L') setLog(true);
      else if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const isGuide = line.speaker === 'guide';
  const isNarrator = line.speaker === 'narrator';
  const accent = ch?.palette.primary ?? (isGuide ? '#ffd45c' : '#9fd8ff');

  const actor = (a: Actor | null, side: 'left' | 'right') =>
    a && (
      <div
        key={`${side}-${a.id}-${a.enteredAt}`}
        className={`vn-actor ${side} ${stage.speakingSide === side ? 'speaking' : stage.speakingSide ? 'listening' : 'idle'} ${a.echo ? 'echo' : ''}`}
      >
        <img
          key={a.src}
          className={a.flip ? 'flip' : ''}
          src={a.src}
          alt=""
          draggable={false}
          onError={(e) => {
            const fallback = MAIN_PORTRAIT(a.id);
            if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback;
          }}
        />
      </div>
    );

  return (
    <div className="screen vn-screen" onClick={() => !log && advance()}>
      <div className="vn-bg" key={stage.bg ?? 'none'} style={stage.bg ? { backgroundImage: `url(${SCENE_SRC(stage.bg)})` } : undefined} />
      <div className={`vn-stage ${line.fx === 'shake' ? 'fx-shake' : ''} ${line.fx === 'flicker' ? 'fx-flicker' : ''}`} key={`stage-${i}`}>
        {actor(stage.left, 'left')}
        {actor(stage.right, 'right')}
      </div>
      {line.fx === 'flash' && <div className="vn-flash" key={`flash-${i}`} />}
      {title && <div className="vn-title">{title}</div>}

      <div
        className={`vn-box ${isGuide ? 'guide' : ''} ${isNarrator ? 'narrator' : ''}`}
        style={{ '--accent': accent } as React.CSSProperties}
        onClick={(e) => {
          e.stopPropagation();
          if (!log) advance();
        }}
      >
        {name && <div className="vn-name">{name}</div>}
        <div className="vn-body">
          {isGuide && line.gem && (
            <div className="vn-gem">
              <Gem kind={line.gem} size={64} theme={hero} />
            </div>
          )}
          <p>
            {text.slice(0, shown)}
            <span className="vn-hidden">{text.slice(shown)}</span>
          </p>
        </div>
        <div className="vn-controls" onClick={(e) => e.stopPropagation()}>
          <span className="muted">
            {i + 1}/{lines.length}
            {done && <span className="vn-next"> ▼</span>}
          </span>
          <button className={`btn small ghost ${auto ? 'on' : ''}`} onClick={() => setAuto((v) => !v)} title="Auto-play (A)">
            {auto ? '⏸ Auto' : '▶ Auto'}
          </button>
          <button className="btn small ghost" onClick={() => setLog(true)} title="Backlog (L)">
            Log
          </button>
          <button className="btn small ghost" onClick={finish} title="Skip scene (Esc)">
            Skip
          </button>
        </div>
      </div>

      {log && (
        <div className="vn-log" onClick={(e) => e.stopPropagation()}>
          <div className="vn-log-head">
            <b>Story so far</b>
            <button className="btn small ghost" onClick={() => setLog(false)}>
              Close
            </button>
          </div>
          <div className="vn-log-lines">
            {lines.slice(0, i + 1).map((l, k) => {
              const nm = nameOf(l, hero);
              const id = l.speaker === 'hero' ? hero : l.speaker;
              const col = isMage(id) ? getCharacter(id).palette.primary : l.speaker === 'guide' ? '#ffd45c' : undefined;
              return (
                <div key={k} className={`vn-log-line ${l.speaker === 'narrator' ? 'narrator' : ''}`}>
                  {nm && <b style={{ color: col }}>{nm}</b>}
                  <span>{textOf(l, hero)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
