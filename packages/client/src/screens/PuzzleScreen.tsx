import { aiLevel, getCharacter, PuzzleRun, PuzzleStage, Pos, puzzleGoalMet, puzzleMove, solvePuzzle, startPuzzle } from '@magepop/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BoardView } from '../components/BoardView';
import { SpellLegend } from '../components/Hud';
import { SpellFxLayer } from '../components/SpellFx';
import { audio } from '../game/audio';
import { viewport } from '../game/platform';
import { BattleController } from '../game/BattleController';
import type { Settings } from '../game/save';
import { themedBoardSrc } from '../game/themes';

/**
 * A lesson puzzle runs on the real engine but without an opponent: no clock, no bot, just your
 * board, a move limit and a goal.
 */
class PuzzleController extends BattleController {
  readonly run: PuzzleRun;

  constructor(
    readonly stage: PuzzleStage,
    hero: string,
  ) {
    const run = startPuzzle(stage, hero);
    super({ seed: 0, player: hero, opponent: hero, aiLevel: aiLevel(0) }, () => {}, run.state);
    this.run = run;
  }

  get movesLeft() {
    return this.stage.moves - this.run.movesUsed;
  }

  get solved() {
    return puzzleGoalMet(this.stage.goal, this.run);
  }

  /** No timers in puzzles: nothing to simulate between moves. */
  protected override simulate() {}

  override canAct(): boolean {
    return this.boardIdle(0) && this.movesLeft > 0 && !this.solved;
  }

  override humanMove(a: Pos, b: Pos) {
    if (!this.canAct()) return;
    this.handleEvents(puzzleMove(this.run, a, b));
  }

  /** First move of a solution from here (the solver tries every swap with the real engine). */
  hint(): { a: Pos; b: Pos } | null {
    const copy: PuzzleRun = { state: JSON.parse(JSON.stringify(this.run.state)), casts: [...this.run.casts], movesUsed: this.run.movesUsed };
    return solvePuzzle(this.stage, copy)?.[0] ?? null;
  }
}

export function PuzzleScreen({
  title,
  hero,
  stages,
  settings,
  board,
  onDone,
  onQuit,
}: {
  title: string;
  hero: string;
  stages: PuzzleStage[];
  settings: Settings;
  /** Board background theme (star reward pick, or the hero's own). */
  board?: string;
  /** Finished every stage. */
  onDone: (r: { hintsUsed: number }) => void;
  onQuit: () => void;
}) {
  const [stageIdx, setStageIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hint, setHint] = useState<{ a: Pos; b: Pos } | null>(null);
  const [, setFrame] = useState(0);
  const stage = stages[stageIdx];
  const ctrl = useMemo(() => new PuzzleController(stage, hero), [stage, hero, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const ch = getCharacter(hero);
  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const goalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      ctrl.update(t);
      setFrame((f) => (f + 1) % 1e9);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ctrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onQuit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onQuit]);

  const settled = ctrl.boardIdle(0) && ctrl.now > 0;
  const solved = settled && ctrl.solved;
  const failed = settled && !ctrl.solved && ctrl.movesLeft <= 0;
  const last = stageIdx === stages.length - 1;

  // Celebrate once per solved stage.
  const cheered = useRef<string | null>(null);
  useEffect(() => {
    const key = `${stageIdx}-${attempt}`;
    if (solved && cheered.current !== key) {
      cheered.current = key;
      audio.play('ready', { pitch: 1.3 });
    }
  }, [solved, stageIdx, attempt]);

  const retry = () => {
    setHint(null);
    setAttempt((a) => a + 1);
  };
  const next = () => {
    setHint(null);
    if (last) onDone({ hintsUsed });
    else {
      setStageIdx((i) => i + 1);
      setAttempt(0);
    }
  };
  const showHint = () => {
    const h = ctrl.hint();
    if (h) {
      setHint(h);
      setHintsUsed((n) => n + 1);
    }
  };

  const cell = Math.min(84, Math.floor((viewport().h - 330) / stage.layout.length));

  return (
    <div className="battle-screen puzzle-screen" ref={rootRef}>
      <div className="battle-top">
        <div className="battle-header">{title}</div>
        <div className="battle-hint">Esc to leave</div>
        <button className="btn small ghost" onClick={onQuit}>
          Leave
        </button>
      </div>
      <div className="puzzle-arena">
        <div className="puzzle-left">
          <div
            ref={boardRef}
            className={`board-wrap themed ${ctrl.canAct() ? 'ready' : ''}`}
            style={{ '--accent': ch.palette.primary, backgroundImage: themedBoardSrc(board ?? hero) ? `url(${themedBoardSrc(board ?? hero)})` : undefined } as React.CSSProperties}
          >
            <BoardView
              theme={hero}
              frame={ctrl.display[0].frame}
              engineTime={ctrl.state.time}
              cell={cell}
              interactive={ctrl.canAct()}
              onMove={(a, b) => {
                setHint(null);
                ctrl.humanMove(a, b);
              }}
              hint={hint}
              label="Puzzle board"
            />
          </div>
          <SpellLegend ch={ch} />
        </div>
        <div className="puzzle-goal" ref={goalRef} style={{ '--accent': ch.palette.primary } as React.CSSProperties}>
          <div className="puzzle-steps">
            {stages.map((_, i) => (
              <span key={i} className={`dot ${i < stageIdx ? 'done' : i === stageIdx ? 'on' : ''}`} />
            ))}
          </div>
          <small className="muted">
            Stage {stageIdx + 1} of {stages.length}
          </small>
          <p className="puzzle-text">{stage.text}</p>
          <div className={`moves-left ${ctrl.movesLeft <= 0 && !solved ? 'out' : ''}`}>
            <b>{Math.max(0, ctrl.movesLeft)}</b> {ctrl.movesLeft === 1 ? 'move' : 'moves'} left
          </div>
          {solved ? (
            <div className="puzzle-result good">
              <b>{last ? 'Lesson complete!' : 'Nice!'}</b>
              <button className="btn" onClick={next} autoFocus>
                {last ? 'Continue' : 'Next stage'}
              </button>
            </div>
          ) : failed ? (
            <div className="puzzle-result bad">
              <b>Out of moves.</b>
              <button className="btn" onClick={retry} autoFocus>
                Try again
              </button>
            </div>
          ) : (
            <div className="puzzle-tools">
              <button className="btn small ghost" onClick={showHint} disabled={!ctrl.canAct()}>
                Hint
              </button>
              <button className="btn small ghost" onClick={retry} disabled={ctrl.run.movesUsed === 0}>
                Restart
              </button>
            </div>
          )}
          {hintsUsed > 0 && <small className="muted">Hints used: {hintsUsed} (finish without hints for 3 stars)</small>}
        </div>
      </div>
      <SpellFxLayer vfx={settings.spellEffects ? ctrl.vfx : []} now={ctrl.now} boards={[boardRef, goalRef]} root={rootRef} />
    </div>
  );
}
