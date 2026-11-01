/**
 * Balance simulator: round-robin bot-vs-bot matches at equal skill.
 *   npm run sim            (default 40 games per pairing, Master bots)
 *   npm run sim -- 100 3   (100 games, Expert bots)
 */
import { AI_LEVELS, applyMove, CHARACTERS, chooseMove, createBattle, thinkDelay, tick } from '../src';

const games = Number(process.argv[2] ?? 40);
const level = AI_LEVELS[Number(process.argv[3] ?? 4)];

function play(seed: number, a: string, b: string) {
  const s = createBattle({ seed, characters: [a, b] });
  const rng = [{ rng: seed * 7 + 1 }, { rng: seed * 13 + 5 }];
  const next = [thinkDelay(level, rng[0]), thinkDelay(level, rng[1])];
  while (!s.over && s.time < 10 * 60_000) {
    tick(s, 50);
    for (const p of [0, 1] as const) {
      const pl = s.players[p];
      if (s.time >= next[p] && s.time >= pl.busyUntil && s.time >= pl.stunnedUntil) {
        const m = chooseMove(s, p, level, rng[p]);
        if (m) applyMove(s, p, m.a, m.b);
        next[p] = Math.max(s.time, pl.busyUntil) + thinkDelay(level, rng[p]);
      }
    }
  }
  return s;
}

const ids = CHARACTERS.map((c) => c.id);
const wins: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
const played: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
const table: string[] = [];
let totalTime = 0;
let n = 0;
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    let w = 0;
    for (let g = 0; g < games; g++) {
      const swap = g % 2 === 1;
      const [a, b] = swap ? [ids[j], ids[i]] : [ids[i], ids[j]];
      const s = play(1000 + g * 31 + i * 7 + j, a, b);
      const winnerId = s.winner === null ? null : s.players[s.winner].characterId;
      if (winnerId === ids[i]) w++;
      if (winnerId) wins[winnerId]++;
      played[ids[i]]++;
      played[ids[j]]++;
      totalTime += s.time;
      n++;
    }
    table.push(`${ids[i].padEnd(6)} vs ${ids[j].padEnd(6)}  ${((w / games) * 100).toFixed(0).padStart(3)}% - ${(((games - w) / games) * 100).toFixed(0)}%`);
  }
}
console.log(`Bots: ${level.name}, ${games} games per pairing, avg game ${(totalTime / n / 1000).toFixed(1)}s\n`);
console.log(table.join('\n'));
console.log('\nOverall win rate:');
for (const id of ids) console.log(`  ${id.padEnd(6)} ${((wins[id] / played[id]) * 100).toFixed(1)}%`);
