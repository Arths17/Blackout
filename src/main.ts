import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/Boot';
import { GameScene } from './scenes/Game';

new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game',
  backgroundColor: '#08070b',
  scene: [BootScene, GameScene],
  render: { antialias: true, pixelArt: false },
});
