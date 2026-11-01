import { getCharacter, GemColor, PlayerIndex, validMoves } from '@magepop/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BoardView } from '../components/BoardView';
import { PlayerPanel, SpellLegend } from '../components/Hud';
import { BattleController, BattleResult, BattleSetup } from '../game/BattleController';
import type { Settings } from '../game/save';
import { themedBoardSrc } from '../game/themes';
import { audio } from '../game/audio';

function useCellSize() {
  const calc = () => {
    const h = window.innerHeight;
    const w = window.innerWidth;
    const big = Math.max(40, Math.min(76, Math.floor((h - 290) / 8), Math.floor((w * 0.5) / 8)));
    return { big, small: Math.max(28, Math.floor(big * 0.62)) };
  };
  const [size, setSize] = useState(calc);
  useEffect(() => {
    const on = () => setSize(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

const COUNTDOWN_MS = 1600;

/** Board frame tinted with the champion's color, over their themed background when it exists. */
function boardStyle(theme: string, accent: string): React.CSSProperties {
  const bg = themedBoardSrc(theme);
  return {
    '--accent': accent,
    backgroundImage: bg ? `linear-gradient(rgba(8, 3, 20, 0.18), rgba(8, 3, 20, 0.18)), url(${bg})` : undefined,
  } as React.CSSProperties;
}

export function BattleScreen({
  setup,
  header,
  spotlight,
  settings,
  onEnd,
  onQuit,
}: {
  setup: BattleSetup;
  header: string;
  spotlight?: GemColor[];
  settings: Settings;
  onEnd: (r: BattleResult) => void;
  onQuit: () => void;
}) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const ctrl = useMemo(() => new BattleController(setup, (r) => onEndRef.current(r)), [setup]);
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(true);
  const cells = useCellSize();

  useEffect(() => {
    // Dev-only hook for automated play-testing.
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__tp = { ctrl, validMoves };
    ctrl.paused = true;
    audio.play('ready');
    const t = setTimeout(() => {
      setCountdown(false);
      ctrl.paused = false;
    }, COUNTDOWN_MS);
    let raf = 0;
    const loop = (t: number) => {
      ctrl.update(t);
      setFrame((f) => (f + 1) % 1e9);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [ctrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !countdown) {
        setPaused((p) => {
          ctrl.paused = !p;
          return !p;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctrl, countdown]);

  const s = ctrl.state;
  const side = (p: PlayerIndex) => {
    const pl = s.players[p];
    const ch = getCharacter(pl.characterId);
    const flash = ctrl.flash[p];
    return {
      ch,
      pl,
      vitals: ctrl.shownVitals(p),
      fx: settings.combatText ? ctrl.fx.filter((f) => f.side === p) : [],
      shakeAge: settings.screenShake ? ctrl.now - ctrl.shake[p] : Infinity,
      flash: flash ? { color: flash.color, age: ctrl.now - flash.at } : null,
      stunned: pl.stunnedUntil > s.time,
    };
  };
  const me = side(0);
  const foe = side(1);
  const canAct = ctrl.canAct(0);

  return (
    <div className="battle-screen">
      <div className="battle-top">
        <div className="battle-header">{header}</div>
        <div className="battle-hint">{settings.battleHints ? 'Drag or click gems to swap · Esc to pause' : ''}</div>
        <button
          className="btn small ghost"
          onClick={() => {
            ctrl.paused = true;
            setPaused(true);
          }}
        >
          Pause
        </button>
      </div>
      <div className="arena">
        <div className="arena-side me">
          <PlayerPanel {...me} time={s.time} side={0} tag="YOU" />
          <div className={`board-wrap themed ${canAct ? 'ready' : ''}`} style={boardStyle(me.ch.id, me.ch.palette.primary)}>
            <BoardView
              theme={me.ch.id}
              frame={ctrl.display[0].frame}
              engineTime={s.time}
              cell={cells.big}
              interactive={canAct}
              onMove={(a, b) => ctrl.humanMove(a, b)}
              stunned={me.stunned}
              label="Your board"
            />
          </div>
          <SpellLegend ch={me.ch} spotlight={spotlight} />
        </div>
        <div className="vs">VS</div>
        <div className="arena-side foe">
          <PlayerPanel {...foe} time={s.time} side={1} tag={setup.aiLevel.name.toUpperCase()} />
          <div className="board-wrap themed" style={boardStyle(foe.ch.id, foe.ch.palette.primary)}>
            <BoardView theme={foe.ch.id} frame={ctrl.display[1].frame} engineTime={s.time} cell={cells.small} interactive={false} stunned={foe.stunned} label="Opponent board" />
          </div>
          <SpellLegend ch={foe.ch} compact />
        </div>
      </div>

      {countdown && (
        <div className="overlay countdown">
          <div className="count-text">Ready… Pop!</div>
        </div>
      )}
      {paused && (
        <div className="overlay">
          <div className="modal">
            <h2>Paused</h2>
            <button
              className="btn"
              onClick={() => {
                ctrl.paused = false;
                setPaused(false);
              }}
            >
              Resume
            </button>
            <button className="btn ghost" onClick={onQuit}>
              Forfeit &amp; quit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
