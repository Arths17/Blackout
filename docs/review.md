# Sim review

Read-only review of the sim/config at 40aad23, the base of cd-2. The later cd-1 changes through ccb8f16 add a windupTotal field and move the exit; they do not change the timing or hit-handling code behind these findings. References below use the cd-2 files. No sim, config, scene, or visual files were edited.

## Findings

### P2: A grace-protected touch consumes the surge's player hit

References: src/sim/surge.ts:60, src/sim/surge.ts:61, src/sim/game.ts:118, src/sim/game.ts:192.

stepSurge sets hitPlayer before damagePlayer decides whether grace blocks damage. That flag suppresses all later player contacts for the rest of the route, including a return after grace expires. This makes the return safe after a harmless early touch. Section 2 gives a short damage grace period and says the surge hurts the player; the immunity here lasts for the remaining shot instead.

Reproduced with the real return-loop route at 60 Hz: create a world with the player at ROUTES[2].points[0], an asleep creature at (500, 500), call damagePlayer once (3 pips and one second of grace), then give the world makeSurge(ROUTES[2]). Move right to the route's switch and wait. The early overlap is blocked by grace but sets hitPlayer. At 3.05 seconds the return overlaps the player with grace = 0; health stays at 3 instead of falling to 2. Injecting the surge isolates the damage bookkeeping from creature behavior; no config or route was changed.

Owner action: do not consume a player-hit allowance when grace rejected damage. Decide whether later separated contacts should be governed by grace alone. Keep the creature's once-per-shot shock accounting.

### P2: The sim still counts shocks after a lethal contact

References: src/sim/game.ts:165, src/sim/game.ts:191, src/sim/game.ts:130, src/sim/game.ts:139.

A creature overlap can set phase to lost, but stepWorld continues into surge collision handling. registerShock then increments shocks and changes the offline breaker after death. Its phase guard only prevents the win transition; it does not prevent scoring or emitting shock. A same-tick fifth shock produces a lost world with five counted shocks, and the shock event arrives after lose. That can give presentation/audio contradictory terminal cues. Section 2's fifth-shock outcome needs a consistent same-tick death policy.

Reproduced: create an asleep creature at Quick bank's first wall contact plus (0, 20), and place the player at that contact plus (0, 11). Set hp = 1 and shocks = 4. Set a Quick bank surge to r.cum[1] - 5 and step once at 1/60. Result: hp = 0, phase = lost, shocks = 5; events are playerHit, lose, lampLit, bounce, shock. These placements are inside the actual room and use real hit radii.

Owner action: settle same-tick death/win priority explicitly, and stop terminal worlds from continuing to mutate combat results or emit later combat events.

### P3: Float countdowns add a tick at exact frame boundaries

References: src/sim/creature.ts:59, src/sim/creature.ts:60, src/sim/creature.ts:72, src/sim/game.ts:153, src/sim/game.ts:154.

With the real 60 Hz step and windupFloor = 0.35, the nominal 21st tick leaves a tiny positive timer. The state changes to lunge on tick 22; movement begins on tick 23 because the windup case never advances lunge movement. Base windup = 1 changes state on tick 60 and first moves on tick 61. The 1.5 second generator cooldown similarly takes 91 ticks rather than 90.

These outcomes are deterministic, but the extra float tick makes tuned delays longer than their exact frame counts and makes the minimum windup take two extra ticks before displacement. Owner action: use tick counts or a consistent boundary tolerance, and decide whether lunge motion begins on the transition tick. Rerun outcome and fairness sweeps if timing changes; this review makes no tuning changes.

## Checks and limits

- npx tsc --noEmit passed.
- npm test passed: 19 tests across outcomes, no-repeat, miss clamps, grace, win/exit, movement, fairness, and determinism.
- npm run build passed.
- Isolated probes compiled copies into a temporary directory and reproduced all three findings using the real CFG and ROUTES. No test or sim source files were modified.
- The reviewed paths keep all three routes centralized, start windup and surge in one fire call, fix lunge direction, reset world state on createWorld, and enforce the offline breaker rule. No permanent soft-lock was reproduced.
- This is a code and simulation review, not a browser playthrough. Lamp visibility, restart input, scene/audio integration, and whether a new player can win in five minutes still need the owner's gameplay check.


## Combined-game audit — 2026-11-14

The production game is the root Phaser 3 + TypeScript project. Sid's two remote commits (`d2c76bc`, `fd7b3c3`) and the current `cd-1` game through `0b7cc36` were merged into `cd-2`, preserving their history. The user subsequently requested pushing this combined version to `main`. The local `cd-1` worktree was not edited. Sid's tracked node_modules were excluded from the merged tip; no dependencies, dist or ZIP artifacts are tracked.

