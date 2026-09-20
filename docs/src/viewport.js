/**
 * Viewport layout: integer Phaser zoom + leftover CSS fill, plus Fullscreen API.
 *
 * Phaser Scale.FIT (fractional canvas zoom) is avoided. The game bitmap stays
 * at logical 640×360 with pixelArt / nearest-neighbor; leftover window space
 * is filled by CSS `transform: scale` + `image-rendering: pixelated`.
 */

import { GAME_H, GAME_W } from './rooms.js';
import { computeViewportLayout } from './scaleZoom.js';
import { refreshHudTextResolution } from './hudText.js';
import { isTypingInEditorField } from './levelEditor.js';

const FULLSCREEN_KEYS = new Set(['f', 'F']);

/** When set, resize / fullscreenchange re-applies the editor high-DPI view. */
let viewportRelayoutHook = null;

export function setViewportRelayoutHook(fn) {
  viewportRelayoutHook = typeof fn === 'function' ? fn : null;
}

export function isEditorViewportActive() {
  return typeof viewportRelayoutHook === 'function';
}

export function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

export function isGameFullscreen() {
  return Boolean(getFullscreenElement());
}

/**
 * Toggle browser Fullscreen API on the game container (Esc exits as usual).
 * F11 remains the browser's own chrome fullscreen and still triggers relayout.
 */
export async function toggleGameFullscreen(element = document.getElementById('game-container')) {
  const current = getFullscreenElement();
  try {
    if (current) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return false;
    }
    if (!element) return false;
    if (element.requestFullscreen) await element.requestFullscreen();
    else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
    return true;
  } catch (err) {
    console.warn('fullscreen toggle failed', err);
    return isGameFullscreen();
  }
}

function applyCanvasFill(canvas, cssFill) {
  if (!canvas || !canvas.style) return;
  canvas.style.imageRendering = 'pixelated';
  canvas.style.transformOrigin = 'center center';
  canvas.style.transform = cssFill > 1.001 ? `scale(${cssFill})` : '';
}

/**
 * Recompute integer zoom and leftover CSS fill. Call on boot, resize,
 * and fullscreenchange — cssFill is continuous, so every resize matters.
 */
export function applyViewport(game) {
  if (viewportRelayoutHook) return viewportRelayoutHook(game);
  if (!game?.scale) return computeViewportLayout(GAME_W, GAME_H);
  const layout = computeViewportLayout(GAME_W, GAME_H);
  if (game.scale.width !== GAME_W || game.scale.height !== GAME_H) {
    game.scale.resize(GAME_W, GAME_H);
  }
  game.scale.setZoom(layout.intZoom);
  game.scale.refresh();
  applyCanvasFill(game.canvas, layout.cssFill);
  const canvas = game.canvas;
  if (canvas?.style && !canvas.style.imageRendering) canvas.style.imageRendering = 'pixelated';
  refreshHudTextResolution(Math.max(2, Math.round(layout.effectiveScale)));
  return layout;
}

/**
 * High-DPI editor backing store: game size = CSS container × dpr, scale zoom
 * 1/dpr so the canvas CSS size matches the container. World units stay 640×360.
 */
export function applyEditorViewport(game, display) {
  if (!game?.scale || !display) return display;
  game.scale.resize(display.gameW, display.gameH);
  game.scale.setZoom(display.scaleZoom);
  game.scale.refresh();
  const canvas = game.canvas;
  if (canvas?.style) {
    canvas.style.transform = '';
    canvas.style.imageRendering = 'auto';
  }
  const parent = canvas?.parentElement;
  if (parent?.classList) parent.classList.add('phy-editor-hidpi');
  refreshHudTextResolution(Math.max(2, Math.round((display.dpr || 1) * 2)));
  return display;
}

export function clearEditorViewportClass(game) {
  const parent = game?.canvas?.parentElement;
  parent?.classList?.remove('phy-editor-hidpi');
  if (game?.canvas?.style) game.canvas.style.imageRendering = 'pixelated';
}

/**
 * Bind resize / fullscreen listeners and F (game fullscreen).
 * @param {import('phaser').Game} game
 */
export function bindViewport(game) {
  const relayout = () => applyViewport(game);

  window.addEventListener('resize', relayout);
  document.addEventListener('fullscreenchange', relayout);
  document.addEventListener('webkitfullscreenchange', relayout);

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'F1') e.preventDefault();
      if (isTypingInEditorField()) return;
      if (!FULLSCREEN_KEYS.has(e.key) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      toggleGameFullscreen();
    },
    true
  );

  if (game.events) {
    game.events.once('ready', relayout);
  } else {
    relayout();
  }

  if (typeof window !== 'undefined') {
    window.__PHYMETROID_TOGGLE_FULLSCREEN__ = () => toggleGameFullscreen();
  }
}
