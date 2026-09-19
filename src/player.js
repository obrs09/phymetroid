import Phaser from 'phaser';
import { FEEL_DEFAULTS, getFeel } from './designConfig.js';
import { px } from './rooms.js';

export const PLAYER_W = px(12);
export const PLAYER_H = px(16);

/**
 * Default feel targets (Metroid-ish on 640×360).
 * Pixel velocities are WORLD_SCALE × the original 320×180 numbers.
 * Live values live in designConfig — GameScene / createPlayer must call getFeel().
 * These exports stay as the documented defaults (not the live session values).
 */
export const MOVE_SPEED = FEEL_DEFAULTS.moveSpeed;
export const AIR_CONTROL = FEEL_DEFAULTS.airControl;
export const JUMP_VELOCITY = FEEL_DEFAULTS.jumpVelocity;
export const JUMP_CUT_MULTIPLIER = FEEL_DEFAULTS.jumpCutMultiplier;
export const GRAVITY_Y = FEEL_DEFAULTS.gravityY;
export const MAX_FALL_SPEED = FEEL_DEFAULTS.maxFallSpeed;
export const COYOTE_MS = FEEL_DEFAULTS.coyoteMs;
export const JUMP_BUFFER_MS = FEEL_DEFAULTS.jumpBufferMs;
export const FLOAT_NUDGE = FEEL_DEFAULTS.floatNudge;
export const MAX_VELOCITY_X_FACTOR = 1.15;

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
  g.lineStyle(2, 0xe1f5fe, 1);
  g.strokeRect(0, 0, PLAYER_W, PLAYER_H);
  g.generateTexture(key, PLAYER_W, PLAYER_H);
  g.destroy();
  return key;
}

/**
 * Cap both axes by maxFallSpeed so a left/right gravity vector is not
 * clamped by the old "vx = walk, vy = fall" Arcade maxVelocity split.
 * Walk speed is applied explicitly on the tangent; jump uses feel.jumpVelocity.
 */
export function applyPlayerFeelLimits(player, feel = getFeel()) {
  if (!player) return;
  const cap = Math.max(feel.maxFallSpeed, feel.moveSpeed * MAX_VELOCITY_X_FACTOR);
  player.setMaxVelocity(cap, cap);
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
  applyPlayerFeelLimits(body);
  body.body.setSize(PLAYER_W, PLAYER_H);
  body.body.setAllowGravity(false);
  body.setDepth(10);
  return body;
}
