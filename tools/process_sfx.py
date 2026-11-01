"""
Pick, trim and level sound effects from raw downloads into game-ready files.

  python tools/process_sfx.py          (needs ffmpeg on PATH)

Raw packs live in art/sfx/ (e.g. Kenney CC0 packs). Output goes to
packages/client/public/assets/sfx/<name>.ogg, which the game loads automatically.
Any game sound without a file here falls back to a synthesized placeholder, so you can
map sounds one at a time. To swap a sound, change its source below and re-run.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "sfx"
OUT = ROOT / "packages" / "client" / "public" / "assets" / "sfx"

UI = "kenney_interface-sounds/Audio"
IMPACT = "kenney_impact-sounds/Audio"

# game sound name: (source file, gain in dB, max length in seconds or None)
SOUNDS = {
    "click": (f"{UI}/click_001.ogg", -8, None),
    "swap": (f"{UI}/drop_002.ogg", -6, None),
    "invalid": (f"{UI}/error_004.ogg", -6, None),
    "match": (f"{UI}/glass_002.ogg", -4, None),  # pitched up for each cascade
    "ready": (f"{UI}/confirmation_001.ogg", -4, None),
    "hit": (f"{IMPACT}/impactPunch_medium_000.ogg", -3, 0.4),
    "shield": (f"{IMPACT}/impactMetal_medium_000.ogg", -6, None),
    "stone": (f"{IMPACT}/impactMining_000.ogg", -5, 0.6),
    "shatter": (f"{IMPACT}/impactGlass_heavy_000.ogg", -3, None),
    # Still synthesized in-game (no good match in the Kenney packs yet):
    # spell, ultimate, heal, freeze, poison, stun
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = []
    for name, (src, gain_db, max_len) in SOUNDS.items():
        path = RAW / src
        if not path.exists():
            print(f"skip {name}: {src} not found")
            continue
        filters = [f"volume={gain_db}dB"]
        if max_len:
            fade = 0.08
            filters.append(f"atrim=0:{max_len}")
            filters.append(f"afade=t=out:st={max_len - fade}:d={fade}")
        cmd = [
            "ffmpeg", "-y", "-v", "error", "-i", str(path),
            "-af", ",".join(filters), "-ac", "1", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "5",
            str(OUT / f"{name}.ogg"),
        ]
        subprocess.run(cmd, check=True)
        made.append(name)
        print(f"{name:8s} <- {src}")
    # The game reads this to know which sounds have files (the rest are synthesized).
    (OUT / "manifest.json").write_text(json.dumps({n: f"{n}.ogg" for n in sorted(made)}, indent=2) + "\n")


if __name__ == "__main__":
    main()
