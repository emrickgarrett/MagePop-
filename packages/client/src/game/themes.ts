import { CHARACTERS, CellKind, GEM_COLORS, GemColor, STORY_ONLY_CHARACTERS } from '@magepop/core';

/**
 * Per-champion art: themed gem icons and a board background.
 *
 * Files live in public/assets (gems/<championId>/<color>.png, boards/<championId>.jpg).
 * Anything missing falls back to the built-in SVG gems / plain board, so a new champion
 * works before its art exists. Regenerate with tools/process_art.py.
 */
export const gemImagePath = (theme: string, color: GemColor) => `assets/gems/${theme}/${color}.png`;
export const boardImagePath = (theme: string) => `assets/boards/${theme}.jpg`;

/** null = still loading, true/false = loaded / missing. */
const available = new Map<string, boolean | null>();
const listeners = new Set<() => void>();
let version = 0;
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};
/** Changes whenever an image finishes loading (for useSyncExternalStore). */
export const themesVersion = () => version;

function probe(src: string) {
  if (available.has(src)) return;
  available.set(src, null);
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    available.set(src, true);
    notify();
  };
  img.onerror = () => {
    available.set(src, false);
    notify();
  };
  img.src = src;
}

/** Start loading every champion's art up front so battles never flash fallback gems. */
export function preloadThemes() {
  for (const c of [...CHARACTERS, ...STORY_ONLY_CHARACTERS]) {
    for (const color of GEM_COLORS) probe(gemImagePath(c.id, color));
    probe(boardImagePath(c.id));
  }
}

export function onThemesChanged(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function themedGemSrc(theme: string | undefined, kind: CellKind): string | null {
  if (!theme || kind === 'stone') return null;
  const src = gemImagePath(theme, kind);
  probe(src);
  return available.get(src) ? src : null;
}

export function themedBoardSrc(theme: string | undefined): string | null {
  if (!theme) return null;
  const src = boardImagePath(theme);
  probe(src);
  return available.get(src) ? src : null;
}
