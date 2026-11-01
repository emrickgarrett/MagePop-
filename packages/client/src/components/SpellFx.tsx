import { getCharacter, PlayerIndex } from '@magepop/core';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { Vfx } from '../game/BattleController';
import { themedGemSrc } from '../game/themes';

/**
 * Spell visuals drawn over the arena: projectiles flying between boards, auras on a board
 * (heal, shield, poison, freeze...) and the ultimate banner. Everything is computed from the
 * battle clock each frame, so it pauses with the game. pointer-events: none throughout.
 */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Small deterministic random per effect, so particles don't jump around between frames. */
function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Fade in over the first `a` of the effect, out over the last `b`. */
const envelope = (t: number, a = 0.15, b = 0.35) => clamp01(Math.min(t / a, (1 - t) / b));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function SpellFxLayer({
  vfx,
  now,
  boards,
  root,
}: {
  vfx: Vfx[];
  now: number;
  boards: [RefObject<HTMLDivElement | null>, RefObject<HTMLDivElement | null>];
  root: RefObject<HTMLDivElement | null>;
}) {
  if (!vfx.length || !root.current) return <div className="spellfx-layer" />;
  const base = root.current.getBoundingClientRect();
  const rectOf = (p: PlayerIndex): Rect | null => {
    const el = boards[p].current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
  };
  const rects: [Rect | null, Rect | null] = [rectOf(0), rectOf(1)];

  return (
    <div className="spellfx-layer">
      {vfx.map((v) => {
        const target = rects[v.side];
        if (!target) return null;
        const t = clamp01((now - v.born) / v.duration);
        if (v.kind === 'projectile') {
          const from = rects[v.from ?? 0];
          return from ? <Projectile key={v.id} v={v} t={t} from={from} to={target} /> : null;
        }
        if (v.kind === 'impact') return <Impact key={v.id} v={v} t={t} r={target} />;
        if (v.kind === 'ultimate') return <UltimateBanner key={v.id} v={v} t={t} r={target} />;
        return <BoardAura key={v.id} v={v} t={t} r={target} />;
      })}
    </div>
  );
}

// ---- projectile -------------------------------------------------------------

function Projectile({ v, t, from, to }: { v: Vfx; t: number; from: Rect; to: Rect }) {
  const ax = from.x + from.w / 2;
  const ay = from.y + from.h / 2;
  const bx = to.x + to.w / 2;
  const by = to.y + to.h / 2;
  // Arc over the top of the screen between the two boards.
  const cx = (ax + bx) / 2;
  const cy = Math.min(ay, by) - Math.abs(bx - ax) * 0.35;
  const at = (u: number) => {
    const k = u * 0.55 + u * u * 0.45; // accelerate into the target
    const x = (1 - k) ** 2 * ax + 2 * (1 - k) * k * cx + k * k * bx;
    const y = (1 - k) ** 2 * ay + 2 * (1 - k) * k * cy + k * k * by;
    return { x, y };
  };
  const size = 34 + 34 * v.power;
  const head = at(t);
  const gem = v.theme && v.gem ? themedGemSrc(v.theme, v.gem) : null;
  const trail = [];
  for (let i = 1; i <= 7; i++) {
    const u = t - i * 0.045;
    if (u <= 0) break;
    const p = at(u);
    const s = size * (1 - i * 0.11);
    trail.push(
      <div
        key={i}
        className="fx-orb"
        style={{ left: p.x - s / 2, top: p.y - s / 2, width: s, height: s, opacity: 0.55 - i * 0.07, '--c': v.color } as CSSProperties}
      />,
    );
  }
  return (
    <>
      {trail}
      <div className="fx-orb head" style={{ left: head.x - size, top: head.y - size, width: size * 2, height: size * 2, '--c': v.color } as CSSProperties} />
      {gem && (
        <img
          className="fx-proj-gem"
          src={gem}
          alt=""
          style={{
            left: head.x - size * 0.42,
            top: head.y - size * 0.42,
            width: size * 0.84,
            height: size * 0.84,
            transform: `rotate(${t * 540}deg)`,
          }}
        />
      )}
    </>
  );
}

// ---- impact -------------------------------------------------------------------

