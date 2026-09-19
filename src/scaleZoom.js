/**
 * Largest integer zoom that fits the logical game size in the window.
 * Non-integer FIT scales blur pixel art; integer zoom keeps edges crisp.
 */
export function computeIntegerZoom(gameW, gameH, viewW = window.innerWidth, viewH = window.innerHeight) {
  const z = Math.floor(Math.min(viewW / gameW, viewH / gameH));
  return Math.max(1, z);
}
