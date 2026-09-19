import Phaser from 'phaser';

export const PLAYER_W = 12;
export const PLAYER_H = 16;

/**
 * Feel targets (Metroid-ish, still readable on 320×180):
 * - Higher gravity → less floaty hang time
 * - Stronger jump impulse → still clears a 24px block
 * - Coyote + buffer → jumps feel fair at ledge edges
 * - Variable jump → tap = short hop, hold = full jump
 */
export const MOVE_SPEED = 110;
export const AIR_CONTROL = 0.85; // fraction of MOVE_SPEED while airborne
export const JUMP_VELOCITY = -275;
export const JUMP_CUT_MULTIPLIER = 0.45; // on jump release, keep this * upward speed if still rising
export const GRAVITY_Y = 980;
export const MAX_FALL_SPEED = 320;
export const COYOTE_MS = 90;
export const JUMP_BUFFER_MS = 100;

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
  body.setMaxVelocity(MOVE_SPEED * 1.15, MAX_FALL_SPEED);
  body.body.setSize(PLAYER_W, PLAYER_H);
  body.body.setAllowGravity(false);
  body.setDepth(10);
  return body;
}
