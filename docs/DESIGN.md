# MagePop — Game Design & Roadmap

A desktop match-3 PVP battler. Two players each have their own 8×8 board and a health bar. Matching gems
casts spells at the opponent. Each character has a unique spell bound to each of the five gem colors.

## Core rules

| Match size | Result |
|---|---|
| 3 of a color | Basic hit: small damage (3), any color |
| 4 of a color | **Active** spell for that color (the character's spell) |
| 5+ of a color (lines, L, T shapes) | **Ultimate** — supercharged version of that spell |

- Matches are counted as connected groups: a T or L made of 5 gems is a 5-match.
- Cascades multiply output: each cascade level adds +25% to that match's numbers.
- 250 HP each (shields cap at 60). Shields absorb damage before HP. First to 0 HP loses.
- Refills are "smart": 85% of refilled gems avoid completing a match. Pure random refills produced
  3–4 cascades per move and 10-second games.
- **Real-time, simultaneous play** on separate boards. After each move a player is "busy" while their board
  resolves (swap + cascade time). The engine enforces this, so humans, bots and remote players all move at the
  same maximum pace.
- Swaps that don't create a match are rejected (gems bounce back). If a board has no legal moves it reshuffles.
- Board changes caused by an *opponent's* spell (destroyed gems, refills) can cascade, but those cascades
  give the board owner nothing — no free spells off enemy disruption.

### Gem colors
Ruby (red), Sapphire (blue), Emerald (green), Topaz (yellow), Amethyst (purple). Each has a distinct shape too,
so color isn't the only cue.

### Board hazards
- **Frozen** gems are encased in ice: can't be swapped, but can still be matched (which breaks them). Thaw on a timer.
- **Stone** blocks can't be swapped or matched. A match next to a stone crumbles it.

### Status effects
- **Poison / Burn**: damage every second until the victim makes N matches (or a max duration).
- **Regen**: healing every second until the caster makes N matches (or a max duration).
- **Stun**: victim can't move for a short time.
- **Empower**: caster's next damage spell(s) deal bonus damage.
- **Shield**: absorbs incoming damage.

## Spell effect primitives
All spells are data: a list of composable effects, so new characters need no new engine code unless they
introduce a new primitive.

`damage`, `heal`, `shield`, `drain`, `poison`, `regen`, `freeze`, `petrify`, `destroy`, `shatter`,
`stun`, `empower`, `convert` (own board), `cleanse`, `bonusIfPoisoned`.

## Launch roster (prototype)

| Character | Role | Unlock |
|---|---|---|
| Ember — Pyromancer | Burst damage + burn | Starter |
| Rime — Cryomancer | Freeze / stall / shatter | Beat Ember's story |
| Briar — Wildwarden | Healing, regen, entangle | Beat Rime's story |
| Nyx — Hexweaver | Poison, drain, petrify | Beat Briar's story |
| Volt — Stormcaller | Stuns, empower, board conversion | Beat Nyx's story |

Full spell numbers live in `packages/core/src/characters.ts`. First balance pass (Master vs Master bots,
40 games per pairing, `npm run sim`): every champion lands between 42% and 58% overall win rate,
average fight ~53s. Rime is slightly weak and Briar slightly strong.

## Modes

- **Story** (single player): one chapter per character, played *as* that character. Each fight introduces a
  couple of that character's spells through dialogue, so the story is the long-form tutorial. Bots get harder
  through the chapter; the chapter boss is the next character, and beating it unlocks them.
- **Quick Battle**: any unlocked character vs any character at a chosen bot difficulty.
- **Endless**: fight random opponents back to back. HP carries over (+25% heal between waves); bots get harder
  every two waves. Best wave is saved.
- **PVP** (planned): online matchmaking through a remote server.

### Bot difficulty
Bots search every legal swap, simulate it with the real engine and score the outcome (damage, spell value given
the situation — e.g. heals are worth more at low HP). Difficulty changes think time, mistake rate and whether
the bot looks at cascades. Cascade-aware bots simulate gravity but *guess* the refill — they never peek at the
board's real RNG.

| Tier | Think time | Random move chance | Sees cascades |
|---|---|---|---|
| Novice | 3.2s | 40% | no |
| Apprentice | 2.6s | 25% | no |
| Adept | 2.0s | 12% | no |
| Expert | 1.5s | 5% | yes |
| Master | 1.1s | 0% | yes |
| Nightmare | 0.8s | 0% | yes |

## Architecture (built for PVP from day one)

```
packages/core     Pure, deterministic rules engine (no DOM, no Node APIs). Seeded RNG per board.
                  applyMove(state, player, a, b) / tick(state, dtMs) -> events.
                  Also the bot AI. Shared by client and server.
packages/client   React + Vite renderer. Plays back engine events as animations.
apps/desktop      Electron shell that loads the client.
packages/server   Node WebSocket server: matchmaking queue + authoritative battles running core.
```

PVP model: **server-authoritative**, already working end to end with headless bot clients
(`npm run server` + `npm run bots -w @magepop/server`). Clients send move *intents* (`swap a b`); the server validates them with
the same engine, ticks time, and broadcasts the resulting events to both players. Because the engine is
deterministic and enforces move pacing, cheating clients can't move faster or fake matches, and the client
already renders from events the same way for AI and online matches.

## Roadmap

1. **Prototype ✅** — engine, 5 characters, bots, Story/Quick/Endless, save data, Electron shell,
   server skeleton with matchmaking + authoritative battles.
2. **Feel pass** — art (portraits, gem sprites, spell VFX), sound, screen shake, spell projectiles, combo callouts.
   (GamingAssetHarness is a natural fit for generating these.)
3. **Balance pass** — automated bot-vs-bot simulations to tune spell numbers per character matchup.
4. **PVP alpha** — wire client to the server: lobby, quick match, reconnect, latency smoothing; deploy server.
5. **Accounts & progression sync** — server-side unlocks, ranked ladder, ELO.
6. **More content** — more characters, story chapters, cosmetics.
