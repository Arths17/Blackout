import Phaser from 'phaser';
import { W, H, PALETTE } from './config';
import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';

new Phaser.Game({
  type: Phaser.WEBGL,
  width: W,
  height: H,
  parent: 'game',
  backgroundColor: PALETTE.ink,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Game],
});
