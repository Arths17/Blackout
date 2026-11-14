# Headless tuning report

2026-11-14. Sim/config snapshot: `cd-1` commit `ccb8f16`, merged into `cd-2` as `2ba8392`. Claude's three pending sim fixes are not present in this snapshot. No sim, config, scene, or render files were edited for this report.

Run with Node 25.8.1: `node tools/playbot.ts 1000 1`. No runner dependency is needed. Node must support native TypeScript stripping and `module.registerHooks` (tested on Node 25). The optional arguments are games per strategy and first seed. JSON goes to stdout, so a later run can be captured without adding repo artifacts.

## Method

1,000 games for each strategy, seeds 1–1,000; 60 Hz using the real config/routes, normal health, cooldowns and interaction range. Every game starts from `createWorld()` without repositioning actors. Inputs go through `stepWorld` and `tryInteract`; no direct live-world mutation, injected surges or remote breaker firing. A ten-minute cap counts as a timeout, not a death. No game reached it. Two complete runs produced byte-identical JSON.

- Random: chooses room waypoints or switches every 1–5 seconds, walks directly, randomly interacts at 5 Hz. No dodging or shot timing knowledge.
- Baiting: opens on Quick bank, draws the creature across the room toward other switches, leaves offline switches, and fires when a detached sim forecast predicts a hit. It chooses among 16 movement directions to avoid nearby creature/lunge/surge lanes. Changes destination after an unproductive wait. This is an optimistic full-state timing bot, not a model of a new player or a separate scripted teleport setup. Forecast assumes the player stays still during the shot, whereas live dodging changes subsequent stalking; misses remain possible, especially on Return loop.
- Spam: walks to one assigned switch and interacts at 60 Hz while standing there. Runs are split evenly across all three breakers (334/333/333). This policy has no random decisions; its repeated seeds are repeated controls, not independent behavior samples.

Fight ends at the fifth shock or death; winning times exclude walking to the exit, intro screens, rendering hit-stop and human deliberation. Average observed length mixes wins/deaths and must not be used as clear time.

## Fight length and outcomes

Target: 180–240 seconds for a completed fight.

| Strategy | Wins | Deaths | Timeouts | Observed mean seconds (range) | Winning mean seconds (range) | Death mean seconds (range) |
| --- | --- | --- | --- | --- | --- | --- |
| random | 0.0% | 100.0% | 0.0% | 12.02 (4.52–30.97) | — | 12.02 (4.52–30.97) |
| baiting | 89.2% | 10.8% | 0.0% | 89.63 (18.52–255.22) | 93.44 (28.62–255.22) | 58.17 (18.52–193.33) |
| spam | 0.0% | 100.0% | 0.0% | 7.64 (7.23–7.97) | — | 7.64 (7.23–7.97) |

Baiting wins average 93.44 seconds, 86.56 seconds below the lower target, and need 10.79 accepted shots on average. Random players die in 12.02 seconds, so there is also a large learning/survival gap. Bot timing does not establish human clear time: validate with an outsider before making a large pacing change.

## Breaker use and scoring

Each cell lists **interaction attempts / accepted shots / counted shocks / offline rejections**. Attempts count only inputs in range of a switch. Busy and cooling rejections are included in attempts but not offline rejections: `fire` checks those before offline. Counted shocks are not the same as completed shots; a fight can end during an active surge. Miss rate is therefore not computed as 1 − shocks/shots.

| Strategy | Quick bank (0) | Cross-room (1) | Return loop (2) |
| --- | --- | --- | --- |
| random | 8343 / 1010 / 967 / 2835 | 4480 / 516 / 119 / 108 | 3505 / 462 / 134 / 25 |
| baiting | 2248 / 2248 / 2248 / 0 | 1473 / 1473 / 1473 / 0 | 6624 / 6624 / 1062 / 0 |
| spam | 154642 / 334 / 334 / 81830 | 100899 / 333 / 333 / 21312 | 70596 / 333 / 333 / 0 |

Baiting sends 64.0% of accepted shots to Return loop, but only 22.2% of its counted shocks come from it (1,062/6,624, 16.0% shocks per accepted shot). Quick bank contributes 47.0% of shocks; Cross-room contributes 30.8%. Their forecast-selected shots all score in this run. These are policy-dependent numbers, not an intrinsic ranking of the routes.

