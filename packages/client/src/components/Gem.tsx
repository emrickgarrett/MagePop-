import { CellKind } from '@magepop/core';
import { memo, useSyncExternalStore } from 'react';
import { onThemesChanged, themedGemSrc, themesVersion } from '../game/themes';

/** Each color also has its own silhouette so the board reads without relying on color. */
const SHAPES: Record<CellKind, string> = {
  // heart
  ruby: 'M50 88 C20 66 8 50 8 33 C8 19 19 9 32 9 C40 9 46 13 50 20 C54 13 60 9 68 9 C81 9 92 19 92 33 C92 50 80 66 50 88 Z',
  // droplet
  sapphire: 'M50 6 C62 26 82 44 82 62 C82 80 68 93 50 93 C32 93 18 80 18 62 C18 44 38 26 50 6 Z',
  // octagon
  emerald: 'M32 8 H68 L92 32 V68 L68 92 H32 L8 68 V32 Z',
  // star
  topaz: 'M50 5 L61 36 L94 37 L68 57 L77 90 L50 71 L23 90 L32 57 L6 37 L39 36 Z',
  // diamond
  amethyst: 'M50 4 L88 50 L50 96 L12 50 Z',
  // rock
  stone: 'M22 26 L44 10 L72 16 L90 40 L84 72 L60 90 L30 86 L10 62 L12 40 Z',
};

const FACETS: Partial<Record<CellKind, string>> = {
  emerald: 'M32 8 L40 30 H60 L68 8 M92 32 L70 40 V60 L92 68 M68 92 L60 70 H40 L32 92 M8 68 L30 60 V40 L8 32',
  amethyst: 'M12 50 H88 M50 4 L36 50 L50 96 L64 50 Z',
  topaz: 'M50 5 L50 71 M6 37 L68 57 M94 37 L32 57',
};

/**
 * A gem. With `theme` (a champion id) it shows that champion's themed icon when the art
 * exists, and falls back to the built-in vector gem otherwise. Stone is always shared.
 */
export const Gem = memo(function Gem({ kind, size = 100, theme }: { kind: CellKind; size?: number; theme?: string }) {
  useSyncExternalStore(onThemesChanged, themesVersion);
  const src = themedGemSrc(theme, kind);
  if (src) {
    return <img src={src} width={size} height={size} className={`gem-img gem-${kind}`} alt={kind} draggable={false} decoding="async" />;
  }
  const id = `g-${kind}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`gem-svg gem-${kind}`} aria-label={kind}>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="22%" stopColor={`var(--gem-${kind}-light)`} />
          <stop offset="70%" stopColor={`var(--gem-${kind})`} />
          <stop offset="100%" stopColor={`var(--gem-${kind}-dark)`} />
        </radialGradient>
      </defs>
      <path d={SHAPES[kind]} fill={`url(#${id})`} stroke={`var(--gem-${kind}-dark)`} strokeWidth="4" strokeLinejoin="round" />
      {FACETS[kind] && <path d={FACETS[kind]} fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="2.5" strokeLinejoin="round" />}
      {kind !== 'stone' && <ellipse cx="36" cy="30" rx="12" ry="7" fill="#fff" opacity="0.55" transform="rotate(-30 36 30)" />}
      {kind === 'stone' && <path d="M30 40 L48 46 L44 62 M60 30 L66 50 L80 54" stroke="#0004" strokeWidth="3" fill="none" />}
    </svg>
  );
});
