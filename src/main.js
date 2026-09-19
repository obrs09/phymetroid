import Phaser from 'phaser';
import { GAME_W, GAME_H } from './rooms.js';
import { GameScene } from './scenes/GameScene.js';
import { computeIntegerZoom } from './scaleZoom.js';
import { applyViewport, bindViewport } from './viewport.js';
import './designConfig.js';
import './runState.js';

function boot() {
  const zoom = computeIntegerZoom(GAME_W, GAME_H);

  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_W,
    height: GAME_H,
    zoom,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
        fps: 60,
      },
    },
    scale: {
      // Integer `zoom` above; NONE avoids fractional FIT blur.
      // Leftover window space is CSS-scaled in viewport.js (pixelated).
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [GameScene],
  };

  const game = new Phaser.Game(config);
  bindViewport(game);
  game.events.once(Phaser.Core.Events.READY, () => applyViewport(game));
}

boot();
