"""
Story (visual novel) art: location backgrounds and mage expression portraits.

  python tools/process_story_art.py

Sources are the harness outputs in art/assets/sprites/ (large, git-ignored); only the processed,
much smaller files below are committed and shipped:
  packages/client/public/assets/scenes/<location>.jpg      1600x900 JPEG
  packages/client/public/assets/portraits/expr/<mage>-<expression>.webp   768px WebP with alpha
Edit SCENES / EXPRESSIONS when you regenerate art.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIRS = [ROOT / "art" / "assets" / "sprites", ROOT / "art" / "wip" / "story-src"]
OUT_SCENES = ROOT / "packages" / "client" / "public" / "assets" / "scenes"
OUT_EXPR = ROOT / "packages" / "client" / "public" / "assets" / "portraits" / "expr"

SCENES = {
    "gate": "Anime_visual_novel_background_The_grand_main_gate_1601098b-0d39-4417-b02e-4c59c4402cf3.jpg",
    "arena": "The_Trial_Arena_of_a_magic_academy_a_grand_circul_b7d7f6d7-4adf-495b-84b8-d8dcdd1710d2.jpg",
    "heartstone-hall": "Anime_visual_novel_background_a_lower_hall_deep_b_969ef89e-66db-49f2-8ac9-4ee7b217aa3c.jpg",
    "fountain": "Anime_visual_novel_background_A_stone_courtyard_o_66e07922-3982-4275-b680-68f92480509e.jpg",
    "greenhouse": "Anime_visual_novel_background_The_greenhouse_wing_a1e46069-f97b-474d-bdfd-d491638b59b3.jpg",
    "grove": "A_sacred_forest_grove_hidden_inside_magic_academy_72f8c3e7-be05-4b98-b933-11fed4095356.jpg",
    "library": "An_old_forbidden_curse_library_towering_dark_wood_c04b2d38-4e5e-43ff-941a-11177f7bff67.jpg",
    "catacombs": "Catacombs_beneath_a_magic_academy_long_carved_sto_17eb107f-b58a-40fb-9634-81a82e86f4e0.jpg",
    "dorm": "A_cozy_magic_academy_dormitory_common_room_at_nigh_c5984d10-9010-495f-bf28-6e9173b4f5cc.jpg",
    "observatory": "Anime_visual_novel_background_Interior_of_an_aban_b4ee4497-f991-4e21-9dc9-b4839c0746a7.jpg",
    "stairway": "A_massive_ancient_spiral_stone_stairway_descending_88170c8d-6beb-4d64-affb-f60e4031fee2.jpg",
    "gray-garden": "Anime_visual_novel_background_An_underground_gard_6a5d577d-bea4-4c77-98bf-851cd439bc32.jpg",
    "heartstone": "A_vast_underground_cavern_with_a_giant_floating_cr_2d1219f6-3466-40b8-8e68-486a67fb2588.jpg",
}

EXPRESSIONS = {
    "ember-happy": "Ember_expression_HAPPY_Adult_female_fire_mage_cha_c6df65cc-b9d5-42e0-8635-a0bda8e96d59.png",
    "ember-angry": "Ember_expression_ANGRY._Adult_female_fire_mage_wit_4a2ae1de-04a5-4f68-a1dd-d91c6b9f7e48.png",
    "ember-surprised": "Ember_expression_SURPRISED._Adult_female_fire_mage_0576c617-2351-44d1-b0b0-71180f4d32de.png",
    "ember-sad": "Ember_expression_SAD_v2._Head-and-shoulders_portra_5954d7d8-0526-431f-a682-bab2fe76b3de.png",
    "rime-happy": "Rime_expression_HAPPY._Adult_female_ice_mage_chara_90d4b1a9-e20a-4ee8-a6bf-4e8c64df1828.png",
    "rime-angry": "Rime_expression_ANGRY._Adult_female_ice_mage_chara_75e1d772-fd50-4cde-a110-6fc7468b7a69.png",
    "rime-surprised": "Rime_expression_SURPRISED._Adult_female_ice_mage_c_446fae11-cbe6-4d15-9cf1-175d3ab58c4a.png",
    "rime-sad": "Rime_expression_SAD._Adult_female_ice_mage_charact_aea9f022-3a7e-405c-839b-2d1687529c73.png",
    "briar-happy": "Briar_expression_HAPPY._Adult_woman_nature_mage_ch_3bad6245-72ae-402e-9a8a-a5c597c00fee.png",
    "briar-angry": "Briar_expression_ANGRY._Adult_female_nature_mage_c_5276d6bc-c33b-4810-af30-541ccf020ef6.png",
    "briar-surprised": "Briar_expression_SURPRISED_Adult_female_nature_ma_baa037d6-3894-4d0a-8450-ae707769055e.png",
    "briar-sad": "Briar_expression_SAD._Adult_female_nature_mage_cha_6fcd1e91-6e3b-4418-af4e-a2024d6e753c.png",
    "nyx-happy": "Nyx_expression_HAPPY._Adult_female_hexweaver_chara_a697deb1-db03-4acf-8b04-6b89a6ddd86e.png",
    "nyx-angry": "Nyx_expression_ANGRY._Adult_female_hexweaver_chara_4464b988-53c0-45fb-95ed-0085ee147f6c.png",
    "nyx-surprised": "Nyx_expression_SURPRISED._Adult_female_dark_witch_3da13ac4-5f03-494a-909b-37540b3044db.png",
    "nyx-sad": "Nyx_expression_SAD._Adult_woman_mage_character_por_9224aa50-d521-4afc-9bbc-b4ba482b3198.png",
    "volt-happy": "Volt_expression_HAPPY._Adult_female_Stormcaller_ma_e33ee246-468d-4ebb-9450-f04e601e4c20.png",
    "volt-angry": "Volt_expression_ANGRY._Adult_female_character_port_8344dc7b-6404-4c20-92cf-3145c7812db2.png",
    "volt-surprised": "Volt_expression_SURPRISED._Adult_female_Stormcalle_ca91b222-f33f-4f31-b408-e0baffd4d1fd.png",
    "volt-sad": "Volt_expression_SAD_a_young_adult_female_Stormcal_a5ebb828-3c74-4b37-b72d-ea734feeaa64.png",
    # The Hollow: hooded is her normal portrait; "revealed" is the hood-down face for the finale.
    # "shrouded" is her face hidden in the hood's shadow, used while she's still "???".
    "hollow-shrouded": "Hollow_SHROUDED_hooded_mystery_portrait._Head-and-_9a8d2dc8-8f4c-4d7c-bca1-81952f6c1568.png",
    "hollow-revealed": "Hollow_REVEALED_neutral_expression._Head-and-shoul_150a9d6a-908a-4ad0-9d83-b52de0964429.png",
    "hollow-happy": "Hollow_expression_HAPPY._Head-and-shoulders_portra_7d157d9e-69a0-4f51-a050-12cd628318a4.png",
    "hollow-angry": "Hollow_expression_ANGRY._Head-and-shoulders_portra_f7a3e057-9b4c-47b9-a9ed-d0a44659a290.png",
    "hollow-surprised": "Hollow_expression_SURPRISED._Head-and-shoulders_po_bd6ec4bb-5480-446b-824a-62e3e8708f24.png",
    "hollow-sad": "Hollow_expression_SAD._Head-and-shoulders_portrait_8825a10e-e17f-45a2-b2d1-e3e0914519dd.png",
}

# Manual crops (fractions of the source) for images the generator framed with a fake
# "transparency" checkerboard that the automatic trim can't see.
SCENE_CROPS = {"heartstone": (0.07, 0.056, 0.928, 0.95)}

SCENE_SIZE = (1600, 900)
PORTRAIT_SIZE = 768


def find(name: str) -> Path:
    for d in SRC_DIRS:
        if (d / name).exists():
            return d / name
    raise SystemExit(f"missing source: {name}")


def trim_frame(img: Image.Image) -> Image.Image:
    """Drop any flat white/black letterbox the generator painted around the picture."""
    a = np.asarray(img.convert("RGB")).astype(int)
    lum = a.mean(axis=-1)
    busy = lambda line: line.std() > 6 or 25 < line.mean() < 235  # noqa: E731
    rows = [i for i in range(a.shape[0]) if busy(lum[i])]
    cols = [j for j in range(a.shape[1]) if busy(lum[:, j])]
    return img.crop((cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)) if rows and cols else img


def cover(img: Image.Image, size) -> Image.Image:
    w, h = size
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def main():
    OUT_SCENES.mkdir(parents=True, exist_ok=True)
    OUT_EXPR.mkdir(parents=True, exist_ok=True)
    for sid, name in SCENES.items():
        img = Image.open(find(name)).convert("RGB")
        if sid in SCENE_CROPS:
            l, t, r, b = SCENE_CROPS[sid]
            img = img.crop((round(l * img.width), round(t * img.height), round(r * img.width), round(b * img.height)))
        img = cover(trim_frame(img), SCENE_SIZE)
        img.save(OUT_SCENES / f"{sid}.jpg", quality=82, optimize=True, progressive=True)
        print(f"scene {sid}")
    for eid, name in EXPRESSIONS.items():
        img = Image.open(find(name)).convert("RGBA").resize((PORTRAIT_SIZE, PORTRAIT_SIZE), Image.LANCZOS)
        img.save(OUT_EXPR / f"{eid}.webp", quality=84, method=6)
        print(f"portrait {eid}")


if __name__ == "__main__":
    main()
