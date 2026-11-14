# BLACKOUT: Full Scope

Game jam (Nov 14-15, 2026), theme **"Bounce Back"**. Phaser 3 + TypeScript (Vite, built in VS Code), 2D, team of 4, about 12 hours.

**Status:** planning only. Nothing was built when this was written.

> Engine note: the original plan said Godot. We switched to Phaser 3 + TypeScript + Vite so the game runs in the browser and uploads to [itch.io](http://itch.io) as an HTML5 zip. Everything else in this document is unchanged.

## 1. Pitch and theme tie

You are trapped in a dark maintenance room with a creature. Each of three breakers fires a surge that bounces off the walls and lights the room in flashes. Lure the creature into the surge's path, then get out of the way before the surge bounces back toward you. Five successful shocks kill it, the generator holds, and the exit unlocks.

**Why it fits "Bounce Back":** the surge physically ricochets, and its return leg is a threat to the player. Bounce is the core mechanic, not a pun on the title.

**Moment to nail:** you throw the return-loop breaker. The first flash shows empty floor, the second catches the creature mid-lunge, then the lamps beside your own switch start lighting in order and you realize the surge is coming back at you.

## 2. Locked rules (do not relitigate)

- Controls are movement plus one interact button. Single top-down screen.
- The creature stalks slower than the player runs, so you can open a gap.
- Throwing a breaker makes the creature stop, turn toward that breaker, wind up visibly, then commit to a lunge to the breaker's position. Once the lunge starts, its direction is fixed.
- The relay click starts the creature's windup and the surge together. Lunge delay and surge speed are constant, so outcomes are learnable and repeatable.
- Each breaker's route is a hard-coded list of points with 2-3 wall contacts. The same list drives the breaker diagram, the traveling hitbox, and the lamps. No simulated ricochet physics unless time is left over.
- Each passing lamp briefly reveals the creature, so players can see whether it crossed too early or too late.
- The surge hurts the creature and you.
- A breaker that lands a hit goes offline (dead lamp, distinct switch position) until a different breaker lands the next hit, so you can never use the same breaker twice in a row.
- A miss has a cost: the creature's next windup is a bit shorter, and the generator takes longer to come back.
- Health is 4 pips with a short grace period after damage. Five shocks win (tuning knob, see section 5). Restart is one press and puts you near the first breaker.

## 3. Scope

### Must have

- One rectangular room with a locked exit, three breakers, and three hard-coded surge routes.
- Player movement and one interact button.
- Creature that stalks, winds up, lunges, and recoils when hit.
- Surge traveling its route at fixed speed, with lamps lighting as it passes.
- Health pips, five-shock win, one-press restart.
- No-repeat breaker rule (a breaker that just hit goes offline until another breaker hits), plus the miss cost.
- Win payoff: lights stay on, exit opens.
- Sound: relay click, electrical crack, footsteps, low ambience loop.
- Working web build, code pushed to GitHub, game submitted at hack.club/submit.

### Nice to have (only after all must-haves work)

- Three-snapshot lamp reveal as the opening moment.
- Wall-crack flashes and screen shake on each bounce.
- Windup getting slightly shorter after each hit.
- Title screen and clear-time end card.
- One breaker's route changing after each hit.

### Cut in this order if time runs short

1. Windup speed changes between hits.
2. Title screen and clear-time card.
3. Route change after each hit.
4. Opening sequence.
5. Third route (two good routes are enough).

**Never cut:** the bounce itself, the lamp reveals, the sound, the exit payoff.

### Out of scope

Multiple rooms, multiple creatures, inventory, dialogue, real physics ricochet, difficulty settings.

## 4. Design spec

### Round flow

1. **Blackout.** Overhead lights off. Emergency strips keep walls, switches, and lanes readable. The creature stalks you; footsteps give away roughly where it is.
2. **Set up the shot.** Walk so the creature trails you into the part of the room you want, then reach a breaker.
3. **Throw the breaker.** The relay clicks. The creature winds up and lunges at the breaker; the surge starts along its route.
4. **Dodge.** The surge banks off 2-3 walls, each segment lighting briefly. It hurts whatever it touches, including you on a return leg.
5. **Recover.** The generator trips after the surge finishes. The creature keeps damage taken. Reposition and repeat.

### The three breakers

| Breaker | Route | Use it when |
| --- | --- | --- |
| Quick bank | Two tight bounces near one end of the room | The creature is close and you have room to step clear |
| Cross-room | Three long segments sweeping across the center to the far wall | You can fire early enough to catch the creature crossing |
| Return loop | A wide route that swings back near its own switch | You can bait the creature toward the relay and leave before the surge loops back |

### Creature

One readable creature with four states: stalk, windup, lunge, recoil. The windup must be visible with sound off. Behavior stays predictable as pressure rises.

### First hit teaches the game

Start the creature where its first lunge can cross the opening surge's second leg. For the remaining hits, the player has to create that crossing themselves.

### Fairness rules

- The same breaker must be a good or bad choice depending on where the creature is. If standing at one switch and pressing it every cycle always wins, change its route or move the switch.
- Place switches just outside their live lanes so players have room to dodge.
- Grace period after damage so one mistake cannot drain all four pips.

## 5. Tuning knobs

| Knob | Why it matters |
| --- | --- |
| Creature stalk speed vs. player speed | Must leave a gap, or there is no setup time |
| Windup length | Too short is unfair, too long is boring |
| Lunge speed and distance | Decides where the creature is when the surge arrives |
| Surge speed along each route | Decides the timing window for a hit |
| Grace period after damage | Prevents chain damage |
| Miss cost | Prevents spam-until-it-hits |
| Shocks to win (start at 5) and health pips (start at 4) | Fight length; aim for 3-4 minutes and adjust after playtests |

### Gray-box prototype test (first 2-3 hours)

Build one breaker with a two-bounce path and a placeholder creature. From the same switch, set up three outcomes by changing where you lure the creature before firing:

1. It crosses too early.
2. The second leg hits it.
3. It crosses too late.

**Pass condition:** a teammate can explain all three outcomes after watching, and can deliberately repeat the hit. If baiting is not fun and readable by hour 3, fall back to Soft Landing (section 9).

## 6. Team roles

| Owner | First deliverable |
| --- | --- |
| Player and arena | Movement, switch interaction, room layout, exit trigger |
| Creature | Stalking, breaker reaction, telegraphed lunge, recoil, death |
| Circuit | Restart timing, route-following surge, lane hit detection, five-shock win condition |
| Presentation and integration | Lamp sequence, electrical audio, exit payoff, playtesting, build and submission |

## 7. Timeline (12 hours)

| Hours | Goal |
| --- | --- |
| 0-1 | Project and repo set up, room blockout, player moving, art style agreed |
| 1-3 | Gray-box test: one breaker, one route, placeholder creature |
| Hour 3 | **Gate:** if baiting is not fun and readable, switch to Soft Landing |
| 3-6 | Breakers 2 and 3, health, no-repeat rule, five-shock win, exit, lamp reveals |
| 6-8 | Real art in, creature animation, main audio pass |
| 8-10 | Playtest with outsiders, tune timing, first-hit setup |
| Hour 10 | **Feature freeze** |
| 10-11 | Juice, bug fixes, web build test, itch page |
| 11-12 | Submission buffer |

## 8. Art, audio, and rules

- Dark palette with emergency-strip accents and flash-white surges keeps art cheap. Silhouettes are enough for the creature if the windup reads clearly.
- Sound carries most of the horror: relay click, rising crack on the surge, wall cracks per bounce, footsteps, low hum, and the same power-return sound at the end when the lights stay on.
- The web build must run from a static server with relative asset paths (Vite `base: './'`), so it works inside an [itch.io](http://itch.io) HTML5 embed. Keep visuals simple 2D drawn in code.

## 9. Risks and fallback

| Risk | Mitigation |
| --- | --- |
| Creature stays on your heels, no setup time | Slower stalk speed; breakers placed so the creature's trailing position can sit in a route |
| Surge and lunge timing feels arbitrary | Constant delay and speed; lamps reveal the creature as the surge passes |
| One breaker solves the whole fight | No-repeat rule; miss cost; optional route change after each hit |
| Ricochet behavior gets expensive | Hard-coded route points shared by diagram, hitbox, and lamps |
| Fight length feels wrong | Shock count is a tuning knob (starts at 5, aim for a 3-4 minute fight); first hit teaches timing |
| Prototype fails the hour-3 test | Fall back to Soft Landing: a platformer where each death leaves a bounce pad (last 3 stay), which is the lowest-risk option from the research |

## 10. Definition of done and submission

- A teammate who has not seen the game can win it in under 5 minutes and explain why each hit or miss happened.
- The web build runs from the itch page.
- Code is pushed to GitHub and the game is submitted at hack.club/submit (needed for the T-shirt).

### Theme blurb (rewrite in your own voice)

Blackout turns "Bounce Back" into a decision you make with a switch. Each breaker fires a surge that ricochets around a dark maintenance room, lighting it in flashes. Set up the creature where the surge will be two bounces from now, then make sure you are somewhere else, because the same surge can bounce back for you.