Offline results: random 2,968/16,328 in-range attempts (18.2%); baiting 0/10,345 (0%, deliberately avoids offline switches); spam 103,142/326,137 (31.6%). There were zero consecutive counted shocks from the same breaker and zero counted shocks after death in these runs. This does not disprove the known terminal-ordering bug; its targeted regression remains necessary.

## Spam and fairness

Spam won **0/1,000** games. Each game accepted exactly one shot, scored one shock, and died before a second successful breaker could re-enable its chosen switch. No finite winning shot count was observed; with five shocks required and no-repeat intact, this one-switch policy cannot win. Return loop spam had zero offline-result events because it died while the first shot/cooldown still made inputs busy/cooling. That is not a no-repeat bypass.

A separate position sweep fired each breaker from its switch for 594 creature starts on a 30 px grid, using normal health and no actor reset during a shot. “Leave” walks toward room center; “camp” stands at the switch immediately after firing. This checks location dependence, not an entire fight or the existing test's pre-fire stalking setup.

| Breaker | Leave: hits / starts | Camp: hits / starts | Camp: damage-free hits | Switch center to nearest live lane | Player + surge radius |
| --- | --- | --- | --- | --- | --- |
| 0 | 181/594 (30.5%) | 185/594 (31.1%) | 167/594 | 85.44 px | 35 px |
| 1 | 119/594 (20.0%) | 119/594 (20.0%) | 96/594 | 67.08 px | 35 px |
| 2 | 94/594 (15.8%) | 447/594 (75.3%) | 0/594 | 19.22 px | 35 px |

- All breakers have both hit and miss starts, satisfying the position-dependence check. Quick bank: (396,64) hits, (96,64) misses; Cross-room: (486,64) hits, (96,64) misses; Return loop: (96,64) hits, (216,64) misses, under the leave policy.
- **Fairness flag for Claude:** Return loop's switch is only 19.22 px from its final segment, inside the 35 px combined hit radius. This conflicts with section 4's “switches just outside their live lanes” rule. Camping there produced no damage-free hits in the sweep. Its route/switch clearance needs Claude's review; increasing grace would not fix that geometry. No route or switch was changed here.
- No one-breaker whole-fight win or repeated counted shock occurred. Return loop's high single-shot camping hit rate (75.3%) does not allow five shocks from it alone.
- Grace behavior still needs the existing targeted tests and Claude's pending return-contact fix. Aggregate play statistics cannot prove one mistake cannot consume several pips.

## Suggested config experiments for Claude

These are untested proposals, not applied changes. Keep five shocks and four pips, and keep `windup: 1.0`, `surgeSpeed: 650` and `surgeHitRadius: 24` initially to preserve the learned opening timing. Resolve the Return loop clearance separately rather than shrinking every shot's hitbox to hide one switch problem.

1. For pacing, try `generatorCooldown: 1.5 → 4.0` and `cooldownMax: 3.5 → 6.0`, leaving `missCooldownAdd: 0.6`. The extra 2.5 seconds per recovery adds roughly 24 seconds over 10.79 winning shots if every recovery is binding; travel can overlap recovery, so the actual gain may be smaller. This alone will not reach 180–240 seconds. Do not immediately multiply cooldowns until an outsider confirms the fight is short; long forced waits could spoil the setup/dodge loop.
2. For learning survival, try `creatureStalkSpeed: 130 → 115`, preserving `playerSpeed: 220`. The speed gap rises from 90 to 105 px/s, giving more room to reposition after a miss. Keep lunge direction and speed fixed. This can change post-lunge hits and also make expert clears faster; rerun the bot and fairness sweep before accepting it.
3. If consecutive misses still collapse attempts too quickly, try `missWindupReduction: 0.08 → 0.04` and `windupFloor: 0.35 → 0.55`. The miss cost remains, but setup timing erodes more gradually. Base windup stays 1.0. This chiefly helps after multiple misses, so assess random survival and Return loop baiting rather than expecting a direct fight-length fix.

Rerun outcome, no-repeat, clamps, fairness, grace, determinism, type-check and build for any accepted number change. This report's results are a baseline; none of the proposed values has measured validation yet.

## Verification

`npx tsc --noEmit`, `npm test` (19/19), and `npm run build` passed after `npm ci` installed the font already present in the merged lockfile. The first build attempt had failed because that dependency was missing from this worktree; no source fix was needed. The 3,000-game bot batch plus position sweeps ran twice identically. Tools run headlessly in Node without Phaser or browser imports.
