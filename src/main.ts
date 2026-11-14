import Phaser from 'phaser';
import '@fontsource/saira-stencil-one/latin-400.css';
import { W, H, PALETTE } from './config';
import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';

// Canvas text can't wait for a web font, so hold the game until it is in.
document.fonts.load('16px "Saira Stencil One"').finally(() => {
  new Phaser.Game({
    type: Phaser.WEBGL,
    width: W,
    height: H,
    parent: 'game',
    backgroundColor: PALETTE.ink,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [Boot, Game],
  });
});
