"""
Turn raw generated art into game-ready assets.

  python tools/process_art.py

Gem sheets: one image per champion, a 3x2 grid of icons on a flat white background
(bottom-right cell empty). Each icon is cut out, its white background removed, and it is
scaled to fit the same 256x256 box so every set occupies the same space on the board.

Board backgrounds: cropped of any white frame, softly blurred and darkened so gems stay
readable on top, then saved as JPEG.

Edit SOURCES below when you regenerate art.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / "art" / "assets" / "sprites"
OUT_GEMS = ROOT / "packages" / "client" / "public" / "assets" / "gems"
OUT_BOARDS = ROOT / "packages" / "client" / "public" / "assets" / "boards"

# Grid order of each sheet: top row L->R, then bottom row L->R (6th cell empty).
SOURCES = {
    "ember": {
        "sheet": "Match-3_puzzle_gem_icon_sprite_sheet_for_fire_mage_6102fc00-a8e0-49c7-916b-ba8a03c06f3d.jpg",
        "order": ["ruby", "topaz", "amethyst", "sapphire", "emerald"],
        "board": "Dark_charred_obsidian_stone_floor_with_faint_glowi_9694ed1e-6fec-4bc3-acd1-cc4360e2fcf0.jpg",
    },
    "rime": {
        "sheet": "Match-3_puzzle_gem_icon_sprite_sheet_for_ice_mage_606592c0-b6d3-4033-b916-4792746a2cbe.jpg",
        "order": ["sapphire", "topaz", "ruby", "emerald", "amethyst"],
        "board": "Dark_frozen_lake_ice_surface_seen_from_above_back_fdf4b13e-16b6-4f40-bde4-473ff9e316ee.jpg",
    },
    "briar": {
        "sheet": "ONE_sprite_sheet_with_five_match-3_puzzle_gem_icon_46e61416-dc8c-4db1-b7d9-393583a45cb4.jpg",
        "order": ["emerald", "sapphire", "ruby", "topaz", "amethyst"],
        "board": "Dark_mossy_forest_floor_seen_from_directly_above_2501fe46-f9e6-4f66-8f49-582d01fb3caa.jpg",
    },
    "nyx": {
        "sheet": "Match-3_puzzle_gem_icon_sprite_sheet_for_Nyx_the_h_ac009c6b-c620-46ae-bc81-06259df4740c.jpg",
        "order": ["amethyst", "ruby", "emerald", "topaz", "sapphire"],
        "board": "Dark_velvet_witch_s_spellcloth_texture_seen_from_a_41058d7d-1357-4147-abb2-187b182ffaaa.jpg",
    },
    "volt": {
        "sheet": "ONE_sprite_sheet_with_five_match-3_puzzle_gem_icon_561b422b-fa02-40e0-a28c-d0949dfcd1f7.jpg",
        "order": ["topaz", "sapphire", "ruby", "amethyst", "emerald"],
        "board": "Dark_storm-cloud_night_sky_texture_seen_from_above_00137059-8c9a-47f6-a678-7287da6f1b1d.jpg",
    },
}

GEM_SIZE = 256
GEM_FILL = 0.9  # icon's longest side as a fraction of the box
SENTINEL = (255, 0, 255)


def background_mask(img: Image.Image, thresh: int = 48) -> np.ndarray:
    """True where the pixel is the white background connected to the image border."""
    pad = 2
    padded = Image.new("RGB", (img.width + pad * 2, img.height + pad * 2), (255, 255, 255))
    padded.paste(img, (pad, pad))
    ImageDraw.floodfill(padded, (0, 0), SENTINEL, thresh=thresh)
    arr = np.asarray(padded)[pad:-pad, pad:-pad]
    return np.all(arr == np.array(SENTINEL), axis=-1)


def components(mask: np.ndarray):
    """4-connected components of a boolean mask -> list of (area, ys, xs)."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        ys, xs = [], []
        while q:
            y, x = q.popleft()
            ys.append(y)
            xs.append(x)
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        out.append((len(ys), np.array(ys), np.array(xs)))
    return out


def cut_gems(sheet_path: Path, order: list[str]) -> dict[str, Image.Image]:
    img = Image.open(sheet_path).convert("RGB")
    bg = background_mask(img)
    fg = ~bg
    # Label at quarter resolution for speed, then map boxes back up.
    s = 4
    small = fg[::s, ::s]
    cells: dict[int, list[int]] = {}
    for area, ys, xs in components(small):
        if area < 12:  # stray specks
            continue
        cy, cx = ys.mean() * s, xs.mean() * s
        col = min(2, int(cx / (img.width / 3)))
        row = min(1, int(cy / (img.height / 2)))
        cell = row * 3 + col
        box = [xs.min() * s, ys.min() * s, (xs.max() + 1) * s, (ys.max() + 1) * s]
        if cell in cells:
            b = cells[cell]
            cells[cell] = [min(b[0], box[0]), min(b[1], box[1]), max(b[2], box[2]), max(b[3], box[3])]
        else:
            cells[cell] = box

    alpha = Image.fromarray((fg * 255).astype(np.uint8))
    # Eat the 1px white fringe, then feather slightly.
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    rgba = img.copy()
    rgba.putalpha(alpha)

    gems = {}
    for i, color in enumerate(order):
        if i not in cells:
            raise SystemExit(f"{sheet_path.name}: no icon found in grid cell {i} ({color})")
        x0, y0, x1, y1 = cells[i]
        pad = 6
        crop = rgba.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad)))
        crop = crop.crop(crop.getchannel("A").getbbox())
        scale = (GEM_SIZE * GEM_FILL) / max(crop.size)
        crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.LANCZOS)
        canvas = Image.new("RGBA", (GEM_SIZE, GEM_SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(crop, ((GEM_SIZE - crop.width) // 2, (GEM_SIZE - crop.height) // 2))
        gems[color] = canvas
    return gems


def process_board(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    arr = np.asarray(img).astype(int)
    # Crop away any light frame the generator added.
    dark = arr.min(axis=-1) < 200
    rows = np.nonzero(dark.mean(axis=1) > 0.6)[0]
    cols = np.nonzero(dark.mean(axis=0) > 0.6)[0]
    img = img.crop((cols.min() + 4, rows.min() + 4, cols.max() - 4, rows.max() - 4))
    side = min(img.size)
    img = img.crop(((img.width - side) // 2, (img.height - side) // 2, (img.width + side) // 2, (img.height + side) // 2))
    img = img.resize((768, 768), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.2))
    # Normalize every board to the same dim brightness (so themes feel consistent and gems pop),
    # and soften contrast a little.
    a = np.asarray(img).astype(float)
    target = 48.0
    gain = float(np.clip(target / max(a.mean(), 1.0), 0.6, 4.0))
    a = a * gain
    mean = a.mean(axis=(0, 1), keepdims=True)
    a = mean + (a - mean) * 0.85
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def main():
    for champ, src in SOURCES.items():
        out = OUT_GEMS / champ
        out.mkdir(parents=True, exist_ok=True)
        for color, gem in cut_gems(SPRITES / src["sheet"], src["order"]).items():
            gem.save(out / f"{color}.png", optimize=True)
        OUT_BOARDS.mkdir(parents=True, exist_ok=True)
        process_board(SPRITES / src["board"]).save(OUT_BOARDS / f"{champ}.jpg", quality=85)
        print(f"{champ}: 5 gems + board")


if __name__ == "__main__":
    main()
