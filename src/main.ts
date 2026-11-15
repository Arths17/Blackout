import Phaser from 'phaser';
import { initAudio, setVolume } from './audio';
import { PALETTE, VIEW } from './config';
import { loadSettings, settings } from './settings';
import { Boot } from './scenes/Boot';
import { Chest } from './scenes/Chest';
import { Finish } from './scenes/Finish';
import { Game } from './scenes/Game';
import { Title } from './scenes/Title';

loadSettings();
setVolume(settings.volume / 10);
initAudio();

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  width: VIEW.w,
  height: VIEW.h,
  parent: 'game',
  backgroundColor: PALETTE.ink,
  // src/audio.ts does all the sound; without this Phaser opens a second audio context at boot.
  audio: { noAudio: true },
  render: { pixelArt: true, antialias: false, roundPixels: true },
  scale: { mode: Phaser.Scale.NONE, zoom: 1, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Title, Game, Chest, Finish],
});

// The canvas fills as much of its frame as it can at a whole number of screen pixels per game
// pixel. Counting device pixels (not CSS pixels) keeps it sharp on high-DPI displays and lets
// those use half steps like 2.5x.
function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(window.innerWidth / VIEW.w, window.innerHeight / VIEW.h);
  game.scale.setZoom(Math.max(1, Math.floor(fit * dpr)) / dpr);
}
window.addEventListener('resize', resize);
game.events.once('ready', resize);
game.events.once('destroy', () => window.removeEventListener('resize', resize));
// Inside an itch.io frame the keyboard goes to the parent page until the frame is clicked.
window.addEventListener('pointerdown', () => window.focus());
