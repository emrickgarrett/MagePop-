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

/**
 * How each mage's magic looks. Effects a mage causes (hits, stuns, heals, shields, buffs) use the
 * caster's colors, particles and stun style. A mage missing from this table falls back to their
 * palette with sparks and lightning, so new mages work before they're themed.
 */
type Particle = 'ember' | 'flake' | 'leaf' | 'wisp' | 'spark';
type StunStyle = 'flames' | 'frost' | 'vines' | 'hex' | 'lightning';
interface MageFx {
  main: string;
  light: string;
  particle: Particle;
  stun: StunStyle;
}

export const MAGE_FX: Record<string, MageFx> = {
  ember: { main: '#ff6a2b', light: '#ffd08a', particle: 'ember', stun: 'flames' },
  rime: { main: '#7fd4ff', light: '#e6f8ff', particle: 'flake', stun: 'frost' },
  briar: { main: '#4cd97b', light: '#d8ffb8', particle: 'leaf', stun: 'vines' },
  nyx: { main: '#b26bff', light: '#ff9be6', particle: 'wisp', stun: 'hex' },
  volt: { main: '#ffe45c', light: '#c9f4ff', particle: 'spark', stun: 'lightning' },
  hollow: { main: '#b8b4d0', light: '#f1eefc', particle: 'wisp', stun: 'hex' },
};

function mageFx(theme: string | undefined, fallback: string): MageFx {
  if (theme && MAGE_FX[theme]) return MAGE_FX[theme];
  let main = fallback;
  let light = '#ffffff';
  try {
    if (theme) ({ primary: main, secondary: light } = getCharacter(theme).palette);
  } catch {
    /* unknown id */
  }
  return { main, light, particle: 'spark', stun: 'lightning' };
}

