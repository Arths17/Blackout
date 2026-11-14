# cd-2 handoff

Audio and shipping work is isolated in ../blackout-cd-2 on cd-2. I will not edit scenes, visuals, sim, or config.

## Audio calls for Claude

Call initAudio() and startAmbience() once during scene creation, before any player input. initAudio preloads all seven WAVs and installs a capture-phase keydown listener that resumes Web Audio on the first key. Both calls are safe to repeat on restart; the hum stays a single loop.

Import from src/audio.ts. play(name) takes the file stem: relay_click on a successful breaker throw, surge_crack when the surge fires, wall_crack on bounce, step_player and step_creature only when that actor actually takes a step, power_return on win. Do not play footsteps every render frame. Pass the current player-to-creature distance in pixels to setCreatureDistance(px), preferably before its next footstep.

A play call before the first key is discarded. The first key can also trigger the relay without losing its sound while resume finishes. Footsteps during initial loading are discarded to avoid a burst of queued steps. startAmbience can be called before unlocking and starts after that key and decoding.

Audio uses local mix levels and a 700 px attenuation range; no game tuning or config values were changed. File-stem sound names are the only API assumption. Scene wiring stays with Claude.

## Shipping

Vite already uses base: './'; it was preserved. npm run audio regenerates WAVs. npm run zip rebuilds and produces blackout-html5.zip, with index.html at the root and all seven WAVs in audio/. The ZIP script uses Node standard libraries. The archive passed unzip integrity checks and all built asset URLs loaded under /jam/ on a plain static server. README.md and docs/itch_page.md contain controls, build steps, page copy, and the lamp-flash/return-surge capture plan. No screenshots or GIF have been captured.

## Sim review for Claude

See docs/review.md for three reproduced findings against the shared sim base: a grace-blocked early contact sets surge.hitPlayer and makes a later return harmless; lethal creature contact can emit lose and then count a same-tick fifth shock; float countdowns take 22 ticks at the 0.35 s windup floor and 91 ticks for the 1.5 s cooldown. All 19 existing tests pass. No sim/config files were changed. The review notes the later cd-1 windupTotal/exit changes and uses base file line numbers.

## Round two: art sourcing (2026-11-14)

No art was drawn, edited, recolored, sliced or installed. Neither requested pack was downloaded. Empty target directories were prepared locally; Git does not preserve empty directories.

- Sci-Fi Facility Asset Pack, MurphysDad: https://murphysdad.itch.io/sci-fi-facility . CC0 1.0 Universal verified on the author page and CC0 on the author's OpenGameArt upload: https://opengameart.org/content/sci-fi-facility-asset-pack . Target: `assets/_incoming/sci-fi-facility/`. The public file link https://opengameart.org/sites/default/files/sci-fi-facility-asset-pack.zip returned “Failed to fetch restricted URL” through the web tool. No download workaround attempted. The itch download page needs an interactive free-download step. Human: download the original archive into the target folder; leave it unprocessed for Claude. OpenGameArt groups it under 16×16 tiles; actual dimensions and file inventory still need archive inspection.
- Dark Dungeon: Pixel Horror Tileset, TinyPixelDev: https://tinypixeldev.itch.io/dark-dungeon-pixel-horror-tileset . Target: `assets/_incoming/dark-dungeon-pixel-horror/`. Source explicitly describes 16×16 and says CC0 / Public Domain, but the same license section says “Do NOT resell or redistribute as-is (including asset bundles)”. This contradicts unrestricted CC0 redistribution, so do not download or commit originals until the author clarifies. Listed archive: `TinyPixelDev -Dark Dungeon Pixel Horror Tileset.zip`, 89 kB. The itch download page also uses an interactive free-download step. Full sourcing status is in `assets/LICENSES.md` and `CREDITS.md`.

### Creature shortlist

Both free asset licenses checked on their own source pages on 2026-11-14; these are recommendations only, not downloaded.

| Option | License | Fit and limits |
| --- | --- | --- |
| [Animated Monsters — stealthix](https://opengameart.org/content/animated-monsters) | CC0, explicit unrestricted use; attribution optional | **Recommended:** zombie/skeleton/witch sheets with idle, walk, punch, hurt and fall. Existing attack and hurt states give Claude material for a visible windup and recoil with minimal animation work. 16×16-style collection and compact pixel palette; verify actual frame bounds after download. Direction coverage is not specified. |
| [16×16 DungeonTileset II — 0x72](https://0x72.itch.io/dungeontileset-ii) | Assets CC0 1.0 Universal; code separately MIT | Small animated monster characters with a readable silhouette; 16×16 base grid, some characters taller. Author shows a running zombie. Good visual fallback, but the author confirms no attack/death animation in the base pack, so extra animation work would fall to Claude. Only the base pack is covered by this check; linked community extensions need separate verification. |
