import Phaser from 'phaser';
import { PALETTE, VIEW } from './config';
import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  width: VIEW.w,
  height: VIEW.h,
  parent: 'game',
  backgroundColor: PALETTE.ink,
  render: { pixelArt: true, antialias: false, roundPixels: true },
  scale: { mode: Phaser.Scale.NONE, zoom: 1, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Game],
});
function resize(): void {
  const zoom = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW.w, window.innerHeight / VIEW.h)));
  game.scale.setZoom(zoom);
}
window.addEventListener('resize', resize);
game.events.once('ready', resize);
game.events.once('destroy', () => window.removeEventListener('resize', resize));
