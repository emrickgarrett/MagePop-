"""
Encode the game music for shipping.

Sources: the original Suno MP3s in art/wip/music/<track>.mp3 (git-ignored, kept locally).
Output:  packages/client/public/assets/music/<track>.webm (Opus, 96 kbps).

Opus at 96 kbps sounds the same as the ~190 kbps MP3 originals for this music at about half the
size, which matters for the browser build (players download it). Every engine we ship on plays
WebM/Opus: Electron/Chromium, Firefox and Safari 15+.

Requires ffmpeg on PATH. Usage: python tools/process_music.py [track ...]
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "wip" / "music"
OUT = ROOT / "packages" / "client" / "public" / "assets" / "music"
BITRATE = "96k"


def main():
    only = set(sys.argv[1:])
    sources = sorted(p for p in SRC.glob("*.mp3") if not only or p.stem in only)
    if not sources:
        raise SystemExit(f"no MP3s found in {SRC}")
    for src in sources:
        out = OUT / f"{src.stem}.webm"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-map_metadata", "-1",
             "-c:a", "libopus", "-b:a", BITRATE, "-vbr", "on", "-application", "audio", str(out)],
            check=True,
        )
        print(f"{src.stem}: {src.stat().st_size // 1024} KB -> {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
