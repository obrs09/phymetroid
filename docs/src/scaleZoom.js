/**
 * Largest integer zoom that fits the logical game size in the window.
 * Non-integer Phaser FIT scales can blur pixel art; integer zoom keeps
 * each game pixel an integer number of CSS pixels before any leftover fill.
 */

export function getViewSize() {
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  if (fs && fs.clientWidth > 0 && fs.clientHeight > 0) {
    return { w: fs.clientWidth, h: fs.clientHeight };
  }
  const el = typeof document !== 'undefined' ? document.getElementById('game-container') : null;
  if (el && el.clientWidth > 0 && el.clientHeight > 0) {
    return { w: el.clientWidth, h: el.clientHeight };
  }
  if (typeof window === 'undefined') return { w: 640, h: 360 };
  return { w: window.innerWidth, h: window.innerHeight };
}

export function computeIntegerZoom(gameW, gameH, viewW, viewH) {
  if (viewW == null || viewH == null) {
    const v = getViewSize();
    viewW = v.w;
    viewH = v.h;
  }
  const z = Math.floor(Math.min(viewW / gameW, viewH / gameH));
  return Math.max(1, z);
}

/**
 * Leftover uniform CSS scale after integer zoom (typically 1 .. <2).
 * Applied only to the canvas wrapper/CSS so the bitmap stays nearest-neighbor.
 */
export function computeCssFill(gameW, gameH, intZoom, viewW, viewH) {
  if (viewW == null || viewH == null) {
    const v = getViewSize();
    viewW = v.w;
    viewH = v.h;
  }
  const zoom = Math.max(1, intZoom || 1);
  const dw = gameW * zoom;
  const dh = gameH * zoom;
  if (dw <= 0 || dh <= 0) return 1;
  const fill = Math.min(viewW / dw, viewH / dh);
  if (!Number.isFinite(fill) || fill <= 0) return 1;
  return fill;
}

/** Integer zoom + leftover CSS fill for a 16:9-fitted viewport. */
export function computeViewportLayout(gameW, gameH, viewW, viewH) {
  if (viewW == null || viewH == null) {
    const v = getViewSize();
    viewW = v.w;
    viewH = v.h;
  }
  const intZoom = computeIntegerZoom(gameW, gameH, viewW, viewH);
  const cssFill = computeCssFill(gameW, gameH, intZoom, viewW, viewH);
  return {
    intZoom,
    cssFill,
    effectiveScale: intZoom * cssFill,
    viewW,
    viewH,
  };
}
