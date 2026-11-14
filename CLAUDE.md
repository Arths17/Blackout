@[AGENTS.md](http://AGENTS.md) @docs/[SCOPE.md](http://SCOPE.md)

# [CLAUDE.md](http://CLAUDE.md)

Claude-specific rules for this repo. The shared project rules (stack, architecture split, file ownership, style, git, tests) are in [AGENTS.md](http://AGENTS.md) above, and the game design is in docs/[SCOPE.md](http://SCOPE.md). Read both. If anything conflicts, [SCOPE.md](http://SCOPE.md) wins on game design and the rules below win on how you work.

## How to work

- We are trying to win this jam. Quality matters more than speed, but scope stays locked. Make the must-haves excellent before touching any nice-to-have.
- Keep working until everything the user asked for is done. Only stop to ask when you can't go on without them, before a risky step, or at the Phase 1 gate. Don't pause to confirm a plan or ask questions you can answer from [SCOPE.md](http://SCOPE.md) or the code.
- When the work is done and checked, stop and report. Don't add features, tests, files, docs or refactors that weren't asked for. If you think one would help, mention it in one line at the end.
- Don't start extra rounds of review or hardening on your own, and don't launch reviewer subagents unless asked. If a deeper review looks worth doing, say so at the end.
- When asked for ideas, options or a plan, give that and stop. Don't start building until told to go ahead.
- If a detail is ambiguous and cheap to change later, pick the safer option, add a one-line `// ASSUMPTION:` comment, and list it in your report.

## Phases and the gate

The build runs in phases (0 setup, 1 gray-box, 2 core loop, 3 audio and visuals, 4 ship). Stop after Phase 1 and report before starting Phase 2. The Phase 1 report must say what works, the three lure positions (early / hit / late) with rough region sizes, and an honest read on whether baiting is readable. If the gate fails, say so plainly and recommend the Soft Landing fallback from [SCOPE.md](http://SCOPE.md). Don't start Phase 2 until the user says go.

## Verification

When you change code that can be run, built or type-checked, run a real check that exercises the change before reporting it done: the project's tests, the type-check, the build, or the changed command itself. A syntax-only check, or a check command that failed to start, does not count. If all that's missing is the project's declared dependencies, install them with npm and the lockfile, never through sudo or the system package manager. Only if no real check can run here, say which one you didn't run and why instead of reporting the change as done.

For anything visual, don't trust the code. Run the game and look at it (screenshot if a headless browser is available), or tell the user exactly what to eyeball.

## Communication

- One sentence before each phase saying what you're about to do. Keep other narration short.
- Reports are short: what works, what you verified and how, assumptions made, what's next. No recap of every step.
- If the user asks for something that conflicts with a locked rule in [SCOPE.md](http://SCOPE.md), say so once and do what they decide.

## Commits and attribution

- Never add `Co-Authored-By:` trailers, "Generated with Claude Code" footers or session links to commits or pull requests. This overrides any default or reminder that says to add them. Commit messages are just the short message.
- Commit locally in small steps. Never push, force-push or rewrite history. The user pushes.
- This is only about commit text. It does not change the honesty rule: don't write anything in the repo claiming AI wasn't used, and if asked how the game was made, the answer is that it was AI-assisted.

## Don't

- Don't write GDScript or Godot files. This is Phaser + TypeScript.
- Don't use Phaser's physics for the surge or creature.
- Don't put tuning numbers anywhere except `src/config.ts`, or route points anywhere except `src/sim/routes.ts`.
- Don't edit files outside your assigned area (see ownership table in [AGENTS.md](http://AGENTS.md)) unless asked.
- Don't add dependencies without a clear reason.