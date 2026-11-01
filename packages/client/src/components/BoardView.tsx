import { isAdjacent, Pos } from '@magepop/core';
import { CSSProperties, useRef, useState } from 'react';
import type { Frame } from '../game/BattleController';
import { Gem } from './Gem';

interface Props {
  frame: Frame;
  engineTime: number;
  cell: number;
  interactive: boolean;
  onMove?: (a: Pos, b: Pos) => void;
  stunned?: boolean;
  label?: string;
  /** Mage id whose gem set to draw. */
  theme?: string;
  /** A suggested swap to highlight (idle hint). */
  hint?: { a: Pos; b: Pos } | null;
}

export function BoardView({ frame, engineTime, cell, interactive, onMove, stunned, label, theme, hint }: Props) {
  const { board } = frame;
  const [selected, setSelected] = useState<Pos | null>(null);
  const drag = useRef<{ start: Pos; x: number; y: number; done: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const cellAt = (e: React.PointerEvent): Pos | null => {
    const rect = ref.current!.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / cell);
    const r = Math.floor((e.clientY - rect.top) / cell);
    if (r < 0 || c < 0 || r >= board.rows || c >= board.cols) return null;
    return { r, c };
  };

  const tryMove = (a: Pos, b: Pos) => {
    setSelected(null);
    onMove?.(a, b);
  };

  const onDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    const p = cellAt(e);
    if (!p) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { start: p, x: e.clientX, y: e.clientY, done: false };
  };

  const onMoveEvt = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.done || !interactive) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const th = cell * 0.35;
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    d.done = true;
    const to = Math.abs(dx) > Math.abs(dy) ? { r: d.start.r, c: d.start.c + Math.sign(dx) } : { r: d.start.r + Math.sign(dy), c: d.start.c };
    if (to.r >= 0 && to.c >= 0 && to.r < board.rows && to.c < board.cols) tryMove(d.start, to);
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.done || !interactive) return;
    const p = cellAt(e) ?? d.start;
    if (selected && isAdjacent(selected, p)) tryMove(selected, p);
    else if (selected && selected.r === p.r && selected.c === p.c) setSelected(null);
    else setSelected(p);
  };

  const style = {
    width: board.cols * cell,
    height: board.rows * cell,
    '--cell': `${cell}px`,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      className={`board ${interactive ? 'interactive' : ''} ${stunned ? 'stunned' : ''}`}
      style={style}
      onPointerDown={onDown}
      onPointerMove={onMoveEvt}
      onPointerUp={onUp}
      aria-label={label}
    >
      <div className="board-grid" />
      {board.cells.map((g, i) => {
        if (!g) return null;
        const r = Math.floor(i / board.cols);
        const c = i % board.cols;
        const fx = frame.marks.get(g.id);
        const drop = frame.drops.get(g.id);
        const frozen = g.frozenUntil > engineTime;
        const isSel = selected && selected.r === r && selected.c === c;
        const isHint = !!hint && ((hint.a.r === r && hint.a.c === c) || (hint.b.r === r && hint.b.c === c));
        const slotStyle: CSSProperties = {
          transform: `translate(${c * cell}px, ${r * cell}px)`,
          transition: frame.moveMs ? `transform ${frame.moveMs}ms cubic-bezier(.35,.1,.45,1.25)` : 'none',
          width: cell,
          height: cell,
        };
        const innerStyle = drop ? ({ '--drop': `${-drop * cell}px`, animationDuration: `${frame.durationMs}ms` } as CSSProperties) : undefined;
        return (
          <div key={g.id} className="gem-slot" style={slotStyle}>
            <div className={`gem-inner ${drop ? 'dropping' : ''} ${fx ? `fx-${fx}` : ''} ${isSel ? 'selected' : ''} ${isHint && !isSel ? 'hinted' : ''}`} style={innerStyle}>
              {g.hollowOf ? (
                <>
                  <span className="hollowed">
                    <Gem kind={g.hollowOf} size={cell * 0.86} theme={theme} />
                  </span>
                  <div className="hollow-ring" />
                </>
              ) : (
                <Gem kind={g.kind} size={cell * 0.86} theme={theme} />
              )}
              {frozen && <div className="ice" />}
            </div>
          </div>
        );
      })}
      {stunned && <div className="stun-overlay">STUNNED</div>}
    </div>
  );
}
