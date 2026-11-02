import { getCharacter, GemColor, PlayerIndex, Pos, validMoves } from '@magepop/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BoardView } from '../components/BoardView';
import { CalloutStage, PlayerPanel, SpellLegend } from '../components/Hud';
import { SpellFxLayer } from '../components/SpellFx';
import { ChatBubble, ChatMenu, useQuickChat } from '../components/QuickChat';
import { HowToPlay } from '../components/HowToPlay';
import { BattleController, BattleResult, BattleSetup } from '../game/BattleController';
import { NetBattleController, pvp } from '../game/pvp';
import type { Settings } from '../game/save';
import { themedBoardSrc } from '../game/themes';
import { audio } from '../game/audio';
import { viewport } from '../game/platform';

function useCellSize() {
  const calc = () => {
    const { w, h } = viewport();
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

/** Online only: round-trip time to the server (the battle screen re-renders every frame). */
function PingBadge() {
  const ms = pvp.rtt;
  if (pvp.status === 'reconnecting') return <span className="ping bad">● offline</span>;
  if (ms === null) return <span className="ping">● … ms</span>;
  const cls = ms < 90 ? 'good' : ms < 170 ? 'ok' : 'bad';
  return (
    <span className={`ping ${cls}`} title="Round trip to the game server">
      ● {Math.round(ms)} ms
    </span>
  );
}
/** Show a suggested swap after this long without moving. */
const HINT_AFTER_MS = 8000;

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
  firstBattle,
  onGuideSeen,
  makeController,
  opponentTag,
  cosmetics,
  backdrop,
  onEnd,
  onQuit,
}: {
  setup: BattleSetup;
  header: string;
  spotlight?: GemColor[];
  settings: Settings;
  /** Show the How to Play guide before the countdown. */
  firstBattle?: boolean;
  onGuideSeen?: () => void;
  /** Supply a different controller (online matches). Default: a local battle vs a bot. */
  makeController?: (onEnd: (r: BattleResult) => void) => BattleController;
  /** Label on the opponent's panel (default: bot difficulty). */
  opponentTag?: string;
  /** Star reward cosmetics for your side: portrait frame and board background. */
  cosmetics?: { frame: string | null; board: string | null };
  /** Story: a location painted (dimmed) behind everything. */
  backdrop?: string;
  onEnd: (r: BattleResult) => void;
  /** Forfeit from the pause menu (counts as a loss). */
  onQuit: (r: BattleResult) => void;
}) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const ctrl = useMemo(
    () => (makeController ? makeController((r) => onEndRef.current(r)) : new BattleController(setup, (r) => onEndRef.current(r))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setup],
  );
  const online = ctrl instanceof NetBattleController;
  const chatOn = online && settings.quickChat;
  const chat = useQuickChat(chatOn);
  useEffect(() => () => (ctrl instanceof NetBattleController ? ctrl.dispose() : undefined), [ctrl]);
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(true);
  const [guide, setGuide] = useState<'first' | 'pause' | null>(firstBattle ? 'first' : null);
  // Idle hint: if you can move but haven't for a while, a valid swap starts to glow.
  const idleSince = useRef(0);
  const hint = useRef<{ a: Pos; b: Pos } | null>(null);
  const cells = useCellSize();
  const rootRef = useRef<HTMLDivElement>(null);
  const myBoard = useRef<HTMLDivElement>(null);
  const foeBoard = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dev-only hook for automated play-testing.
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__tp = { ctrl, validMoves };
    ctrl.paused = true;
    let raf = 0;
    const loop = (t: number) => {
      ctrl.update(t);
      setFrame((f) => (f + 1) % 1e9);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ctrl]);

  // "Ready… Pop!" countdown, held back until the first-time guide is closed.
  const guideOpenAtStart = guide === 'first';
  useEffect(() => {
    if (guideOpenAtStart) return;
    audio.play('ready');
    const t = setTimeout(() => {
      setCountdown(false);
      ctrl.paused = false;
    }, ctrl.countdownMs ?? COUNTDOWN_MS);
    return () => clearTimeout(t);
  }, [ctrl, guideOpenAtStart]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !countdown && !guide) {
        setPaused((p) => {
          ctrl.paused = !p;
          return !p;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctrl, countdown, guide]);

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
  if (!canAct) {
    idleSince.current = ctrl.now;
    hint.current = null;
  } else if (settings.battleHints && !hint.current && ctrl.now - idleSince.current > HINT_AFTER_MS) {
    hint.current = validMoves(s, 0)[0] ?? null;
  }

  return (
    <div className={`battle-screen ${backdrop ? 'has-backdrop' : ''}`} ref={rootRef}>
      {backdrop && <div className="battle-backdrop" style={{ backgroundImage: `url(assets/scenes/${backdrop}.jpg)` }} />}
      <div className="battle-top">
        <div className="battle-header">
          {header}
          {online && <PingBadge />}
          {s.rules?.surviveMs !== undefined && !s.over && (
            <span className="survive-timer">Survive {Math.max(0, Math.ceil((s.rules.surviveMs - s.time) / 1000))}s</span>
          )}
        </div>
        <div className="battle-hint">{settings.battleHints ? `Drag or click gems to swap · Esc for ${online ? 'menu' : 'pause'}${chatOn ? ' · 1-8 chat' : ''}` : ''}</div>
        <button
          className="btn small ghost"
          onClick={() => {
            ctrl.paused = true;
            setPaused(true);
          }}
        >
          {online ? 'Menu' : 'Pause'}
        </button>
      </div>
      {online && ctrl.reconnecting && <div className="net-banner">Connection lost. Reconnecting…</div>}
      {online && !ctrl.reconnecting && ctrl.opponentGraceUntil !== null && (
        <div className="net-banner soft">
          {ctrl.opponent.name} disconnected. They have {Math.max(0, Math.ceil((ctrl.opponentGraceUntil - performance.now()) / 1000))}s to come back.
        </div>
      )}
      <div className="arena">
        <div className="arena-side me">
          <PlayerPanel
            {...me}
            fx={[]}
            time={s.time}
            side={0}
            tag="YOU"
            frame={cosmetics?.frame}
            ally={s.ally && s.rules?.protect ? { name: s.rules.protect.name, hp: s.ally.hp, maxHp: s.ally.maxHp } : undefined}
          />
          {chatOn && (
            <>
              <ChatBubble line={chat.mine} side="me" now={performance.now()} />
              <ChatMenu onPick={chat.send} />
            </>
          )}
          <div ref={myBoard} className={`board-wrap themed ${canAct ? 'ready' : ''}`} style={boardStyle(cosmetics?.board ?? me.ch.id, me.ch.palette.primary)}>
            <BoardView
              theme={me.ch.id}
              frame={ctrl.display[0].frame}
              engineTime={s.time}
              cell={cells.big}
              interactive={canAct}
              onMove={(a, b) => {
                idleSince.current = ctrl.now;
                hint.current = null;
                ctrl.humanMove(a, b);
              }}
              hint={hint.current}
              stunned={me.stunned}
              label="Your board"
            />
          </div>
          <SpellLegend ch={me.ch} spotlight={spotlight} />
        </div>
        <div className="vs">VS</div>
        <div className={`arena-side foe ${setup.echo ? 'echo' : ''}`}>
          <PlayerPanel {...foe} time={s.time} side={1} tag={(opponentTag ?? setup.aiLevel.name).toUpperCase()} mysteryName={setup.mysteryName} />
          {chatOn && <ChatBubble line={chat.theirs} side="them" now={performance.now()} />}
          {ctrl.bark && ctrl.now - ctrl.bark.at < 3200 && (
            <div key={ctrl.bark.at} className="chat-bubble them bark">
              {ctrl.bark.text}
            </div>
          )}
          <div ref={foeBoard} className="board-wrap themed" style={boardStyle(foe.ch.id, foe.ch.palette.primary)}>
            <BoardView theme={foe.ch.id} frame={ctrl.display[1].frame} engineTime={s.time} cell={cells.small} interactive={false} stunned={foe.stunned} label="Opponent board" />
          </div>
          <SpellLegend ch={foe.ch} compact />
          {/* Your spell callouts play out here, in the open space, so your own board stays clear. */}
          <CalloutStage ref={stageRef} fx={me.fx} />
        </div>
      </div>

      {ctrl.banner && ctrl.now - ctrl.banner.at < 2200 && (
        <div key={ctrl.banner.at} className="pulse-banner">
          {ctrl.banner.text}
        </div>
      )}
      <SpellFxLayer vfx={settings.spellEffects ? ctrl.vfx : []} now={ctrl.now} boards={[myBoard, foeBoard]} root={rootRef} stage={stageRef} />

      {guide && (
        <HowToPlay
          theme={me.ch.id}
          onClose={() => {
            if (guide === 'first') onGuideSeen?.();
            setGuide(null);
          }}
        />
      )}
      {countdown && !guide && (
        <div className="overlay countdown">
          <div className="count-text">Ready… Pop!</div>
        </div>
      )}
      {paused && (
        <div className="overlay">
          <div className="modal">
            <h2>{online ? 'Menu' : 'Paused'}</h2>
            {online && <p className="muted">The match is still going!</p>}
            <button
              className="btn"
              onClick={() => {
                ctrl.paused = false;
                setPaused(false);
              }}
            >
              {online ? 'Back to the fight' : 'Resume'}
            </button>
            {chatOn && (
              <button className="btn ghost" onClick={chat.toggleMute}>
                {chat.muted ? 'Unmute opponent chat' : 'Mute opponent chat'}
              </button>
            )}
            <button className="btn ghost" onClick={() => setGuide('pause')}>
              How to play
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                if (ctrl instanceof NetBattleController) ctrl.forfeit();
                onQuit(ctrl.snapshot());
              }}
            >
              Forfeit &amp; quit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
