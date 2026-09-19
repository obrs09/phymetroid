import Phaser from 'phaser';
import { GAME_W, GAME_H } from './rooms.js';
import { GameScene } from './scenes/GameScene.js';
import { computeIntegerZoom } from './scaleZoom.js';
import './designConfig.js';

function boot() {
  // Keep F1 for the in-game feel debugger (avoid browser help overlay).
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') e.preventDefault();
  });

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
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [GameScene],
  };

  const game = new Phaser.Game(config);

  let lastZoom = zoom;
  window.addEventListener('resize', () => {
    const next = computeIntegerZoom(GAME_W, GAME_H);
    if (next === lastZoom) return;
    lastZoom = next;
    game.scale.setZoom(next);
    game.scale.refresh();
  });
}

boot();
