import { Board, Cell, CellKind, GEM_COLORS, GemColor, Gem, MatchGroup, Pos } from './types';
import { rand, randInt, shuffleInPlace } from './rng';

export const BOARD_ROWS = 8;
export const BOARD_COLS = 8;
export const MAX_STONES = 10;

export const idx = (b: Board, r: number, c: number) => r * b.cols + c;
export const inBounds = (b: Board, r: number, c: number) => r >= 0 && r < b.rows && c >= 0 && c < b.cols;
export const getCell = (b: Board, r: number, c: number): Cell => (inBounds(b, r, c) ? b.cells[idx(b, r, c)] : null);
export const setCell = (b: Board, r: number, c: number, cell: Cell) => {
  b.cells[idx(b, r, c)] = cell;
};

export function cloneBoard(b: Board): Board {
  return {
    rows: b.rows,
    cols: b.cols,
    nextId: b.nextId,
    rng: b.rng,
    cells: b.cells.map((g) => (g ? { ...g } : null)),
  };
}

export function isFrozen(g: Gem | null, now: number): boolean {
  return !!g && g.frozenUntil > now;
}

export function isSwappable(g: Gem | null, now: number): boolean {
  return !!g && g.kind !== 'stone' && !isFrozen(g, now);
}

export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function randomColor(b: Board): GemColor {
  return GEM_COLORS[randInt(b, GEM_COLORS.length)];
}

function newGem(b: Board, kind: CellKind): Gem {
  return { id: b.nextId++, kind, frozenUntil: 0 };
}

function wouldMatchAt(b: Board, r: number, c: number, color: GemColor): boolean {
  const k = (rr: number, cc: number) => getCell(b, rr, cc)?.kind;
  if (k(r, c - 1) === color && k(r, c - 2) === color) return true;
  if (k(r - 1, c) === color && k(r - 2, c) === color) return true;
  return false;
}

const LAYOUT_KINDS: Record<string, CellKind> = { r: 'ruby', b: 'sapphire', g: 'emerald', y: 'topaz', p: 'amethyst', s: 'stone' };

/**
 * A board from a fixed layout (story puzzles): one string per row, one letter per cell
 * (r b g y p = gem colors, s = stone; uppercase = frozen for `frozenMs`). Refills after the first
 * move still come from `seed`, so a puzzle's solution should only rely on the starting gems.
 */
export function boardFromLayout(layout: string[], seed: number, frozenMs = 10 * 60_000): Board {
  const rows = layout.length;
  const cols = layout[0]?.length ?? 0;
  if (!rows || !cols || layout.some((row) => row.length !== cols)) throw new Error('Puzzle layout rows must all be the same length');
  const b: Board = { rows, cols, cells: new Array(rows * cols).fill(null), nextId: 1, rng: seed >>> 0 };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = layout[r][c];
      const kind = LAYOUT_KINDS[ch.toLowerCase()];
      if (!kind) throw new Error(`Unknown puzzle cell '${ch}' at row ${r}, col ${c}`);
      const g = newGem(b, kind);
      if (ch !== ch.toLowerCase() && kind !== 'stone') g.frozenUntil = frozenMs;
      setCell(b, r, c, g);
    }
  }
  return b;
}

export function createBoard(seed: number, rows = BOARD_ROWS, cols = BOARD_COLS): Board {
  const b: Board = { rows, cols, cells: new Array(rows * cols).fill(null), nextId: 1, rng: seed >>> 0 };
  for (let attempt = 0; attempt < 50; attempt++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let color = randomColor(b);
        let guard = 0;
        while (wouldMatchAt(b, r, c, color) && guard++ < 20) color = randomColor(b);
        setCell(b, r, c, newGem(b, color));
      }
    }
    if (findValidMoves(b, 0).length > 0) return b;
  }
  return b;
}

/** Find all match groups. Runs of 3+ of the same color; runs sharing a cell merge into one group. */
export function findGroups(b: Board): MatchGroup[] {
  const runs: Pos[][] = [];
  const colorAt = (r: number, c: number): GemColor | null => {
    const g = getCell(b, r, c);
    return g && g.kind !== 'stone' ? (g.kind as GemColor) : null;
  };
  for (let r = 0; r < b.rows; r++) {
    let c = 0;
    while (c < b.cols) {
      const col = colorAt(r, c);
      let end = c + 1;
      while (col && end < b.cols && colorAt(r, end) === col) end++;
      if (col && end - c >= 3) runs.push(Array.from({ length: end - c }, (_, i) => ({ r, c: c + i })));
      c = end;
    }
  }
  for (let c = 0; c < b.cols; c++) {
    let r = 0;
    while (r < b.rows) {
      const col = colorAt(r, c);
      let end = r + 1;
      while (col && end < b.rows && colorAt(end, c) === col) end++;
      if (col && end - r >= 3) runs.push(Array.from({ length: end - r }, (_, i) => ({ r: r + i, c })));
      r = end;
    }
  }
  if (runs.length === 0) return [];

  // Union-find over runs that share a cell.
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map<number, number>();
  runs.forEach((run, i) => {
    for (const p of run) {
      const key = idx(b, p.r, p.c);
      const o = owner.get(key);
      if (o === undefined) owner.set(key, i);
      else parent[find(i)] = find(o);
    }
  });
  const groups = new Map<number, Map<number, Pos>>();
  runs.forEach((run, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, new Map());
    const g = groups.get(root)!;
    for (const p of run) g.set(idx(b, p.r, p.c), p);
  });
  return [...groups.values()].map((cells) => {
    const list = [...cells.values()];
    return { color: colorAt(list[0].r, list[0].c)!, cells: list };
  });
}

