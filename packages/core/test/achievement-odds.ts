/**
 * How often do games hit achievement thresholds? A Master-speed player vs a bot of the given level.
 *   npx tsx test/achievement-odds.ts <foeLevel 0-5> <games>
 * Use it when tuning numbers in packages/client/src/game/achievements.ts.
 */
import { AI_LEVELS, applyMove, CHARACTERS, chooseMove, createBattle, thinkDelay, tick } from '../src';
const level = AI_LEVELS[4];
const foeLevel = AI_LEVELS[Number(process.argv[2] ?? 4)];
const N = Number(process.argv[3] ?? 300);
const ids = CHARACTERS.map((c) => c.id);
const c: Record<string, number> = {};
const inc = (k: string, ok: boolean) => (c[k] = (c[k] ?? 0) + (ok ? 1 : 0));
const combo: number[] = [];
const over: number[] = [];
for (let g = 0; g < N; g++) {
  const a = ids[g % 5], b = ids[(g * 3 + 1) % 5];
  const s = createBattle({ seed: 5000 + g, characters: [a, b] });
  const rng = [{ rng: g * 7 + 1 }, { rng: g * 13 + 5 }];
  const lv = [level, foeLevel];
  const next = [thinkDelay(level, rng[0]), thinkDelay(foeLevel, rng[1])];
  let low = 250, iceStun = false;
  while (!s.over && s.time < 600000) {
    tick(s, 50);
    const p0 = s.players[0];
    low = Math.min(low, p0.hp);
    if (p0.stunnedUntil > s.time && p0.board.cells.some((x) => x && x.frozenUntil > s.time)) iceStun = true;
    for (const p of [0, 1] as const) {
      const pl = s.players[p];
      if (s.time >= next[p] && s.time >= pl.busyUntil && s.time >= pl.stunnedUntil) {
        const m = chooseMove(s, p, lv[p], rng[p]);
        if (m) applyMove(s, p, m.a, m.b);
        next[p] = Math.max(s.time, pl.busyUntil) + thinkDelay(lv[p], rng[p]);
      }
    }
  }
  const me = s.players[0].stats, won = s.winner === 0;
  combo.push(me.biggestCombo);
  if (won) over.push(me.overkill);
  inc('win', won);
  inc('combo>=4', me.biggestCombo >= 4); inc('combo>=6', me.biggestCombo >= 6);
  inc('ult>=1', me.ultimates >= 1); inc('ult>=3', me.ultimates >= 3); inc('spells>=15', me.spells >= 15);
  inc('heal>=60', me.healed >= 60);
  inc('win untouched', won && low >= 250);
  inc('win low>=200', won && low >= 200); inc('win low>=225', won && low >= 225);
  inc('win>120s', won && s.time > 120000); inc('win>90s', won && s.time > 90000); inc('win<=10hp', won && s.players[0].hp <= 10); inc('win after <25', won && low < 25);
  inc('win<40s', won && s.time < 40000); inc('win>180s', won && s.time > 180000);
  inc('iceAndStun (as rime/volt foe)', iceStun);
  inc('overkill>=15', won && me.overkill >= 15); inc('overkill>=20', won && me.overkill >= 20);
  inc('win, no ult, >120s', won && me.ultimates === 0 && s.time > 120000);
  inc('win, no ult', won && me.ultimates === 0);
}
console.log(`Master vs ${foeLevel.name}, ${N} games (player-0 view):`);
for (const [k, v] of Object.entries(c)) console.log(`  ${k.padEnd(32)} ${((v / N) * 100).toFixed(1)}%`);
const hist = (xs: number[]) => xs.reduce((h: Record<number, number>, x) => ((h[x] = (h[x] ?? 0) + 1), h), {});
console.log('  combo depth histogram', JSON.stringify(hist(combo)));
console.log('  overkill on wins: max', Math.max(...over), 'sorted top', over.sort((a, b) => b - a).slice(0, 12).join(','));