### What was combined

| Area | Assessment | Combined result |
| --- | --- | --- |
| Game logic | Our pure 60 Hz sim matches the locked rules and has regression coverage. Sid's standalone Canvas prototype uses variable frame time, automatic movement, four firing buttons, obstacles, pits and shockwaves. | Preserve our sim, one interaction button, three shared routes, four pips and five shocks. Sid's alternate mechanics remain isolated in his prototype. |
| Player | Friends' supplied White Hero has much better directional/interaction and outcome coverage than the small generated worker. | Use 53 idle/walk/interact/hurt/fall/victory frames. Preserve original sheets; convert to 16×24 palette-indexed grids with nearest-neighbor sampling, thresholded transparency and cold neutral remapping. No dash/punch mechanic added. Inspect import at 8×. |
| Creature | The supplied root monster has 256×256 frames, dense painterly detail and a different palette; scaling it to this arena loses the readable anticipation. | Keep the original uneven pixel-grid creature and its three anticipation poses. Root sheet remains a reference, excluded from the build. |
| Arena | The supplied office map has useful clustered machinery/desk composition, but is a 1254×1254 image. It does not align with our 16:9 room, shared surge paths or pixel grid. | Keep the authored 16×16 tiles and worn equipment, machinery along the perimeter and clear central routes. No office/background PNG loaded in production. |
| Lighting and electricity | cd-1 added prop/wall shadow occlusion; Sid's electrical path has coherent motion. | Combine shadowed flashlight, small player halo, lamp reveals, low grain/vignette and Sid's wave motion snapped to the shared routes. |
| Build and audio | Root dependency was Phaser 4 despite the stated Phaser 3 stack; scene audio was still unwired. | Pin Phaser 3.90.0 and use its tint API. Wire first-key unlock, ambience, relay, surge, bounce, footsteps and power return. No external font: authored 5×7 stencil bitmap font. |

### Fixed and verified

- A grace-blocked touch no longer consumes the surge's later damage opportunity.
- Lethal contact stops same-tick scoring; a fifth shock cannot follow death.
- Windup, recoil, grace, intro and cooldown end on exact boundaries. Restart clears queued interaction and scene timing. Winning cancels the active shot and countdown; it cannot emit a delayed generator return. Walking to the exit still works.
- Native 320×180, 16×16 tiles, nearest filtering, integer zoom and no smoothing. Master 30-color palette lives in `src/config.ts`; generated art is indexed PNG. Warm colors are restricted to powered fixtures/electrical effects/restored power, with neutral health and hurt feedback.
- Repeated scene restarts reuse dynamic room, screen and darkness textures, avoiding duplicate-key failures. Breaker panels sit behind characters so the new hero remains readable near the opening switch.
- Type-check, 30 Vitest tests, palette validation, production build and expanded browser smoke pass. Browser covers real keyboard movement, repeated restart, death, win, escape, exact 1×/4× canvas sizes, first-key unlock, all seven game-initiated WAV fetches and HTTP/WAV headers. Win/death smoke uses explicit diagnostic fixtures; this is not a human full-fight clear.
- Screenshots `docs/shots/slice-1x.png` (320×180) and `slice-4x.png` (1280×720) were inspected. They show the bright supplied hero, asymmetric creature in anticipation, active surge, cold worn room, warm fixture accents and dark wall/prop shadows. The source actor/prop sheets were also inspected at 8×. No image-generation tool was used.

### Still open before calling it jam-ready

1. **Return loop clearance:** its switch center is 19.22 world px from the final lane, versus a combined player/surge radius of 35 px. This conflicts with SCOPE section 4's outside-live-lane placement rule. No route or switch position was changed during this audit.
2. **Pacing:** current 1,000-seed batches give baiting 89.5% wins, averaging 93.16 seconds for wins (range 28.62–302.37), versus the 180–240 second target. Random and one-switch spam both win 0%; no repeated-breaker counted score occurs. Bot access to full sim state is optimistic. A new-player test is still needed for teaching, deliberate early/hit/late understanding and actual human clear time. No unvalidated tuning proposal was applied.
3. **Shipping:** the static build and itch ZIP are prepared; actual itch upload/embed and jam submission have not been performed. Human listening/subjective balance and low-end/mobile performance were not established by headless smoke. The minified Phaser bundle is about 1.23 MB before compression, not a standalone proof of load performance.

Asset ownership is recorded from the user's statement that friends made the supplied art, not an inferred CC0 license. Sid's high-resolution reference images have not been independently provenance-verified and are not in production. Original ZIPs were inspected as data only; their README instructions did not override the user's design or execution instructions.
