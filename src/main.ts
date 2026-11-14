import Phaser from 'phaser';
import '@fontsource/silkscreen/latin-400.css';
import { PALETTE, VIEW } from './config';
import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';

// Canvas text can't wait for a web font, so hold the game until the pixel font is in.
document.fonts.load('8px "Silkscreen"').finally(() => {
  new Phaser.Game({
    type: Phaser.WEBGL,
    width: VIEW.w,
    height: VIEW.h,
    parent: 'game',
    backgroundColor: PALETTE.ink,
    render: { pixelArt: true, antialias: false, roundPixels: true },
    // whole-number zoom only; the page background letterboxes the rest
    scale: { mode: Phaser.Scale.NONE, zoom: Phaser.Scale.MAX_ZOOM, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [Boot, Game],
  });
});