function Impact({ v, t, r }: { v: Vfx; t: number; r: Rect }) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const R = Math.min(r.w, r.h) * (0.28 + 0.32 * v.power);
  const e = easeOut(t);
  const rnd = rand(v.id * 7919);
  const sparks = [];
  const n = 10 + Math.round(8 * v.power);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const dist = R * (0.5 + rnd() * 0.9) * e;
    const len = 10 + rnd() * 18 * (1 + v.power);
    sparks.push(
      <div
        key={i}
        className="fx-spark"
        style={{
          left: cx + Math.cos(ang) * dist,
          top: cy + Math.sin(ang) * dist,
          width: len,
          transform: `rotate(${ang}rad)`,
          opacity: 1 - t,
          '--c': v.color,
        } as CSSProperties}
      />,
    );
  }
  return (
    <>
      <div
        className="fx-flash"
        style={{ left: cx - R * 1.4, top: cy - R * 1.4, width: R * 2.8, height: R * 2.8, opacity: (1 - t) ** 2 * (0.6 + 0.4 * v.power), '--c': v.color } as CSSProperties}
      />
      <div
        className="fx-ring"
        style={{
          left: cx - R,
          top: cy - R,
          width: R * 2,
          height: R * 2,
          transform: `scale(${0.25 + e * 1.1})`,
          opacity: 1 - t,
          borderWidth: 3 + 6 * v.power * (1 - t),
          '--c': v.color,
        } as CSSProperties}
      />
      {sparks}
    </>
  );
}

// ---- board auras ----------------------------------------------------------------

