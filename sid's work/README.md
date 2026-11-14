# BLACKOUT

This is the TypeScript browser version of the dark, single-room horror game.
It preserves the bouncing player, solid machinery, permanent pits, directional
shocks, boss health, and retaliatory shockwaves. Machinery blocks a shockwave;
an unobstructed shockwave damages the player.
The boss uses the supplied `tree-root-monster.png` animation sheet.
The player uses the supplied White Hero directional sprite sheets.
The room uses the supplied locked-fight background image, darkened for play.

## Run

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite.

## Controls

- `WASD` or arrow keys: set the direction for the next wall/obstacle bounce
- `1`: shock left
- `2`: shock right
- `3`: shock up
- `4`: shock down
- `R`: restart

The character moves constantly on its own. Press a direction before a collision
to choose the next bounce; the keys do not directly move the character. Touching
the boss removes one health, while machinery blocks movement and can also block
shockwaves.

Player bounces ease into their new direction, and shots use a glowing,
jagged electrical animation with a pulsing head and sparks.