export function swapCells(b: Board, a: Pos, c: Pos): void {
  const ia = idx(b, a.r, a.c);
  const ic = idx(b, c.r, c.c);
  const t = b.cells[ia];
  b.cells[ia] = b.cells[ic];
  b.cells[ic] = t;
}

/** Drop gems down and refill from the top. */
export function applyGravityAndRefill(b: Board): void {
  for (let c = 0; c < b.cols; c++) {
    let write = b.rows - 1;
    for (let r = b.rows - 1; r >= 0; r--) {
      const g = getCell(b, r, c);
      if (g) {
        if (write !== r) {
          setCell(b, write, c, g);
          setCell(b, r, c, null);
        }
        write--;
      }
    }
    for (let r = write; r >= 0; r--) setCell(b, r, c, newGem(b, refillColor(b, r, c)));
  }
}

/**
 * Chance that a refilled gem avoids completing a match. Fully random refills cascade far too
 * often (3-4 chains per move on an 8x8 with 5 colors); this keeps cascades exciting but rare.
 */
export const REFILL_ANTI_MATCH = 0.85;

function refillColor(b: Board, r: number, c: number): GemColor {
  let color = randomColor(b);
  if (rand(b) >= REFILL_ANTI_MATCH) return color;
  for (let i = 0; i < 6 && completesRun(b, r, c, color); i++) color = randomColor(b);
  return color;
}

function completesRun(b: Board, r: number, c: number, color: GemColor): boolean {
  const same = (rr: number, cc: number) => getCell(b, rr, cc)?.kind === color;
  let h = 1;
  for (let x = c - 1; same(r, x); x--) h++;
  for (let x = c + 1; same(r, x); x++) h++;
  if (h >= 3) return true;
  let v = 1;
  for (let y = r - 1; same(y, c); y--) v++;
  for (let y = r + 1; same(y, c); y++) v++;
  return v >= 3;
}

export function findValidMoves(b: Board, now: number): { a: Pos; b: Pos }[] {
  const moves: { a: Pos; b: Pos }[] = [];
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      const a = { r, c };
      for (const d of [{ r, c: c + 1 }, { r: r + 1, c }]) {
        if (!inBounds(b, d.r, d.c)) continue;
        if (!isSwappable(getCell(b, a.r, a.c), now) || !isSwappable(getCell(b, d.r, d.c), now)) continue;
        if (getCell(b, a.r, a.c)!.kind === getCell(b, d.r, d.c)!.kind) continue;
        swapCells(b, a, d);
        const ok = createsMatchAt(b, a) || createsMatchAt(b, d);
        swapCells(b, a, d);
        if (ok) moves.push({ a, b: d });
      }
    }
  }
  return moves;
}

function createsMatchAt(b: Board, p: Pos): boolean {
  const g = getCell(b, p.r, p.c);
  if (!g || g.kind === 'stone') return false;
  const k = g.kind;
  const same = (r: number, c: number) => getCell(b, r, c)?.kind === k;
  let h = 1;
  for (let c = p.c - 1; same(p.r, c); c--) h++;
  for (let c = p.c + 1; same(p.r, c); c++) h++;
  if (h >= 3) return true;
  let v = 1;
  for (let r = p.r - 1; same(r, p.c); r--) v++;
  for (let r = p.r + 1; same(r, p.c); r++) v++;
  return v >= 3;
}

/** Reshuffle movable gems until the board has no matches and at least one move. */
export function shuffleBoard(b: Board, now: number): void {
  const slots: number[] = [];
  b.cells.forEach((g, i) => {
    if (isSwappable(g, now)) slots.push(i);
  });
  for (let attempt = 0; attempt < 200; attempt++) {
    const gems = slots.map((i) => b.cells[i]!);
    shuffleInPlace(b, gems);
    slots.forEach((i, k) => (b.cells[i] = gems[k]));
    if (findGroups(b).length === 0 && findValidMoves(b, now).length > 0) return;
  }
  // Fallback: recolor movable gems, and clear stones if the board is choked.
  for (let attempt = 0; attempt < 200; attempt++) {
    for (const i of slots) b.cells[i]!.kind = GEM_COLORS[randInt(b, GEM_COLORS.length)];
    if (attempt > 50)
      b.cells.forEach((g) => {
        if (!g || g.kind !== 'stone') return;
        g.kind = g.hollowOf ?? GEM_COLORS[randInt(b, 5)];
        delete g.hollowOf;
      });
    if (findGroups(b).length === 0 && findValidMoves(b, now).length > 0) return;
  }
}

/** Pick up to `count` random cells satisfying a predicate, using the board's RNG. */
export function pickRandomCells(b: Board, count: number, pred: (g: Gem) => boolean): Pos[] {
  const all: Pos[] = [];
  for (let r = 0; r < b.rows; r++)
    for (let c = 0; c < b.cols; c++) {
      const g = getCell(b, r, c);
      if (g && pred(g)) all.push({ r, c });
    }
  shuffleInPlace(b, all);
  return all.slice(0, Math.max(0, count));
}

export function countStones(b: Board): number {
  return b.cells.reduce((n, g) => n + (g?.kind === 'stone' ? 1 : 0), 0);
}

export function neighbors(b: Board, p: Pos): Pos[] {
  return [
    { r: p.r - 1, c: p.c },
    { r: p.r + 1, c: p.c },
    { r: p.r, c: p.c - 1 },
    { r: p.r, c: p.c + 1 },
  ].filter((q) => inBounds(b, q.r, q.c));
}

export { rand };
