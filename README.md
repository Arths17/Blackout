# BLACKOUT

A short browser game made for the theme "Bounce Back". You are in a dark maintenance room with a creature. Three breakers send electrical surges around the room. Lamps show where the surge is going and briefly reveal the creature.

Lure the creature into a route, throw the breaker, then move clear. The surge hurts you too, including when it comes back toward your switch. Land five shocks to restore power, then reach the open exit. A breaker that hits stays offline until a different breaker hits. Missing makes the next windup shorter and the generator recovery longer. You have four health pips.

## Controls

There are five boss fights in a row, and the boss gets faster, bigger and tougher each time. Its health shows as a bar over its head.

- WASD or arrow keys: move.
- E or Space: charge a nearby breaker, then press again to fire the held charge from your body in the direction you face. It ricochets off the walls and can hurt you.
- Shift: parry the boss's touch (a short window, then a cooldown). Two parries in a row launch a bigger, faster super bounce that deals several shocks.
- R: restart the boss fight immediately.
- Enter on the exit screen: start the next fight (after the fifth, back to the first).

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
