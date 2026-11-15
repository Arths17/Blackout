# BLACKOUT

The power is out, the door is sealed, and the only weapon in the room can hurt you too.

BLACKOUT is a short top-down browser game made for a jam with the theme "Bounce Back". You are locked in a dark maintenance room with a creature. Three breakers on the walls each fire a surge of electricity along a fixed line across the floor. The surge ricochets off the walls, lamps flash as it passes, and each flash shows where the creature is. The surge hurts whatever it touches, so the bounce that shocks the creature can also come back for you. That is the theme: the bounce is the weapon and the danger.

Play it on itch.io: **[ITCH.IO LINK GOES HERE]**

## How to play

The wardens of the Thornwood were trees once. The Rot came down the power lines and turned them. You are trapped in the station with five of them, one room at a time, and the only way out of each room is to get the generator to hold.

Goal: land enough shocks on the creature to keep the lights on, then walk out through the exit door in the top right corner. Do that in five rooms.

Rules:

- The creature stalks slower than you run. You can always open a gap and set up a shot.
- Each breaker has a line drawn on the floor in its own color, with its number at the start. Throwing a breaker sends a surge down that line.
- Throwing a breaker makes the creature stop, wind up and lunge at that breaker. The wind-up is the same length every time in a room, so a hit that worked once will work again.
- The surge hurts you as well. Stay off the line while it is live.
- A breaker that lands a hit goes offline until a different breaker lands one. You cannot use the same breaker twice in a row.
- A miss costs you. The creature stalks faster, its next wind-up is shorter, and the power takes longer to come back. A hit clears the penalty.
- You have five health pips. After you are hurt you cannot be hurt again for one second.
- From room 2 on the creature also lunges at you by itself. From room 3 on it spits seeds that bounce off the walls.

Controls:

| Key | What it does |
| --- | --- |
| WASD or arrow keys | Move |
| 1, 2, 3 | Throw that breaker from anywhere in the room |
| E or Space | Throw the breaker whose panel you are standing next to |
| F (or 4) | Parry the creature's touch or a seed |
| Shift | Short dash |
| R | Restart the room |
| Esc | Pause, and open the options |
| Enter | Continue on the chest and results screens |

Click the game once so it has the keyboard. Sound starts with the first key press.

The pause screen has three options, changed with the arrow keys: volume, screen shake (full, low, off) and flashes (full, reduced). They are remembered between visits when the browser allows it.

## Tips for a first run

- Do not chase it. Stand still on the far side of a line and let it walk onto the line.
- In room 1 a `[1]`, `[2]` or `[3]` appears over the creature when it is standing on a line that will hit. Press that number. Later rooms do not show this.
- After you throw a breaker the creature stands still for a moment. That pause is what lets the surge reach it. The pause is shorter in every room, so later you have to throw earlier or catch it near the start of a line.
- Look at where you are standing before you throw. Each line crosses the room two or three times.
- When the creature knocks you back you bounce around the room for a couple of seconds. If you hit the creature on the way, that counts as a shock.
- Two parries in a row, without being hurt in between, turn you into a bigger yellow super ball. It flies further than a normal bounce and does double damage if it hits the creature. Parrying is optional. You can win without it.

## Run it locally

You need Node.js 22.15 or newer (we used 25.8) and npm. The build also runs `tools/check_palette.py`, which needs Python 3 with Pillow (`pip install pillow`).

```sh
npm install
npm run dev
```

Open the address Vite prints, normally http://localhost:5173/. If that port is taken Vite picks the next one and prints it.

If something goes wrong:

- `npm install` fails or the game shows a blank page after pulling: delete `node_modules` and run `npm ci`.
- The page is blank when you open `index.html` from the file system: that does not work. Use `npm run dev` or `npm run preview`.
- No sound: click the game and press a key. Browsers block audio until then.
- Keys do nothing: click the game. In an embed the page keeps the keyboard until you do.

Useful while working on it:

- `?level=3` in the address starts in room 3 (1 to 5).
- `?notitle=1` skips the title screen.
- `?slow=0.25` runs the game at quarter speed.

## Checks

```sh
npm run typecheck   # tsc --noEmit
npm test            # Vitest, game rules only, no browser
npm run build       # production build in dist/
npm run smoke       # plays the first seconds of dist/ in headless Chromium
```

`npm run smoke` needs Playwright's Chromium once: `npx playwright install chromium`. It fails on any console error, failed request, or request that leaves the build folder.

