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

## Round two: tuning for Claude

`tools/playbot.ts` and `docs/tuning.md` cover 1,000 seeds per strategy on sim snapshot `ccb8f16`. Baiting wins 89.2%, mean winning fight 93.44 s (target 180–240); random and same-switch spam win 0%. No-repeat held. Return loop switch clearance is 19.22 px versus a 35 px player/surge hit reach: please review its final segment against SCOPE section 4's outside-live-lane rule. Report includes config-only experiments for your decision; no sim/config/visual files were edited. Pending sim fixes were not merged into this baseline; rerun after they land.

## Round two: browser smoke (2026-11-14)

Added `tools/smoke.mjs` and the single npm script `npm run smoke`. Setup on another machine: `npm ci`, `npx playwright install chromium`, `npm run build`, `npm run smoke`. Playwright 1.65.1 is the only new direct dependency (dev-only, pinned in the lockfile; it brings playwright-core). Chromium/headless shell and its FFmpeg helper installed in the user browser cache through Playwright; no sudo or system package manager was used. No browser binaries, node_modules or dist are committed.

The script serves existing `dist/` on an ephemeral loopback port under `/jam/` using Node's static server, then closes browser/server on success or failure. It fails for page/console/request/HTTP errors, an absent canvas, a first-key exception, failed context unlock, missing built WAVs, non-200 audio or invalid WAV headers. It writes `docs/shots/smoke.png` and a JSON result to stdout. It intentionally does not rebuild: run the build first.

Latest run passed: page 200, visible 1152×648 canvas, first E key caused no exception, browser AudioContext changed from suspended to running, all seven audio files returned 200 with RIFF/WAVE headers, zero console/page/network errors. Chromium emitted only GPU ReadPixels performance warnings. The first prototype of the smoke also required game-initiated WAV fetches and exposed the separate wiring gap below; the final check reports that gap explicitly rather than treating static availability as playback.

**For Claude:** this merged Game scene still never imports/calls `src/audio.ts`; none of the seven WAVs was requested by gameplay during the smoke. The resumed context belongs to Phaser, so it does not establish our ambience/relay playback. Please wire the calls described above in your scene work. The smoke's `gameRequestStatus` fields show this as null and it emits an integration warning. HTTP asset availability passes; audible in-game playback remains unverified.

Screenshot: [smoke.png](shots/smoke.png), inspected visually. It shows the current pre-overhaul dark industrial room, four red health pips at top left, five empty shock icons, three breaker diagrams around the lower/right edges, player at the lower-left breaker, green creature/windup near center-right, and a bright white surge with a blue light pool in the upper-left lane. This is the merged `ccb8f16` presentation, not Claude's incoming pixel-art overhaul.

Final checks: `node --check tools/smoke.mjs`, `npx tsc --noEmit`, `npm test` (19/19), `npm run build`, `npm run smoke` all passed. The seeded batch and diagnostic sweep were also run twice with identical output. All work is local on `cd-2`; nothing pushed and no pull request opened.
