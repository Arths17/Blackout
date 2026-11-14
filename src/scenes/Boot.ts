import Phaser from 'phaser';
import { GameScene } from './Game';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Game');
  }
}
