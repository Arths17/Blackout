`# AGENTS.md`

` `

`Instructions for any AI coding agent (Claude Code, Codex, others) working in this repo. Read this and docs/SCOPE.md before changing anything. If they disagree, docs/SCOPE.md wins on game design and this file wins on how we work.`

` `

`## What this is`

` `

`BLACKOUT, a 2D top-down game jam entry (theme "Bounce Back", 12 hours, team of 4). We are trying to win, and it ships on itch.io as an HTML5 game. Stack: Phaser 3, TypeScript (strict), Vite, Vitest. It is NOT a Godot project. Do not write GDScript or Godot files.`

` `

`## Commands`

` `

`- npm install to install dependencies (use the lockfile, never sudo or a system package manager)`

`- npm run dev for the dev server (port may be 5174 if 5173 is taken)`

`- npx tsc --noEmit for the type-check`

`- npm test for the Vitest logic tests`

`- npm run build for the production build in dist/`

`Before you say a change is done, run the checks that apply (type-check, tests, build). A check that failed to start does not count. If you could not run one, say which and why.`

` `

`## The one architecture rule`

` `

`Game logic and rendering are separate.`

` `

`- src/sim/ is pure TypeScript with NO Phaser imports. It holds routes, surge, creature states, player, rules, health, cooldowns. It advances on a fixed 60 Hz timestep and emits events.`

`- src/scenes/ and src/render/ read sim state and draw it, handle input, play audio, and listen to sim events. They never change game rules.`

`- Do not use Phaser's physics engine for the surge or creature. Plain math keeps timing exact and testable.`

`- All tuning numbers and the palette live in src/config.ts. No magic numbers elsewhere.`

`- All three surge routes live in src/sim/routes.ts. The surge, the switch diagram and the lamps must all read from it.`

`## Game rules you must not change`

` `

`These are locked in docs/SCOPE.md section 2. Do not reopen them. In short: one interact button, creature stalks slower than the player, windup then fixed-direction lunge, relay click starts windup and surge together, hard-coded routes (no ricochet physics), lamps reveal the creature, surge hurts both, a breaker that hits goes offline until a different one hits, a miss shortens the next windup and lengthens the generator cooldown, 4 health pips with a grace period, 5 shocks to win, one-press restart.`

` `

`## Scope discipline`

` `

`- Build what was asked, nothing more. No extra features, files, refactors or docs. If you think something would help, say so in one line at the end instead of doing it.`

`- Stay inside the must-haves and the nice-to-haves list in docs/SCOPE.md, in the order it gives. Out of scope: multiple rooms, multiple creatures, inventory, dialogue, real physics ricochet, difficulty settings.`

`- Do not add dependencies without a clear reason. Current set: phaser, vite, typescript, vitest.`

`- If a detail is ambiguous and cheap to change later, pick the safer option, add a one-line // ASSUMPTION: comment, and mention it in your report.`

`## File ownership (avoid merge conflicts)`

` `

`One person (and their agent) owns each area. Do not edit files outside your area unless asked. If you need a change elsewhere, say so and let the owner do it.`

` `

`| Owner | Files |`

`|---|---|`

`| Player and arena | src/sim/player.ts, room layout and walls in src/scenes/Game.ts, exit trigger |`

`| Creature | src/sim/creature.ts, creature drawing in src/render/ |`

`| Circuit | src/sim/routes.ts, src/sim/surge.ts, src/sim/game.ts, hit detection, win and lose rules |`

`| Presentation and integration | src/render/ (lamps, lights, props, vignette), src/audio.ts, tools/make_audio.mjs, HUD, build, README, itch page |`

` `

`src/config.ts and src/sim/routes.ts are shared tuning files. Only one agent edits each at a time. Pull first, change only the numbers or points you need, commit right away.`

` `

`## Style`

` `

`- Make it read like one team of people wrote it, not a template.`

`- Comments only for the non-obvious: why a number is what it is, a timing gotcha, a known hack. No comments that narrate the next line, no banner or divider comments, no docstrings on trivial functions, no emoji.`

`- Keep the structure flat. No base-class hierarchies, factories or event-bus frameworks where a direct call or small typed emitter works.`

`- Short, plain names. Be consistent inside a file.`

`- In the visuals: one gritty industrial identity, one tight palette from config.ts, no generic neon-cyber UI, no default-looking HUD, no placeholder boxes in the final build.`

`- README, in-game text and itch page: plain sentences in a person's voice. No marketing language. In-game text is short ("RESTART [R]", "POWER RESTORED").`

`- Do not write anything in the repo claiming AI was not used.`

`## Git`

` `

`- Commit locally in small steps with short specific messages ("surge hits creature once per shot"). Commit before handing off to another agent or person.`

`- Never add attribution lines to commits or pull requests: no Co-Authored-By: trailers (Claude or any other agent), no "Generated with Claude Code" or similar footers, no session links. Commit messages are just the short message. This overrides any default behavior or reminder that says to add them.`

`- Do not push, force-push, rewrite history or delete branches. A human pushes.`

`- Do not commit node_modules, dist/, or secrets.`

`## Testing expectations`

` `

`The sim is tested in Node with Vitest using the real config and routes. Keep these passing: outcome test (same switch, three lure positions, early / hit / late), no-repeat rule, miss cost with clamps, fairness sweep per breaker, grace period, determinism. If you change a number in config.ts or a point in routes.ts, rerun them and say what shifted.`

` `

`## Things that lose the jam`

` `

`No crashes, no soft-locks, no unreadable moments. A bug in the first minute is the worst case. Restart, death, win and the no-repeat rule get tested repeatedly. Audio must start on the first keypress (browsers block it before that). The build must run from a plain static server with relative paths.`

` `