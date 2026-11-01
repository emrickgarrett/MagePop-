/**
 * How winnable is each story fight? Simulates a player bot against every fight node.
 *   npx tsx test/story-odds.ts <playerLevel 0-5> <runs> [levelDelta] [enemyHpScale]
 * e.g. Normal for a solid player: `3 40`; Relaxed for a newer one: `2 30 -1 0.85`.
 * Targets (Expert player, Normal): fights ~70-100%, bosses ~35-90% rising in difficulty.
 */
import { AI_LEVELS, applyMove, chooseMove, createBattle, STORY, thinkDelay, tick, BattleRules } from '../src';
const PLAYER = AI_LEVELS[Number(process.argv[2] ?? 3)];
const N = Number(process.argv[3] ?? 40);
const DELTA = Number(process.argv[4] ?? 0); const HPS = Number(process.argv[5] ?? 1);
const lvl = (l: number) => Math.max(0, Math.min(5, l + DELTA)); const hpOf = (h?: number) => Math.round((h ?? 250) * HPS);
function fight(seed: number, hero: string, foe: string, foeLevel: number, rules: BattleRules | undefined, maxHp: [number, number], hp?: number) {
  const s = createBattle({ seed, characters: [hero, foe], maxHp, hp: hp !== undefined ? [hp, maxHp[1]] : undefined, rules });
  const lv = [PLAYER, AI_LEVELS[foeLevel]];
  const rng = [{ rng: seed * 7 + 1 }, { rng: seed * 13 + 5 }];
  const next = [thinkDelay(lv[0], rng[0]), thinkDelay(lv[1], rng[1])];
  while (!s.over && s.time < 600000) {
    tick(s, 50);
    for (const p of [0, 1] as const) {
      const pl = s.players[p];
      if (s.time >= next[p] && s.time >= pl.busyUntil && s.time >= pl.stunnedUntil) {
        const m = chooseMove(s, p, lv[p], rng[p]);
        if (m) applyMove(s, p, m.a, m.b);
        next[p] = Math.max(s.time, pl.busyUntil) + thinkDelay(lv[p], rng[p]);
      }
    }
  }
  return s;
}
console.log(`Player bot: ${PLAYER.name}, ${N} runs per node`);
for (const c of STORY) {
  for (const n of c.nodes) {
    if (n.kind === 'lesson') continue;
    let wins = 0, time = 0;
    for (let g = 0; g < N; g++) {
      if (n.kind === 'gauntlet') {
        let hp: number | undefined; let ok = true; let t = 0;
        for (const w of n.waves) {
          const s = fight(9000 + g * 17, c.hero, w.opponent, lvl(w.aiLevel), w.rules, [250, hpOf(w.opponentHp)], hp);
          t += s.time;
          if (s.winner !== 0) { ok = false; break; }
          hp = Math.min(250, s.players[0].hp + Math.round(250 * (n.healBetweenPct ?? 15) / 100));
        }
        if (ok) { wins++; time += t; }
      } else {
        const s = fight(9000 + g * 17, c.hero, n.opponent, lvl(n.aiLevel), n.rules, [n.playerHp ?? 250, n.kind === "survival" ? (n.opponentHp ?? 250) : hpOf(n.opponentHp)]);
        if (s.winner === 0) { wins++; time += s.time; }
      }
    }
    console.log(`${c.hero.padEnd(6)} ${n.kind.padEnd(8)} ${n.id.padEnd(22)} win ${String(Math.round(wins / N * 100)).padStart(3)}%  avg win ${(wins ? time / wins / 1000 : 0).toFixed(0)}s${n.optional ? '  (challenge)' : ''}`);
  }
}
