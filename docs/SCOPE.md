# BLACKOUT scope

BLACKOUT is a single-screen top-down horror game for the “Bounce Back” game jam. The player is trapped in an industrial maintenance room with a creature and must use three breaker routes to bounce electrical surges into it. A surge follows a fixed route, lights lamps as it travels, and can hurt both the creature and the player. Five valid shocks open the exit.

## Locked rules

- Move in eight directions with WASD or the arrow keys.
- Press E or Space to throw a breaker. Press R to restart.
- The creature stalks, winds up, lunges in a fixed direction, and recoils.
- A relay click starts the creature windup and surge at the same time.
- Routes are hard-coded point lists. The same routes drive diagrams, lamps, and swept surge hit detection.
- The creature can be hit once per surge. The player can also be hit once per surge.
- A breaker that scores a hit cannot score the next hit.
- Misses shorten the next windup and lengthen the generator cooldown.
- The player has four health pips and a short damage grace period.

## Technical scope

The browser game uses Phaser 3, TypeScript, Vite, and Vitest. Simulation modules contain timing, routes, state, and hit detection without Phaser imports. The scene uses a fixed 60 Hz accumulator and renders the room and simulation state. The visual identity is a grimy industrial room with a near-black blue palette, emergency red, surge-white, sickly creature green, and warm restored-light color.

Phase 1 is the gray-box gate: one Quick bank route, lamps, surge, creature states, recoil, and a real-simulation outcome test showing early, hit, and late lures. Later phases add the remaining breakers, health and win loop, audio, visual polish, and itch.io packaging.