const PARTICLE: Record<Particle, { cls: string; glyph?: string; size: [number, number]; spin?: boolean }> = {
  ember: { cls: 'fx-ember', size: [4, 9] },
  flake: { cls: 'fx-glyph frost', glyph: '❄', size: [11, 20], spin: true },
  leaf: { cls: 'fx-leaf', size: [9, 15], spin: true },
  wisp: { cls: 'fx-wisp', size: [8, 16] },
  spark: { cls: 'fx-glyph sparkle', glyph: '✦', size: [9, 16] },
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Fade in over the first `a` of the effect, out over the last `b`. */
const envelope = (t: number, a = 0.15, b = 0.35) => clamp01(Math.min(t / a, (1 - t) / b));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function SpellFxLayer({
  vfx,
  now,
  boards,
  root,
  stage,
}: {
  vfx: Vfx[];
  now: number;
  boards: [RefObject<HTMLDivElement | null>, RefObject<HTMLDivElement | null>];
  root: RefObject<HTMLDivElement | null>;
  /** Where your own ultimate banner plays (the open area on the right), so it never covers your board. */
  stage?: RefObject<HTMLDivElement | null>;
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
  const t0 = (v: Vfx) => clamp01((now - v.born) / v.duration);
  const stageCasts = vfx.filter((v) => v.side === 0 && (v.kind === 'cast' || v.kind === 'ultimate'));
  const stageTop = stageCasts.filter((v) => v.kind === 'ultimate').pop() ?? stageCasts.pop();
  const stageRect = (() => {
    const el = stage?.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.height > 60 ? { x: r.left - base.left, y: r.top - base.top, w: r.width, h: Math.min(r.height, 280) } : null;
  })();

  return (
    <div className="spellfx-layer">
      {vfx.map((v) => {
        const target = rects[v.side];
        if (v.kind === 'cast' || (v.kind === 'ultimate' && v.side === 0 && stageRect)) {
          // Your casts take turns on the stage: show only the newest (an ultimate beats a regular cast).
          if (v !== stageTop) return null;
          return stageRect ? <StageBanner key={v.id} v={v} t={t0(v)} r={stageRect} /> : null;
        }
        if (!target) return null;
        const t = clamp01((now - v.born) / v.duration);
        if (v.kind === 'projectile') {
          const from = rects[v.from ?? 0];
          return from ? <Projectile key={v.id} v={v} t={t} from={from} to={target} /> : null;
        }
        if (v.kind === 'impact') return <Impact key={v.id} v={v} t={t} r={target} />;
        if (v.kind === 'ultimate') {
          // Yours plays full size on the callout stage; theirs over their board.
          const area = v.side === 0 && stageRect ? stageRect : target;
          return <UltimateBanner key={v.id} v={v} t={t} r={area} onStage={area === stageRect} />;
        }
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

function Impact({ v: raw, t, r }: { v: Vfx; t: number; r: Rect }) {
  const v = { ...raw, color: mageFx(raw.theme, raw.color).main };
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

function BoardAura({ v: raw, t, r }: { v: Vfx; t: number; r: Rect }) {
  const fx = mageFx(raw.theme, raw.color);
  // Hazards keep their own look (ice is ice); everything else wears the caster's colors.
  const themed = !['poison', 'burn', 'freeze', 'shatter', 'petrify'].includes(raw.kind);
  const v = themed ? { ...raw, color: raw.kind === 'cleanse' ? fx.light : fx.main } : raw;
  const env = envelope(t);
  const rnd = rand(v.id * 104729);
  const parts: ReactNode[] = [];
  let tint: CSSProperties = {};

  /** Particles drifting up (dy<0) or down (dy>0) across the board. */
  let driftCalls = 0;
  const drift = (count: number, opts: { dy: number; size: [number, number]; cls: string; glyph?: string; spin?: boolean; color?: string }) => {
    const call = driftCalls++; // keys stay unique when one effect drifts several particle kinds
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
          key={`d${call}-${i}`}
          className={opts.cls}
          style={{
            left: x + wob,
            top: y,
            width: s,
            height: s,
            fontSize: s,
            opacity: Math.sin(u * Math.PI),
            transform: opts.spin ? `rotate(${u * 360 + i * 47}deg)` : undefined,
            '--c': opts.color ?? v.color,
          } as CSSProperties}
        >
          {opts.glyph}
        </div>,
      );
    }
  };

  /** The caster's signature particles. */
  const motes = (count: number, dy: number) => drift(count, { dy, ...PARTICLE[fx.particle] });

  switch (v.kind) {
    case 'heal':
      tint = { boxShadow: `inset 0 0 ${60 + 60 * v.power}px ${v.color}`, opacity: env * 0.9 };
      drift(10 + Math.round(8 * v.power), { dy: -0.9, size: [12, 22], cls: 'fx-glyph heal', glyph: '+', color: fx.light });
      motes(12, -0.75);
      break;
    case 'cleanse':
      tint = { background: `radial-gradient(circle, ${v.color}55, transparent 70%)`, opacity: env };
      motes(16, -0.8);
      break;
    case 'shield': {
      const sweep = -40 + t * 180;
      tint = {
        boxShadow: `inset 0 0 0 ${3 + 3 * v.power}px ${v.color}, inset 0 0 ${50 + 40 * v.power}px ${v.color}aa`,
        background: `linear-gradient(115deg, transparent ${sweep - 12}%, ${v.color}55 ${sweep}%, transparent ${sweep + 12}%), radial-gradient(ellipse at center, transparent 55%, ${v.color}33)`,
        opacity: env,
      };
      parts.push(<div key="hex" className="fx-hex" style={{ opacity: env * 0.35, '--c': v.color } as CSSProperties} />);
      motes(8, -0.5);
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
      motes(16, -1.0);
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
    case 'stun':
      tint = stunStyle(fx, v, t, r, env, parts, motes);
      break;
  }

  return (
    <div className="fx-aura" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
      <div className="fx-tint" style={tint} />
      {parts}
    </div>
  );
}

// ---- stuns: each mage has their own -------------------------------------------------

function stunStyle(
  fx: MageFx,
  v: Vfx,
  t: number,
  r: Rect,
  env: number,
  parts: ReactNode[],
  motes: (count: number, dy: number) => void,
): CSSProperties {
  const grow = easeOut(clamp01(t / 0.3));
  const rnd = rand(v.id * 9173);
  const c = fx.main;
  switch (fx.stun) {
    case 'frost': {
      // Icicles grow in from the top and bottom edges while the board frosts over.
      const n = 9;
      for (let i = 0; i < n * 2; i++) {
        const top = i < n;
        const x = ((i % n) + 0.5 + (rnd() - 0.5) * 0.6) * (r.w / n);
        const len = (0.12 + rnd() * 0.16) * r.h * grow;
        const w = 12 + rnd() * 12;
        parts.push(
          <div
            key={`ic${i}`}
            className={`fx-icicle ${top ? 'top' : 'bottom'}`}
            style={{ left: x - w / 2, [top ? 'top' : 'bottom']: 0, width: w, height: len, opacity: env } as CSSProperties}
          />,
        );
      }
      motes(10, 0.6);
      return { boxShadow: `inset 0 0 ${50 + 50 * grow}px ${16 * grow}px ${fx.light}aa`, background: `${c}22`, opacity: env };
    }
    case 'vines': {
      // Vines creep across from the corners, sprouting leaves.
      const paths = [];
      for (let i = 0; i < 4; i++) {
        const sx = i % 2 ? r.w : 0;
        const sy = i < 2 ? 0 : r.h;
        const ex = r.w * (0.3 + rnd() * 0.4);
        const ey = r.h * (0.3 + rnd() * 0.4);
        const c1x = r.w * rnd();
        const c1y = r.h * rnd();
        const c2x = r.w * rnd();
        const c2y = r.h * rnd();
        paths.push(
          <path
            key={i}
            d={`M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - grow}
          />,
        );
        for (let k = 1; k <= 4; k++) {
          const u = k / 5;
          if (u > grow) continue;
          // Point on the cubic.
          const m = 1 - u;
          const px = m ** 3 * sx + 3 * m * m * u * c1x + 3 * m * u * u * c2x + u ** 3 * ex;
          const py = m ** 3 * sy + 3 * m * m * u * c1y + 3 * m * u * u * c2y + u ** 3 * ey;
          const sz = 12 + rnd() * 8;
          parts.push(
            <div
              key={`lf${i}-${k}`}
              className="fx-leaf"
              style={{ left: px - sz / 2, top: py - sz / 2, width: sz, height: sz, opacity: env, transform: `rotate(${rnd() * 360}deg)`, '--c': fx.light } as CSSProperties}
            />,
          );
        }
      }
      parts.push(
        <svg key="vines" className="fx-vines" width={r.w} height={r.h} style={{ opacity: env, '--c': c } as CSSProperties}>
          {paths}
        </svg>,
      );
      return { background: `radial-gradient(ellipse at center, transparent 45%, ${c}33)`, opacity: env };
    }
    case 'hex': {
      // A hex circle spins up over the board, trailing dark wisps.
      const R = Math.min(r.w, r.h) * 0.36 * (0.6 + 0.4 * grow);
      const star = (rot: number) =>
        [0, 1, 2].map((k) => {
          const a = rot + (k * 2 * Math.PI) / 3 - Math.PI / 2;
          return `${r.w / 2 + Math.cos(a) * R},${r.h / 2 + Math.sin(a) * R}`;
        });
      parts.push(
        <svg
          key="hex"
          className="fx-sigil"
          width={r.w}
          height={r.h}
          style={{ opacity: env, transform: `rotate(${t * 140}deg)`, '--c': c } as CSSProperties}
        >
          <circle cx={r.w / 2} cy={r.h / 2} r={R * 1.12} />
          <circle cx={r.w / 2} cy={r.h / 2} r={R * 1.22} strokeDasharray="4 8" />
          <polygon points={star(0).join(' ')} />
          <polygon points={star(Math.PI).join(' ')} />
        </svg>,
      );
      motes(14, -0.7);
      return { background: `radial-gradient(circle, ${c}33, rgba(10, 0, 25, 0.45) 75%)`, opacity: env };
    }
    case 'flames': {
      // Dizzy ring of fireballs circling the board, flames licking up from below.
      const n = 8;
      const R = Math.min(r.w, r.h) * 0.32 * (0.7 + 0.3 * grow);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + t * 6;
        const sz = (34 + 8 * Math.sin(t * 22 + i)) * (r.w / 600 + 0.5);
        parts.push(
          <div
            key={`fl${i}`}
            className="fx-orb"
            style={{
              left: r.w / 2 + Math.cos(a) * R - sz / 2,
              top: r.h / 2 + Math.sin(a) * R * 0.5 - sz / 2,
              width: sz,
              height: sz,
              opacity: env,
              '--c': c,
            } as CSSProperties}
          />,
        );
      }
      for (let i = 0; i < 12; i++) {
        // Flame tongues along the bottom edge.
        const w = r.w / 10;
        const h = r.h * (0.12 + 0.1 * Math.abs(Math.sin(t * 18 + i * 1.7))) * grow;
        parts.push(
          <div
            key={`tg${i}`}
            className="fx-flame"
            style={{ left: (i / 12) * r.w - w * 0.1, bottom: 0, width: w, height: h, opacity: env, '--c': c } as CSSProperties}
          />,
        );
      }
      motes(26, -1.0);
      return {
        background: `linear-gradient(to top, ${c}aa, ${c}33 45%, transparent 70%)`,
        boxShadow: `inset 0 0 60px ${c}aa`,
        opacity: env * (0.8 + 0.2 * Math.sin(t * 45)),
      };
    }
    case 'lightning':
    default: {
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
        <svg key="bolts" className="fx-bolts" width={r.w} height={r.h} style={{ opacity: env, '--c': c } as CSSProperties}>
          {bolts}
        </svg>,
      );
      return { background: `${c}22`, boxShadow: `inset 0 0 50px ${c}88`, opacity: env };
    }
  }
}

// ---- your casts on the callout stage ---------------------------------------------------

/**
 * The big portrait banner for your own casts, played in the open area to the right so it never
 * covers your board. Ultimates get the full treatment (bigger, longer, color burst and rays).
 */
function StageBanner({ v, t, r }: { v: Vfx; t: number; r: Rect }) {
  const ch = v.theme ? getCharacter(v.theme) : null;
  const ult = v.kind === 'ultimate';
  const fx = mageFx(v.theme, v.color);
  const inT = ult ? 0.14 : 0.18;
  const outT = ult ? 0.82 : 0.78;
  // Band sweeps in from the left, holds, then flies off to the right.
  const x = t < inT ? -1 + easeOut(t / inT) : t > outT ? easeOut((t - outT) / (1 - outT)) : 0;
  const pop = t < inT ? easeOut(t / inT) : t > outT ? 1 - (t - outT) / (1 - outT) : 1;
  const bandH = r.h * (ult ? 0.5 : 0.4);
  const face = Math.min(r.h * (ult ? 0.9 : 0.74), r.w * 0.42);
  const nameSize = Math.max(22, Math.min(ult ? 60 : 44, r.w * (ult ? 0.1 : 0.075)));
  // Keep the whole portrait inside the stage (it sits at the bottom edge of the window).
  const cy = Math.min(r.h * 0.6, r.h - face / 2 - 6);
  return (
    <div className="fx-stage" style={{ left: r.x, top: r.y, width: r.w, height: r.h, '--c': fx.main, '--l': fx.light } as CSSProperties}>
      {ult && (
        <div
          className="fx-stage-rays"
          style={{ left: r.w * 0.28 - r.h, top: cy - r.h, width: r.h * 2, height: r.h * 2, opacity: pop * 0.8, transform: `rotate(${t * 90}deg) scale(${0.6 + 0.4 * pop})` }}
        />
      )}
      <div
        className="fx-stage-burst"
        style={{ left: r.w * 0.28 - face, top: cy - face, width: face * 2, height: face * 2, opacity: pop * (ult ? 0.9 : 0.6) }}
      />
      <div className="fx-stage-band" style={{ top: cy - bandH / 2, height: bandH, transform: `translateX(${x * 110}%) skewY(-6deg)` }} />
      {ch && (
        <img
          className="fx-stage-face"
          src={`assets/portraits/${ch.id}.png`}
          alt=""
          onError={(e) => (e.currentTarget.style.display = 'none')}
          style={{
            left: r.w * 0.28 - face / 2 + x * r.w * 0.6,
            top: cy - face / 2,
            width: face,
            height: face,
            transform: `scale(${0.7 + 0.3 * pop})`,
            opacity: clamp01(pop * 1.4),
          }}
        />
      )}
      <div
        className="fx-stage-text"
        style={{ left: r.w * 0.28 + face / 2 + 12 + x * r.w * 0.8, top: cy - bandH / 2, height: bandH, opacity: clamp01(pop * 1.4) }}
      >
        <small style={{ fontSize: Math.max(10, nameSize * 0.3) }}>{ult ? 'ULTIMATE' : 'SPELL'}</small>
        <span style={{ fontSize: nameSize }}>{v.label}</span>
      </div>
    </div>
  );
}

// ---- ultimate banner ---------------------------------------------------------------

function UltimateBanner({ v, t, r, onStage = false }: { v: Vfx; t: number; r: Rect; onStage?: boolean }) {
  const ch = v.theme ? getCharacter(v.theme) : null;
  // Slide in fast, hold, slide out.
  const x = t < 0.18 ? -1 + easeOut(t / 0.18) : t > 0.8 ? easeOut((t - 0.8) / 0.2) : 0;
  if (v.side === 0 && !onStage) {
    // Fallback when there's no stage (very short windows): a compact strip just under your board, so it never covers the gems you're playing.
    const w = Math.min(r.w * 0.78, 420);
    const h = 54;
    const pop = t < 0.15 ? easeOut(t / 0.15) : t > 0.82 ? 1 - easeOut((t - 0.82) / 0.18) : 1;
    return (
      <div
        className="fx-ult-strip"
        style={{
          left: r.x + (r.w - w) / 2,
          top: r.y + r.h + 4,
          width: w,
          height: h,
          opacity: pop,
          transform: `translateY(${(1 - pop) * -14}px) scale(${0.9 + 0.1 * pop})`,
          '--c': v.color,
        } as CSSProperties}
      >
        {ch && <img src={`assets/portraits/${ch.id}.png`} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
        <div className="fx-ult-text">
          <small>ULTIMATE</small>
          <span>{v.label}</span>
        </div>
      </div>
    );
  }
  const flash = clamp01(1 - t / 0.25);
  return (
    <div className="fx-aura" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
      {!onStage && <div className="fx-tint" style={{ background: v.color, opacity: flash * 0.45 }} />}
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