`node tools/playbot.ts 200` plays 200 games per room with five fixed strategies and prints win rates. We use it after every tuning change. A strategy that stands still, spams breakers or mashes parry should stay at 0%.

## Build and upload to itch.io

```sh
npm run zip
```

This runs the build and writes `blackout-html5.zip` in the project folder, with `index.html` at the root of the zip. itch.io needs it at the root. If it is inside a folder the page will not load.

On itch.io:

1. Create a project and set "Kind of project" to HTML.
2. Upload `blackout-html5.zip` and tick "This file will be played in the browser".
3. Set the viewport to 1152 x 648. The game is 384 x 216 and is scaled by a whole number of screen pixels, so 768 x 432 also fits exactly. Other sizes work but leave a border.
4. Turn on the fullscreen button.
5. Open the page, click the game, and check that the first key press starts the sound.

All paths in the build are relative and nothing is loaded from another site. To look at the production build before uploading, run `npm run preview`.

## Project structure

```
index.html            page shell, loads src/main.ts
src/
  main.ts             creates the Phaser game, scales the canvas, loads options
  config.ts           every tuning number and the color palette
  settings.ts         volume, shake and flash options, saved in localStorage
  audio.ts            Web Audio: effects, hum, music, volume
  progress.ts         which room you are in, times and coins for the run
  lore.ts             the story text for each room
  sim/                game rules. Plain TypeScript, no Phaser, fixed 60 Hz step
    game.ts           the world: throwing breakers, hits, misses, health, win and lose
    creature.ts       creature states: stalk, wind-up, lunge, recoil
    player.ts         player movement
    routes.ts         the three surge lines, as lists of points
    surge.ts          the surge moving along a line and what it touches
    coins.ts          coins for clearing a room quickly
  scenes/             Phaser scenes: Boot, Title, Game, Chest, Finish
  render/             everything drawn in the Game scene
    darkness.ts       the dark and the lights that cut into it
    fx.ts             surge trail, sparks, arcs, lamps, seeds
    paths.ts          the three lines on the floor
    hud.ts            health, status line, pop-up notes, how-to and pause panel, end banners
    creature.ts, player.ts, panels.ts, room.ts, ...
tests/                Vitest tests for the rules in src/sim
tools/
  make_art.mjs        draws the sprite sheets and the font into public/assets
  make_audio.mjs      generates the sound effects into public/audio
  shrink_monster.py   makes the game copy of the tree monster sheet
  import_hero.py      converts the hero sprites
  check_palette.py    fails the build if art uses a color outside the palette
  playbot.ts          headless balance bot
  smoke.mjs           headless check of a built copy
  zip_dist.mjs        packs dist/ into the itch.io zip
public/               files copied into the build as they are (sprites, audio)
assets/src/           source art that is not shipped
docs/                 planning notes from the jam. Some of them describe earlier versions
```

The one rule we kept: `src/sim` never imports Phaser and never draws. The scenes and `src/render` read the world and draw it. That is why the rules can be tested without a browser.

## Tuning

All balance numbers are in `src/config.ts`. Change a number, run `npm test` and `node tools/playbot.ts`, then play it.

`ROOMS` has one row per room:

| Field | What it changes |
| --- | --- |
| `stalk` | How fast the creature walks, in px per second. The player runs at 220. Keep it lower |
| `windup` | Seconds the creature stands still after a breaker is thrown. Longer makes hits easier |
| `lunge`, `lungeMax` | Speed and longest distance of a lunge |
| `recoil` | Seconds the creature is stunned after a shock |
| `shocks` | Shocks needed to clear the room |
| `radius` | How close the creature has to be to hurt you |
| `lungeEvery` | Seconds between the lunges it starts by itself. 0 turns them off |
| `seedEvery`, `seeds`, `seedSpeed` | How often it spits seeds, how many, and how fast |
| `enrage` | Speed multiplier once it has lost 60% of its health |

`CFG` holds the numbers shared by every room. The ones we changed most:

