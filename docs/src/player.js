import Phaser from 'phaser';

export const PLAYER_W = 12;
export const PLAYER_H = 16;
export const MOVE_SPEED = 90;
export const JUMP_VELOCITY = -220;
export const GRAVITY_Y = 600;

/**
 * Create a simple rectangle texture for the player (no external art).
 * @param {Phaser.Scene} scene
 * @param {string} key
 */
export function ensurePlayerTexture(scene, key = 'player') {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x4fc3f7, 1);
  g.fillRect(0, 0, PLAYER_W, PLAYER_H);
  g.lineStyle(1, 0xe1f5fe, 1);
  g.strokeRect(0, 0, PLAYER_W, PLAYER_H);
  g.generateTexture(key, PLAYER_W, PLAYER_H);
  g.destroy();
  return key;
}

/**
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 */
export function createPlayer(scene, x, y) {
  const key = ensurePlayerTexture(scene);
  const body = scene.physics.add.sprite(x, y, key);
  body.setCollideWorldBounds(true);
  body.setBounce(0);
  body.setMaxVelocity(MOVE_SPEED * 1.5, 400);
  body.body.setSize(PLAYER_W, PLAYER_H);
  body.body.setAllowGravity(false);
  body.setDepth(10);
  return body;
}
