/**
 * Editor view math (zoom / pan / high-DPI backing store).
 *
 * Phaser-free so schema tests can cover the contract. World coordinates stay
 * in the existing 640×360 logical space; only the canvas backing store and
 * camera zoom change while LEVEL EDIT is on.
 */

export const EDITOR_ZOOM_MIN = 0.5;
export const EDITOR_ZOOM_MAX = 4;
export const EDITOR_HANDLE_CSS_PX = 12;
export const EDITOR_ZOOM_WHEEL_FACTOR = 1.12;

export function clampEditorZoom(z) {
  const n = Number(z);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(EDITOR_ZOOM_MAX, Math.max(EDITOR_ZOOM_MIN, n));
}

export function getDevicePixelRatio(win = typeof window !== 'undefined' ? window : undefined) {
  const dpr = Number(win?.devicePixelRatio);
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(3, dpr);
}

/**
 * Size the Phaser game so the canvas backing store matches device pixels of
 * the CSS container, then Scale Manager zoom 1/dpr keeps CSS size = container.
 */
export function computeEditorDisplaySize(viewW, viewH, dpr = 1) {
  const pxRatio = Number(dpr) > 0 ? Number(dpr) : 1;
  const w = Math.max(1, Math.round(Number(viewW) || 0));
  const h = Math.max(1, Math.round(Number(viewH) || 0));
  return {
    viewW: w,
    viewH: h,
    dpr: pxRatio,
    gameW: Math.max(1, Math.round(w * pxRatio)),
    gameH: Math.max(1, Math.round(h * pxRatio)),
    scaleZoom: 1 / pxRatio,
  };
}

/** Camera zoom so 1 world unit = `userZoom` CSS pixels. */
export function cameraZoomFromUserZoom(userZoom, dpr = 1) {
  return clampEditorZoom(userZoom) * (Number(dpr) > 0 ? Number(dpr) : 1);
}

export function userZoomFromCameraZoom(camZoom, dpr = 1) {
  const pxRatio = Number(dpr) > 0 ? Number(dpr) : 1;
  return clampEditorZoom(Number(camZoom) / pxRatio);
}

/**
 * Keep a world point under the same screen pixel after a camera zoom change.
 * `cam` is `{ scrollX, scrollY }` in world units.
 */
export function scrollAfterZoomToward(cam, worldX, worldY, oldZoom, newZoom) {
  const oz = Number(oldZoom);
  const nz = Number(newZoom);
  if (!Number.isFinite(oz) || !Number.isFinite(nz) || oz === 0 || nz === 0) {
    return { scrollX: cam.scrollX, scrollY: cam.scrollY };
  }
  return {
    scrollX: worldX - ((worldX - cam.scrollX) * oz) / nz,
    scrollY: worldY - ((worldY - cam.scrollY) * oz) / nz,
  };
}

/** userZoom that fits `rect` in a CSS view (padding in CSS pixels). */
export function fitZoomForRect(rect, viewW, viewH, padCss = 24) {
  const w = Number(rect?.w);
  const h = Number(rect?.h);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 1;
  const availW = Math.max(1, Number(viewW) - padCss * 2);
  const availH = Math.max(1, Number(viewH) - padCss * 2);
  return clampEditorZoom(Math.min(availW / w, availH / h));
}

/** World-space handle / hit pad so the target stays ~cssPx on screen. */
export function worldHandlePad(userZoom, cssPx = EDITOR_HANDLE_CSS_PX) {
  return cssPx / Math.max(EDITOR_ZOOM_MIN, Number(userZoom) || 1);
}

export function nextWheelZoom(userZoom, deltaY, factor = EDITOR_ZOOM_WHEEL_FACTOR) {
  const dir = Number(deltaY) > 0 ? 1 / factor : factor;
  return clampEditorZoom((Number(userZoom) || 1) * dir);
}
