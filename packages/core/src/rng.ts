/** mulberry32 — tiny, fast, deterministic, state fits in one uint32. */
export function nextRandom(state: number): [value: number, nextState: number] {
  let t = (state + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Object wrapper that mutates a holder's `rng` field. */
export interface RngHolder {
  rng: number;
}

export function rand(holder: RngHolder): number {
  const [v, s] = nextRandom(holder.rng);
  holder.rng = s;
  return v;
}

export function randInt(holder: RngHolder, maxExclusive: number): number {
  return Math.floor(rand(holder) * maxExclusive);
}

export function shuffleInPlace<T>(holder: RngHolder, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(holder, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= 0x9e3779b9;
  }
  return h >>> 0;
}
