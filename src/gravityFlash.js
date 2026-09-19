/**
 * Screen-space flash of the current gravity *down* vector.
 * Camera stays axis-aligned; this HUD never world-rotates.
 */

import { GAME_W, GAME_H, UI_FONT_MD, px } from './rooms.js';
import { addHudText } from './hudText.js';
import {
  axisLabel,
  canonicalizeDown,
  DOWN_ARROW_GLYPH,
  downArrowGlyph,
  downArrowRotation,
} from './gravity.js';

export const GRAVITY_FLASH_MS = 550;

const ARROW_KEY = 'grav_down_arrow';

export { DOWN_ARROW_GLYPH, downArrowRotation };

function ensureArrowTexture(scene) {
  if (scene.textures.exists(ARROW_KEY)) return ARROW_KEY;
  const w = px(22);
  const h = px(30);
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffe082, 1);
  g.fillRect(Math.round(w * 0.36), 0, Math.round(w * 0.28), Math.round(h * 0.52));
  g.fillTriangle(1, Math.round(h * 0.48), w - 1, Math.round(h * 0.48), Math.round(w / 2), h - 1);
  g.lineStyle(2, 0xfff8e1, 1);
  g.strokeTriangle(1, Math.round(h * 0.48), w - 1, Math.round(h * 0.48), Math.round(w / 2), h - 1);
  g.generateTexture(ARROW_KEY, w, h);
  g.destroy();
  return ARROW_KEY;
}

export class GravityDownFlash {
  /**
   * @param {import('phaser').Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.lastAxis = null;
    this.lastAt = 0;
    this.tween = null;

    ensureArrowTexture(scene);
    this.root = scene.add.container(GAME_W / 2, GAME_H / 2 - px(18)).setScrollFactor(0).setDepth(260);
    this.arrow = scene.add.image(0, 0, ARROW_KEY).setOrigin(0.5, 0.55);
    this.label = addHudText(scene, 0, px(22), '', {
      fontSize: UI_FONT_MD,
      color: '#ffe082',
    }).setOrigin(0.5, 0);
    this.root.add([this.arrow, this.label]);
    this.root.setAlpha(0);
    this.root.setVisible(false);
  }

  /**
   * Brief fade of the current down vector. Safe to retrigger.
   * Camera stays axis-aligned; the arrow is screen-space only.
   * @param {string|number} axis
   */
  show(axis) {
    const down = canonicalizeDown(axis);
    this.lastAxis = down;
    this.lastAt = this.scene.time.now;
    this.arrow.setRotation(downArrowRotation(down));
    this.label.setText(`${downArrowGlyph(down)} ${axisLabel(down)}`);
    this.root.setVisible(true);
    this.root.setAlpha(1);
    if (this.tween) this.tween.stop();
    this.tween = this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: GRAVITY_FLASH_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.root.setVisible(false);
        this.root.setAlpha(0);
      },
    });
    return this.getState();
  }

  getState() {
    return {
      axis: this.lastAxis,
      alpha: this.root.alpha,
      visible: this.root.visible,
      at: this.lastAt,
      flashed: this.lastAxis != null,
    };
  }
}
