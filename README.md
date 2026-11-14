# BLACKOUT

A short browser game made for the theme "Bounce Back". You are in a dark maintenance room with a creature. Three breakers send electrical surges around the room. Lamps show where the surge is going and briefly reveal the creature.

Each generator's path is always drawn on the floor. When the creature crosses one, press that generator's number to send a surge down it. The surge ricochets off the walls and hurts you too if you are in the way. Land enough shocks to restore power, then reach the open exit. A generator that hits stays offline until a different one hits. Missing makes the next windup shorter and the generator recovery longer. You have five health pips.

## Controls

There are five boss fights in a row, and the boss gets faster, bigger and tougher each time. Its health shows as a bar over its head. The boss starts in the top-right corner guarding the exit, and the first boss freezes while your surge is travelling. The other bosses only wind up and lunge at a generator about half the time, chosen at random each shot. From the second fight on it starts attacking by itself: timed lunges, then bouncing seeds in a fan, and it speeds up when badly hurt. After each boss you open a chest: the faster you killed it, the more coins you get, and it holds a piece of the story of the Thornwood Clan, trees the Rot infected, that you have to kill to get home. After the fifth boss a results screen shows your total time and coins.

- WASD or arrow keys: move.
- 1, 2 or 3: fire that generator from where it stands. You can be anywhere in the room.
- 4 or F: parry the boss's touch or a seed (a short window, then a cooldown). A parry shoves you and the boss apart. Two parries in a row launch a bigger, faster super bounce that deals several shocks.
- Shift: a very small dash.
- R: restart the boss fight immediately.
- Enter on the exit screen, and on the chest screens: open the chest and move on to the next fight (after the fifth, the results screen, then back to the first).

Click the game to focus it, then press a key to enable audio.

## Run

Use a current Node.js version supported by the installed Vite release and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Check and build

```sh
npx tsc --noEmit
npm test
npm run build
npm run preview
```

The build goes into dist/. Serve it over HTTP; do not open index.html directly from the filesystem. Asset paths are relative so the game can run in a subdirectory or an itch.io embed.

## Package for itch.io

```sh
npm run zip
```

This rebuilds the game and writes blackout-html5.zip with index.html at the zip root, alongside assets/ and audio/. The packer uses only Node standard libraries. Upload that zip as an HTML game on itch.io. Page copy and capture plans are in docs/itch_page.md.

To regenerate the WAV files, run npm run audio. The generator uses only Node standard libraries. Generated audio is committed; dist/ and the upload zip are not.

## Music credit

"Dark Fog", "Cyborg Ninja", "Volatile Reaction" and "Killing Time" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 https://creativecommons.org/licenses/by/4.0/
