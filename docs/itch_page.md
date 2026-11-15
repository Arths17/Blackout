# BLACKOUT itch page draft

## Description

The power is out. You are in a maintenance room with a creature and three breakers. Each breaker sends a surge around the room. Lamps flash as it passes, giving you a brief look at what is moving in the dark.

Every generator's path is drawn on the floor. When the creature crosses one, press that generator's number to fire it from anywhere, and keep out of the way of the surge. It can hurt you too. Five shocks restore power and open the exit. Made for the jam theme "Bounce Back".

## Controls

WASD or arrow keys to move. 1, 2 or 3 to fire a generator from anywhere in the room. A bounce that hits the creature gives you a second of immunity. Every other hit from the creature bounces you around the room. R to restart. Click the game to focus it; the first key enables sound.

## How to win

Watch which lamp catches the creature, change where you lure it, and alternate breakers after a hit while leaving room to dodge the return.

## Tags

Horror, Survival, Top-Down, 2D, Singleplayer, Short, Atmospheric, HTML5.

## Screenshot plan

Capture the return-loop route at the lamp flash that reveals the creature mid-lunge. Keep the player and the next lamps beside the original breaker in the same frame, so the incoming return is visible. Take a second frame a moment later with the player moving away as the surge approaches that breaker. Keep the game HUD visible and avoid a frame where the creature is lost in darkness.

Use the existing slow-motion capture flag (?slow=0.25) to time the shots. Do a normal-speed playthrough before choosing the frames. A third screenshot can show the lights staying on and the open exit after the fifth hit.

## Cover GIF plan

Record one short return-loop attempt. Start on the breaker throw, show an empty-floor lamp flash, then the flash that catches the creature. End as the lamps light back toward the player and the player steps away from the returning surge. Aim for roughly four seconds at normal speed, with the creature reveal near the middle. Crop only enough to keep the breaker, creature, and return leg readable at cover size. Hold the final frame briefly before looping; keep essential timing in the footage instead of adding text.

## Upload

Run npm run zip and upload blackout-html5.zip as the HTML game. index.html must remain at the archive root. Test the uploaded embed for keyboard focus, first-key audio, restart, loss, and the five-hit exit payoff. Screenshots and GIF are planned here, not captured yet.

## Credits

Music: Eric Skiff - Underclocked, Jumpshot, Come and Find Me and There's a Power Here - Resistor Anthems - Available at http://EricSkiff.com/music Licensed under Creative Commons: By Attribution 4.0 https://creativecommons.org/licenses/by/4.0/
