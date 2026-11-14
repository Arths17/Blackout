# Asset licenses

| Asset | Source | License | Notes |
| --- | --- | --- | --- |
| Tiles, decals, props, breakers, door, lamps, creature, UI, shadows | Original, `tools/make_art.mjs` | Project license | Exports go to `public/assets/`; `atlas.json` lists frames and anchors |

| White Hero idle/walk/interact/hurt/fall/victory | User-supplied friends' art; files in `public/hero/` | Team-supplied permission from the user, checked 2026-11-14; no CC0 claim | Original 32×48 PNGs preserved; 53 frames sampled at 16×24 and mapped to the cold master palette by `tools/import_hero.py`. Source filenames and SHA-256 values are in `assets/src/hero.json`. |
| Root monster (`public/tree-root-monster.png`) | User-supplied by the team | User describes it as friends' work; no separate license text found | Used in production as the creature sprite. |

## Music

| Asset | Source | License | Notes |
| --- | --- | --- | --- |
| `public/audio/dark_fog.m4a`, `fight_1.m4a`, `fight_2.m4a`, `fight_3.m4a` | "Dark Fog", "Cyborg Ninja", "Volatile Reaction" and "Killing Time" by Kevin MacLeod, [incompetech.com](https://incompetech.com) | CC BY 4.0, attribution required | Cut to loops and re-encoded to AAC. Credit in CREDITS.md, README and on the results screen |
| Other `public/audio/*.wav` | Original, `tools/make_audio.mjs` | Project license | Generated |

## Earlier sourcing

Checked 2026-11-14. No art from these packs has been imported into the game.

| Pack | Author | Source | License on source page | Files | Status |
| --- | --- | --- | --- | --- | --- |
| Sci-Fi Facility Asset Pack | MurphysDad / HaywardMorihara | [itch.io](https://murphysdad.itch.io/sci-fi-facility), [author upload on OpenGameArt](https://opengameart.org/content/sci-fi-facility-asset-pack) | CC0 1.0 Universal on itch.io; CC0 on OpenGameArt | Source lists `sci-fi-facility-asset-pack.zip` (28–29 kB). Archive contents unverified because download was blocked. Page describes spy/hazmat movement, stationary characters, walls/floors, animated equipment, overlays and indicators. Cover font is excluded. | Not downloaded; target `assets/_incoming/sci-fi-facility/`. |
| Dark Dungeon: Pixel Horror Tileset | TinyPixelDev | [itch.io](https://tinypixeldev.itch.io/dark-dungeon-pixel-horror-tileset) | Page says CC0 / Public Domain but also forbids resale or redistribution as-is, including asset bundles. These conflict; permission is unclear. | Source lists `TinyPixelDev -Dark Dungeon Pixel Horror Tileset.zip` (89 kB). Archive contents unverified. Page describes 16×16 walls/floors, gore/decor, doors/gates. | Not downloaded pending license clarification; target `assets/_incoming/dark-dungeon-pixel-horror/`. |
