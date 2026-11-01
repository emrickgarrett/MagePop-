# MagePop!

A desktop match-3 PVP battler. Pick a mage, match gems to cast their spells, and drain your
opponent's health bar before they drain yours.

- **3-match**: basic hit · **4-match**: that color's spell · **5+ (lines, L, T)**: the ultimate
- Five mages with a unique spell for every gem color (freeze, poison, stuns, heals, meteors…)
- **Story** (each chapter teaches one mage and unlocks the next), **Quick Battle**, **Endless**
- Online PVP is next: the server already runs authoritative matches on the shared engine

See [`docs/DESIGN.md`](docs/DESIGN.md) for rules, roster, architecture and roadmap.

## Getting started

Requires Node 22.12+ (Node 26 LTS recommended).

```bash
npm install
npm run desktop        # build the client and launch the Electron app
npm run desktop:dev    # Electron + Vite hot reload
npm run dev            # or just play in the browser at http://localhost:5173
```

## Other commands

```bash
npm test               # engine unit tests (vitest)
npm run sim            # bot-vs-bot balance report:  npm run sim -- <games> <aiLevel 0-5>
npm run typecheck
npm run server         # PVP server on ws://localhost:8787
npm run bots -w @magepop/server   # two headless bots queue up and fight through the server
npm run dist -w @magepop/desktop  # package an installer with electron-builder
```

## Layout

```
packages/core     Deterministic rules engine, characters, story, bot AI, PVP protocol (shared)
packages/client   React + Vite game client
apps/desktop      Electron shell
packages/server   WebSocket matchmaking + authoritative battles
docs/             Design doc and roadmap
```

## Achievements

All achievements live in `packages/client/src/game/achievements.ts` as plain data. Each entry has a name,
description, category, tier (bronze 10 / silver 25 / gold 50 points), an icon glyph, and one unlock rule:

- `match: (m, save) => boolean` is checked against every finished match (a `MatchRecord`: mode, mages,
  difficulty, result, time, damage, spells, ultimates, best combo, HP left / lowest HP...).
- `progress: (save) => [current, target]` reads the save (story, unlocks, Endless best, per-mage stats,
  lifetime `totals`) and shows a progress bar.

Add `secret: true` to hide it until earned. To retire one, set `retired: true` rather than deleting it; never
reuse or rename an id, since ids are what saves store. New achievements are checked retroactively against
saved history and totals on the next launch. Per-mage achievements are generated from the roster, so new
mages get them for free. `npm test` checks ids are unique and every entry has a rule.

## Adding a mage

Add an entry to `packages/core/src/characters.ts`: five colors, each with an `active` and `ultimate`
spell built from effect primitives (`damage`, `poison`, `freeze`, `stun`, `convert`…). Spell text in
the UI is generated from the effects, so it can't drift from the numbers. Run `npm run sim` to check
balance, then add a story chapter flavor block in `packages/core/src/story.ts`.

Give the mage a spell-effect theme in `MAGE_FX` (`packages/client/src/components/SpellFx.tsx`): main
and light colors, a particle (`ember`, `flake`, `leaf`, `wisp`, `spark`) and a stun style (`flames`,
`frost`, `vines`, `hex`, `lightning`). Hits, stuns, heals, shields and buffs they cause use it. Without
an entry they fall back to their palette with sparks and lightning.

## Art

All art is generated with GameDeveloperHarness into `art/` (the raw outputs), then made game-ready:

- **Portraits**: `packages/client/public/assets/portraits/<mageId>.png`
- **Gem sets** (one themed set per mage, shapes differ but colors stay fixed so spell colors read
  the same everywhere): `packages/client/public/assets/gems/<mageId>/<color>.png`
- **Board backgrounds**: `packages/client/public/assets/boards/<mageId>.jpg`

`python tools/process_art.py` slices the raw gem sheets (3x2 grid on white), removes the background,
normalizes every gem to the same 256x256 box, and darkens/blurs board backgrounds. Anything missing
falls back to built-in vector gems, so new mages work before their art exists.

## Audio

- **Music** (Suno): `packages/client/public/assets/music/<track>.mp3`: `menu`, `story`, `endless`, `victory`,
  `defeat`, and `battle-<mageId>`. Quick Battle and story trials play your mage's theme; story bosses
  play the boss's theme. Loudness levels and loop points are set in `packages/client/src/game/audio.ts`.
- **Sound effects**: raw packs go in `art/sfx/` (Kenney CC0 packs are there now). `python tools/process_sfx.py`
  picks, trims and levels them into `packages/client/public/assets/sfx/` and writes `manifest.json`. Any sound
  without a file (currently spell, ultimate, heal, freeze, poison, stun) is synthesized in code.

## Building and releasing

**Build installers locally** (for the OS you're on):

```bash
npm run dist
```

Output lands in `apps/desktop/release/`. On Windows you get `MagePop-Setup-<version>.exe` (installer)
and `MagePop-<version>-portable.exe` (single file, no install). macOS builds a `.dmg`, Linux an `.AppImage`.

**Publish a GitHub release** (builds Windows, macOS and Linux in GitHub Actions):

1. Bump `version` in `apps/desktop/package.json`
2. `git tag v<version> && git push origin v<version>`
3. Open the draft on the repo's Releases page, add notes, publish

Builds are unsigned for now, so Windows SmartScreen shows "unknown publisher" (More info → Run anyway)
and macOS needs right-click → Open the first time.
