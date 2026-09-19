import Phaser from './phaser-shim.js';
import { UI_FONT_FAMILY, UI_FONT_MD } from './rooms.js';

/** HUD text is rasterized at this many texels per game pixel (game pixelArt stays NEAREST). */
export const HUD_TEXT_RESOLUTION = 2;

const hudTexts = new Set();

function track(text) {
  hudTexts.add(text);
  text.once(Phaser.GameObjects.Events.DESTROY, () => hudTexts.delete(text));
  return text;
}

/**
 * Linear-filter the text texture so glyph AA is not nearest-neighbor magnified
 * by pixelArt. Sprites keep the global NEAREST filter.
 */
export function sharpenHudText(text) {
  text?.texture?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return text;
}

export function hudTextStyle(overrides = {}) {
  return {
    fontFamily: UI_FONT_FAMILY,
    fontSize: UI_FONT_MD,
    resolution: HUD_TEXT_RESOLUTION,
    ...overrides,
  };
}

/**
 * Monospace HUD text that stays readable at 640×360 + integer zoom.
 * @param {Phaser.Scene} scene
 */
export function addHudText(scene, x, y, content, style) {
  const text = scene.add.text(x, y, content, hudTextStyle(style));
  sharpenHudText(text);
  return track(text);
}

/** Call after integer zoom changes so text resolution can stay near 1:1 on screen. */
export function refreshHudTextResolution(zoom = HUD_TEXT_RESOLUTION) {
  const res = Math.max(HUD_TEXT_RESOLUTION, zoom);
  for (const text of hudTexts) {
    if (!text.active) continue;
    text.setResolution(res);
    sharpenHudText(text);
  }
}
