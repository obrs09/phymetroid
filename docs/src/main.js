import Phaser from './phaser-shim.js';
import { GAME_W, GAME_H } from './rooms.js';
import { GameScene } from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
      // Fixed timestep feel via fps target
      fps: 60,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
};

new Phaser.Game(config);
