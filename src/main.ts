import Phaser from 'phaser';
import { PALETTE, VIEW } from './config';
import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';

new Phaser.Game({
  type: Phaser.WEBGL,
  width: VIEW.w,
  height: VIEW.h,
  parent: 'game',
  backgroundColor: PALETTE.ink,
  render: { pixelArt: true, antialias: false, roundPixels: true },
  // whole-number zoom only (?zoom=N forces one); the page background letterboxes the rest
  scale: { mode: Phaser.Scale.NONE, zoom: Number(new URLSearchParams(location.search).get('zoom')) || Phaser.Scale.MAX_ZOOM, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Game],
});
