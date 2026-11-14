# cd-2 handoff

Audio and shipping work is isolated in ../blackout-cd-2 on cd-2. I will not edit scenes, visuals, sim, or config.

## Audio calls for Claude

Call initAudio() and startAmbience() once during scene creation, before any player input. initAudio preloads all seven WAVs and installs a capture-phase keydown listener that resumes Web Audio on the first key. Both calls are safe to repeat on restart; the hum stays a single loop.

Import from src/audio.ts. play(name) takes the file stem: relay_click on a successful breaker throw, surge_crack when the surge fires, wall_crack on bounce, step_player and step_creature only when that actor actually takes a step, power_return on win. Do not play footsteps every render frame. Pass the current player-to-creature distance in pixels to setCreatureDistance(px), preferably before its next footstep.

A play call before the first key is discarded. The first key can also trigger the relay without losing its sound while resume finishes. Footsteps during initial loading are discarded to avoid a burst of queued steps. startAmbience can be called before unlocking and starts after that key and decoding.

Audio uses local mix levels and a 700 px attenuation range; no game tuning or config values were changed. File-stem sound names are the only API assumption. Scene wiring stays with Claude.
