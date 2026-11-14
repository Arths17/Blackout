# Credits

## Art

The White Hero sprites were supplied by the user's friends in `White_Hero_Complete_LibreSprite_Animations.zip` and preserved in `sid's work/public/hero/`. The user confirmed their authorship. Directional idle/walk, interaction, hurt, fall and victory frames are used. Dash and punch sprites remain reference material and add no new mechanics. No third-party license is inferred; this is user-supplied team art.

`tools/import_hero.py` records source hashes and converts the used hero frames from 32×48 to 16×24 with nearest-neighbor sampling, binary transparency and the cold neutral palette. `assets/src/hero.json` contains the resulting pixel grids. The source PNGs are unchanged.

The room, props, creature, lighting effects and stencil font are original project art. `tools/make_art.mjs` exports indexed PNGs from the 30-color master palette in `src/config.ts`; `tools/palette.json` is generated from it. The code and art pipeline were developed with AI coding assistance. No image-generation tool was used for this slice.

Ashgrove was consulted read-only for its palette discipline, authored sprite grids and stepped lighting. No Ashgrove art or code was copied. Sid's prototype supplied the coherent electrical-wave motion adapted to the existing routes; its mechanics remain separate in `sid's work/`.

The supplied office and root-monster images are preserved as references in Sid's prototype. They are not loaded by the production game: their square map / 256-pixel monster frames do not match this slice's grid, palette or actor scale. Their provenance has not been independently verified.

## Font

The 5×7 stencil bitmap alphabet is drawn in `tools/make_art.mjs` and exported as `public/assets/stencil.png` and `stencil.xml`. No external font dependency is used.

## Code

Phaser 3.90.0 (MIT), Vite (MIT), TypeScript (Apache-2.0), Vitest (MIT), Playwright (Apache-2.0, development only).

## Earlier sourcing

These are sourcing records; neither pack is currently included in the game.

| Pack | Author | Source | License / status | Checked |
| --- | --- | --- | --- | --- |
| Sci-Fi Facility Asset Pack | MurphysDad / HaywardMorihara | [itch.io](https://murphysdad.itch.io/sci-fi-facility), [OpenGameArt](https://opengameart.org/content/sci-fi-facility-asset-pack) | CC0 1.0; download blocked, not included | 2026-11-14 |
| Dark Dungeon: Pixel Horror Tileset | TinyPixelDev | [itch.io](https://tinypixeldev.itch.io/dark-dungeon-pixel-horror-tileset) | CC0 claim conflicts with redistribution prohibition; not downloaded or included | 2026-11-14 |