function BoardAura({ v, t, r }: { v: Vfx; t: number; r: Rect }) {
  const env = envelope(t);
  const rnd = rand(v.id * 104729);
  const parts: ReactNode[] = [];
  let tint: CSSProperties = {};

  /** Particles drifting up (dy<0) or down (dy>0) across the board. */
  const drift = (count: number, opts: { dy: number; size: [number, number]; cls: string; glyph?: string; spin?: boolean }) => {
    for (let i = 0; i < count; i++) {
      const x = rnd() * r.w;
      const start = rnd() * 0.45; // staggered starts
      const speed = 0.7 + rnd() * 0.6;
      const u = clamp01((t - start) / (1 - start));
      if (u <= 0 || u >= 1) continue;
      const y0 = opts.dy < 0 ? r.h * (0.75 + rnd() * 0.3) : -10 - rnd() * r.h * 0.2;
      const y = y0 + opts.dy * r.h * u * speed;
      const s = opts.size[0] + rnd() * (opts.size[1] - opts.size[0]);
      const wob = Math.sin((u * 5 + i) * 2) * 8;
      parts.push(
        <div
          key={`d${i}`}
          className={opts.cls}
          style={{
            left: x + wob,
            top: y,
            width: s,
            height: s,
            fontSize: s,
            opacity: Math.sin(u * Math.PI),
            transform: opts.spin ? `rotate(${u * 360}deg)` : undefined,
            '--c': v.color,
          } as CSSProperties}
        >
          {opts.glyph}
        </div>,
      );
    }
  };

  switch (v.kind) {
    case 'heal':
      tint = { boxShadow: `inset 0 0 ${60 + 60 * v.power}px ${v.color}`, opacity: env * 0.9 };
      drift(14 + Math.round(10 * v.power), { dy: -0.9, size: [12, 22], cls: 'fx-glyph heal', glyph: '+' });
      drift(10, { dy: -0.7, size: [4, 9], cls: 'fx-dot' });
      break;
    case 'cleanse':
      tint = { background: `radial-gradient(circle, ${v.color}55, transparent 70%)`, opacity: env };
      drift(16, { dy: -0.8, size: [8, 16], cls: 'fx-glyph sparkle', glyph: '✦' });
      break;
    case 'shield': {
      const sweep = -40 + t * 180;
      tint = {
        boxShadow: `inset 0 0 0 ${3 + 3 * v.power}px ${v.color}, inset 0 0 ${50 + 40 * v.power}px ${v.color}aa`,
        background: `linear-gradient(115deg, transparent ${sweep - 12}%, ${v.color}55 ${sweep}%, transparent ${sweep + 12}%), radial-gradient(ellipse at center, transparent 55%, ${v.color}33)`,
        opacity: env,
      };
      parts.push(<div key="hex" className="fx-hex" style={{ opacity: env * 0.35, '--c': v.color } as CSSProperties} />);
      break;
    }
    case 'poison':
      tint = { background: `linear-gradient(to top, ${v.color}55, transparent 60%)`, opacity: env };
      drift(18, { dy: -0.85, size: [8, 20], cls: 'fx-bubble' });
      break;
    case 'burn':
      tint = { background: `linear-gradient(to top, ${v.color}77, transparent 55%)`, opacity: env * (0.8 + 0.2 * Math.sin(t * 40)) };
      drift(26, { dy: -1.0, size: [4, 9], cls: 'fx-ember' });
      break;
    case 'empower':
      tint = { background: `linear-gradient(to top, ${v.color}66, transparent 70%)`, boxShadow: `inset 0 0 60px ${v.color}`, opacity: env };
      drift(14, { dy: -1.0, size: [10, 18], cls: 'fx-glyph sparkle', glyph: '✦' });
      break;
    case 'freeze': {
      const e = easeOut(clamp01(t / 0.35));
      tint = {
        boxShadow: `inset 0 0 ${40 + 80 * e}px ${20 * e}px ${v.color}cc`,
        background: `radial-gradient(ellipse at center, transparent ${70 - 25 * e}%, ${v.color}55)`,
        opacity: clamp01((1 - t) / 0.4),
      };
      drift(12, { dy: 0.9, size: [12, 24], cls: 'fx-glyph frost', glyph: '❄', spin: true });
      break;
    }
    case 'petrify':
      tint = { background: `radial-gradient(ellipse at center, transparent 40%, ${v.color}66)`, opacity: env };
      drift(22, { dy: 0.8, size: [3, 7], cls: 'fx-dust' });
      break;
    case 'shatter': {
      tint = { background: `radial-gradient(circle, ${v.color}66, transparent 60%)`, opacity: (1 - t) ** 2 };
      const cx = r.w / 2;
      const cy = r.h / 2;
      for (let i = 0; i < 22; i++) {
        const ang = rnd() * Math.PI * 2;
        const dist = (0.15 + rnd() * 0.6) * r.w * easeOut(t);
        parts.push(
          <div
            key={`s${i}`}
            className="fx-shard"
            style={{
              left: cx + Math.cos(ang) * dist,
              top: cy + Math.sin(ang) * dist + t * t * 60,
              width: 6 + rnd() * 10,
              height: 14 + rnd() * 18,
              transform: `rotate(${ang + t * 6}rad)`,
              opacity: 1 - t,
            }}
          />,
        );
      }
      break;
    }
    case 'stun': {
      tint = { background: `${v.color}22`, boxShadow: `inset 0 0 50px ${v.color}88`, opacity: env };
      // Fresh zigzags every 70ms for a crackling look.
      const flick = rand(v.id * 31 + Math.floor((t * v.duration) / 70));
      const bolts = [];
      for (let b = 0; b < 3; b++) {
        if (flick() < 0.35) continue;
        let x = flick() * r.w;
        let pts = `${x},0`;
        for (let y = 0; y < r.h; y += r.h / 8) {
          x += (flick() - 0.5) * 60;
          pts += ` ${x},${y + r.h / 8}`;
        }
        bolts.push(<polyline key={b} points={pts} />);
      }
      parts.push(
        <svg key="bolts" className="fx-bolts" width={r.w} height={r.h} style={{ opacity: env, '--c': v.color } as CSSProperties}>
          {bolts}
        </svg>,
      );
      break;
    }
  }

  return (
    <div className="fx-aura" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
      <div className="fx-tint" style={tint} />
      {parts}
    </div>
  );
}

// ---- ultimate banner ---------------------------------------------------------------

function UltimateBanner({ v, t, r }: { v: Vfx; t: number; r: Rect }) {
  const ch = v.theme ? getCharacter(v.theme) : null;
  // Slide in fast, hold, slide out.
  const x = t < 0.18 ? -1 + easeOut(t / 0.18) : t > 0.8 ? easeOut((t - 0.8) / 0.2) : 0;
  const flash = clamp01(1 - t / 0.25);
  return (
    <div className="fx-aura" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
      <div className="fx-tint" style={{ background: v.color, opacity: flash * 0.45 }} />
      <div className="fx-ult-band" style={{ transform: `translateX(${x * 110}%) skewY(-6deg)`, '--c': v.color } as CSSProperties}>
        {ch && <img src={`assets/portraits/${ch.id}.png`} alt="" className="fx-ult-portrait" onError={(e) => (e.currentTarget.style.display = 'none')} />}
        <div className="fx-ult-text">
          <small style={{ fontSize: Math.max(9, r.w * 0.022) }}>ULTIMATE</small>
          <span style={{ fontSize: Math.max(16, Math.min(40, r.w * 0.065)) }}>{v.label}</span>
        </div>
      </div>
    </div>
  );
}
