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