| Name | What it changes |
| --- | --- |
| `playerSpeed` | Player run speed |
| `healthPips`, `graceSeconds` | Health, and the safe time after being hurt |
| `surgeSpeed` | How fast the surge travels. Faster is harder to read and harder to dodge |
| `surgeHitRadius` | Half the width of the live line, for the creature and for you |
| `creatureHitBonus` | Extra reach for surges against the creature only, so it is easier to shock than to be touched by |
| `generatorCooldown` | Seconds without power after every surge |
| `missWindupReduction`, `windupFloor` | Wind-up lost per miss in a row, and the lowest it can go |
| `missCooldownAdd`, `cooldownMax` | Extra seconds without power per miss in a row, and the cap |
| `missSpeedUp`, `missSpeedUpMax` | Stalk speed gained per miss in a row, and the cap |
| `lampFade`, `revealSeconds` | How long a lamp stays lit, and how long the creature shows through the dark |
| `bounceEvery`, `bounceSeconds` | Which hits knock you into a bounce, and how long it lasts |
| `parryWindow`, `parryCooldown` | How long a parry blocks, and how soon you can try again |
| `superShocks` | Shocks dealt by the bounce you get for two parries |

`VIS` is presentation only: hit-stop, shake strength, flash length, spark count. `DARK` is the lighting. `PATH_COLORS` and `PATH_DASH` are the color and dash length of each line. `COINS` sets the chest payout.

## How the main parts work

**Surge.** Each breaker's line is a list of points in `src/sim/routes.ts`. There is no physics. The surge is a distance along that list that grows by `surgeSpeed` every step (`src/sim/surge.ts`). Each step it checks the stretch it just covered against the creature and the player, so a long frame cannot skip over anything. The line on the floor, the panel diagram, the hit test and the lamps all read the same list. To change a line, edit its points and its `contacts` (which points are wall hits) and rerun the tests. `tests/fairness.test.ts` checks that a breaker hits from some creature positions and not from most.

**Lamps.** Each line has `lampDists`, distances along the line. When the surge passes one, the sim emits `lampLit` and sets `revealUntil`. `src/render/fx.ts` lights the lamp for `lampFade` seconds and `src/render/creature.ts` draws the creature above the dark for `revealSeconds`.

**Creature.** It has four states in `src/sim/creature.ts`: stalk, wind-up, lunge, recoil. `fire()` in `src/sim/game.ts` starts the surge and calls `react()` on the same step, so the two can never drift apart. The wind-up lasts `currentWindup()` seconds and then the lunge direction is fixed. If a breaker is thrown while the creature is already lunging or stunned, the reaction waits until it is free. Its own lunges and seeds are in `creatureAttacks()`.

**Breaker offline rule.** The world keeps `lastHitBreaker`. `fire()` refuses that breaker with a dead click. Any counted shock from a different breaker replaces it. One surge that passes over the creature twice counts twice. A shock from a bounce does not change which breaker is offline.

**Miss penalty.** When a surge ends without a hit, `missStreak` goes up by one. `currentWindup()`, `missCooldown()` and `stalkBoost()` all read it. A hit sets it back to zero.

**Feedback.** The sim emits events (`shock`, `miss`, `playerHit` with what hit you, `deadClick`, and so on). `src/scenes/Game.ts` turns each one into sound, shake, a flash and a short note at the place it happened.

## Known issues

- Keyboard only. There are no touch or gamepad controls.
- The JavaScript bundle is about 1.3 MB (350 KB gzipped) because it includes all of Phaser.
- The canvas scales in whole pixel steps, so a 960 x 640 frame on a normal-density display shows the game at 768 x 432 with a border.
- Music is AAC in `.m4a` files. A browser that cannot decode AAC gets a short synthesized loop.
- The room is the same in all five fights. Only the creature changes.
- The balance was tuned with the bot and by reading the numbers. It has had little play by people outside the team.
- Movement uses the W A S D letters, so on a non-QWERTY layout the arrow keys are the better choice.

## Ideas that did not make it in

- A line that changes after each hit.
- An opening sequence where three lamp flashes show the creature before you can move.
- A different room layout for each fight.
- A best-time table.
- Touch controls.

## Credits

See [CREDITS.md](CREDITS.md) for art, music, font and tool credits, and for the note on AI assistance. Music is by Eric Skiff, CC BY 4.0. The pixel font is our own and is drawn by `tools/make_art.mjs`.

One path in CREDITS.md needs a note: `public/tree-root-monster.png` is now a quarter-size copy made by `tools/shrink_monster.py`. The full-size sheet the team supplied is unchanged in `assets/src/tree-root-monster.png`.

## Team

Made in about 12 hours by a team of four: [NAME], [NAME], [NAME] and [NAME]. Hero sprites by [NAME].
