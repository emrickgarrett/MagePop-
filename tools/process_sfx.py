"""
Pick, trim and level sound effects from raw downloads into game-ready files.

  python tools/process_sfx.py          (needs ffmpeg on PATH)

Raw packs live in art/sfx/ (small, committed: only the Kenney files we use) or art/wip/sfx/
(big downloads such as the Sonniss GDC bundle and the Lentikula packs: git-ignored, kept
locally only). Output goes to packages/client/public/assets/sfx/<name>.ogg, which the game loads
automatically, and is the only part that ships.
Any game sound without a file here falls back to a synthesized placeholder, so you can
map sounds one at a time. To swap a sound, change its source below and re-run.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAWS = [ROOT / "art" / "sfx", ROOT / "art" / "wip" / "sfx"]
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
}

LENT = "Basic Spell Impacts Pack by Lentikula"
DRUID = "Druid Spell Impacts Pack/Plant Spell Impacts"
HEAL = "Healing Spell Impacts Pack by Lentikula/Impacts"
SON = "Sonniss.com-GDC2026-GameAudioBundle"

# Magic sounds: peak-normalized to PEAK_DB, then the gain offset. (source, gain dB, max length, start s)
MAGIC = {
    "spell": (f"{SON}/Epic Stock Media - Fantasy Game 2 - Sound Kit for Enchanted Realms/MAGAngl_Magic Light Spell Enchantment Potion Effect Tonal Bright 03_ESM_FG2.wav", -4, 1.2, 0),
    "ultimate": (f"{SON}/Epic Stock Media - Anime Game/DSGNStngr_Power Up Bright Positive Successful Light Saturation Crash Shimmer 05_ESM_AG.wav", 0, None, 0),
    "heal": (f"{HEAL}/Healing Spell Impact 9.wav", -4, 1.2, 0),
    "freeze": (f"{SON}/Epic Stock Media - Tower Defense Game/ICEBrk_Skill Freeze Whoosh Break Impact Layered Movement Shatter 03_ESM_TDG.wav", -5, 1.2, 0),
    "poison": (f"{SON}/Cinematic Sound Design - Cartoon & Animation Vol 2/Cartoon Bubbles Short.wav", -4, None, 0),
    "stun": (f"{SON}/Cinematic Sound Design - Cartoon Bloopers/Cartoon Confused Dizzy.wav", -6, 1.0, 0),
    # Each mage's own cast sound (falls back to "spell" for a mage without one).
    "cast-ember": (f"{LENT}/Fire Spell Impacts/Fire Spell Impact 3.wav", -3, 1.2, 0),
    "cast-rime": (f"{LENT}/Ice Spell Impacts/Ice Spell Impact 5.wav", -3, 1.0, 0),
    "cast-briar": (f"{DRUID}/Plant Spell Impact 1.wav", -3, 1.2, 0.15),
    "cast-nyx": (f"{SON}/Epic Stock Media - Anime Game/DSGNMisc_Misc Monster Tentacle Modulated Creature Shadow Abstract Swept Wobble Lfo 02_ESM_AG.wav", -4, 1.2, 0),
    "cast-volt": (f"{LENT}/Lightning Spell Impacts/Lightning Spell Impact 1.wav", -4, 1.2, 0.35),
    "cast-hollow": (f"{SON}/Alexander Kopeikin - Emotion and Magic/magic, action gesture, evil presence, onslaught-004.wav", -3, 1.2, 10.4),
}
PEAK_DB = -3.0


def find_raw(src: str):
    for base in RAWS:
        if (base / src).exists():
            return base / src
    return None


def peak_db(path) -> float:
    out = subprocess.run(["ffmpeg", "-v", "info", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    for line in out.splitlines():
        if "max_volume" in line:
            return float(line.split("max_volume:")[1].split("dB")[0])
    return 0.0


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = []
    jobs = {n: (src, g, m, 0, False) for n, (src, g, m) in SOUNDS.items()}
    jobs.update({n: (src, g, m, st, True) for n, (src, g, m, st) in MAGIC.items()})
    for name, (src, gain_db, max_len, start, normalize) in jobs.items():
        path = find_raw(src)
        if not path:
            print(f"skip {name}: {src} not found")
            continue
        if normalize:
            gain_db += PEAK_DB - peak_db(path)
        filters = []
        if start:
            filters.append(f"atrim=start={start},asetpts=PTS-STARTPTS,afade=t=in:d=0.03")
        filters.append(f"volume={gain_db:.2f}dB")
        if max_len:
            fade = 0.12
            filters.append(f"atrim=0:{max_len}")
            filters.append(f"afade=t=out:st={max_len - fade}:d={fade}")
        cmd = [
            "ffmpeg", "-y", "-v", "error", "-i", str(path),
            "-af", ",".join(filters), "-ac", "1", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "5",
            str(OUT / f"{name}.ogg"),
        ]
        subprocess.run(cmd, check=True)
        made.append(name)
        print(f"{name:12s} <- {src.split('/')[-1]}")
    # The game reads this to know which sounds have files (the rest are synthesized).
    (OUT / "manifest.json").write_text(json.dumps({n: f"{n}.ogg" for n in sorted(made)}, indent=2) + "\n")


if __name__ == "__main__":
    main()
