/**
 * Central mutable design config for live feel tweaks + 策划 bot dumps.
 *
 * Export JSON (camelCase) ↔ in-game labels:
 *   moveSpeed          MOVE SPEED     walk speed after gravity
 *   airControl         AIR CONTROL    fraction of moveSpeed while airborne
 *   jumpVelocity       JUMP VEL       upward impulse (negative = up)
 *   jumpCutMultiplier  JUMP CUT       keep this * vy on early jump release
 *   gravityY           GRAVITY Y      Arcade world gravity.y after pickup
 *   maxFallSpeed       MAX FALL       player max velocity.y
 *   coyoteMs           COYOTE MS      grounded grace after leaving a ledge
 *   jumpBufferMs       BUFFER MS      jump-press remember window
 *   floatNudge         FLOAT NUDGE    pre-gravity A/D air nudge
 *
 * Pixel velocities (moveSpeed, jumpVelocity, gravityY, maxFallSpeed, floatNudge)
 * are WORLD_SCALE × the original 320×180 defaults so hang time and room-cross
 * time match after the 640×360 layout scale. Time / ratio keys are unchanged.
 *
 * Persistence: localStorage key `phymetroid.designConfig` (optional boot load).
 * Programmatic import: window.__PHYMETROID_APPLY_DESIGN__(objOrJson)
 * or applyDesignConfig(obj). The future 策划 bot can write this same JSON.
 */

import { GAME_H, GAME_W, WORLD_SCALE } from './rooms.js';

export const SCHEMA_VERSION = 1;
export const GAME_ID = 'phymetroid';
export const DESIGN_STORAGE_KEY = 'phymetroid.designConfig';

export const FEEL_DEFAULTS = Object.freeze({
  moveSpeed: 110 * WORLD_SCALE,
  airControl: 0.85,
  jumpVelocity: -275 * WORLD_SCALE,
  jumpCutMultiplier: 0.45,
  gravityY: 980 * WORLD_SCALE,
  maxFallSpeed: 320 * WORLD_SCALE,
  coyoteMs: 90,
  jumpBufferMs: 100,
  floatNudge: 28 * WORLD_SCALE,
});

/** Field metadata for the F1 debugger (steps, clamps, labels). */
export const FEEL_FIELDS = Object.freeze([
  { key: 'moveSpeed', label: 'MOVE SPEED', step: 5 * WORLD_SCALE, shiftStep: 20 * WORLD_SCALE, min: 10 * WORLD_SCALE, max: 400 * WORLD_SCALE, decimals: 0 },
  { key: 'airControl', label: 'AIR CONTROL', step: 0.05, shiftStep: 0.15, min: 0, max: 1.5, decimals: 2 },
  { key: 'jumpVelocity', label: 'JUMP VEL', step: 5 * WORLD_SCALE, shiftStep: 25 * WORLD_SCALE, min: -600 * WORLD_SCALE, max: -40 * WORLD_SCALE, decimals: 0 },
  { key: 'jumpCutMultiplier', label: 'JUMP CUT', step: 0.05, shiftStep: 0.15, min: 0, max: 1, decimals: 2 },
  { key: 'gravityY', label: 'GRAVITY Y', step: 20 * WORLD_SCALE, shiftStep: 100 * WORLD_SCALE, min: 80 * WORLD_SCALE, max: 2500 * WORLD_SCALE, decimals: 0 },
  { key: 'maxFallSpeed', label: 'MAX FALL', step: 10 * WORLD_SCALE, shiftStep: 40 * WORLD_SCALE, min: 40 * WORLD_SCALE, max: 900 * WORLD_SCALE, decimals: 0 },
  { key: 'coyoteMs', label: 'COYOTE MS', step: 10, shiftStep: 30, min: 0, max: 400, decimals: 0 },
  { key: 'jumpBufferMs', label: 'BUFFER MS', step: 10, shiftStep: 30, min: 0, max: 400, decimals: 0 },
  { key: 'floatNudge', label: 'FLOAT NUDGE', step: 2 * WORLD_SCALE, shiftStep: 8 * WORLD_SCALE, min: 0, max: 160 * WORLD_SCALE, decimals: 0 },
]);

const FEEL_FIELD_BY_KEY = Object.fromEntries(FEEL_FIELDS.map((f) => [f.key, f]));

/** @type {Set<(feel: ReturnType<typeof getFeel>) => void>} */
const listeners = new Set();

function cloneFeel(src = FEEL_DEFAULTS) {
  return { ...FEEL_DEFAULTS, ...src };
}

/** @type {{ schemaVersion: number, sections: { feel: Record<string, number> } }} */
let state = {
  schemaVersion: SCHEMA_VERSION,
  sections: { feel: cloneFeel() },
};

function clampFeelValue(key, raw) {
  const field = FEEL_FIELD_BY_KEY[key];
  const fallback = FEEL_DEFAULTS[key];
  let n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  if (field) {
    n = Math.min(field.max, Math.max(field.min, n));
    if (field.decimals <= 0) return Math.round(n);
    const f = 10 ** field.decimals;
    return Math.round(n * f) / f;
  }
  return n;
}

function sanitizeFeel(patch) {
  const next = cloneFeel(state.sections.feel);
  if (!patch || typeof patch !== 'object') return next;
  for (const key of Object.keys(FEEL_DEFAULTS)) {
    if (patch[key] !== undefined) next[key] = clampFeelValue(key, patch[key]);
  }
  return next;
}

function notify() {
  const feel = getFeel();
  for (const fn of listeners) {
    try {
      fn(feel);
    } catch (err) {
      console.warn('designConfig listener failed', err);
    }
  }
}

function storage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function persist() {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(
      DESIGN_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        logicalW: GAME_W,
        logicalH: GAME_H,
        sections: { feel: getFeel() },
      })
    );
  } catch {
    // quota / private mode — live tweaks still work this session
  }
}

function loadFromStorage() {
  const ls = storage();
  if (!ls) return;
  try {
    const raw = ls.getItem(DESIGN_STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    // Ignore pre-640×360 saves: pixel velocities were authored for 320×180.
    if (obj?.logicalW && obj?.logicalH && (obj.logicalW !== GAME_W || obj.logicalH !== GAME_H)) {
      return;
    }
    if (!obj?.logicalW && !obj?.logicalH) {
      return;
    }
    const feel = obj?.sections?.feel ?? obj?.feel;
    if (feel && typeof feel === 'object') {
      state.sections.feel = sanitizeFeel(feel);
    }
  } catch {
    // corrupt payload — keep defaults
  }
}

loadFromStorage();

/** Live feel snapshot (copy). */
export function getFeel() {
  return cloneFeel(state.sections.feel);
}

/**
 * Merge + clamp a feel patch. Updates gravity listeners and localStorage.
 * @param {Partial<typeof FEEL_DEFAULTS>} patch
 */
export function applyFeel(patch) {
  state.sections.feel = sanitizeFeel(patch);
  persist();
  notify();
  return getFeel();
}

export function resetDesignToDefaults() {
  state = {
    schemaVersion: SCHEMA_VERSION,
    sections: { feel: cloneFeel() },
  };
  const ls = storage();
  try {
    ls?.removeItem(DESIGN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notify();
  return getFeel();
}

/**
 * Subscribe to live feel changes. Returns an unsubscribe function.
 * @param {(feel: ReturnType<typeof getFeel>) => void} fn
 */
export function subscribeDesign(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Nudge one feel field by +1 / -1 step (Shift = larger step). */
export function nudgeFeel(key, direction, shift = false) {
  const field = FEEL_FIELD_BY_KEY[key];
  if (!field) return getFeel();
  const step = shift ? field.shiftStep : field.step;
  const cur = state.sections.feel[key] ?? FEEL_DEFAULTS[key];
  return applyFeel({ [key]: cur + direction * step });
}

export function formatFeelValue(key, value) {
  const field = FEEL_FIELD_BY_KEY[key];
  const n = value ?? state.sections.feel[key];
  if (!field || field.decimals <= 0) return String(Math.round(n));
  return Number(n).toFixed(field.decimals);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Local timestamp for download names: YYYYMMDD-HHmmss */
export function formatDesignStamp(date = new Date()) {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
  );
}

/** Bot-friendly export payload (stable key order). */
export function buildExportPayload(date = new Date()) {
  const feel = getFeel();
  return {
    schemaVersion: SCHEMA_VERSION,
    game: GAME_ID,
    exportedAt: date.toISOString(),
    sections: {
      feel: {
        moveSpeed: feel.moveSpeed,
        airControl: feel.airControl,
        jumpVelocity: feel.jumpVelocity,
        jumpCutMultiplier: feel.jumpCutMultiplier,
        gravityY: feel.gravityY,
        maxFallSpeed: feel.maxFallSpeed,
        coyoteMs: feel.coyoteMs,
        jumpBufferMs: feel.jumpBufferMs,
        floatNudge: feel.floatNudge,
      },
    },
  };
}

/**
 * Apply a full dump or a `{ sections: { feel } }` / `{ feel }` object.
 * Unknown keys are ignored; missing feel keys keep current values.
 * @param {object|string} input
 */
export function applyDesignConfig(input) {
  const obj = typeof input === 'string' ? JSON.parse(input) : input;
  if (!obj || typeof obj !== 'object') {
    throw new Error('design config must be an object or JSON string');
  }
  const feel = obj.sections?.feel ?? obj.feel;
  if (feel && typeof feel === 'object') applyFeel(feel);
  return buildExportPayload();
}

async function copyToClipboard(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Download current design as JSON (Blob + `<a download>`).
 * Also copies JSON to the clipboard when the browser allows it.
 */
export async function downloadDesignJson() {
  const payload = buildExportPayload();
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  const filename = `phymetroid-design-${formatDesignStamp()}.json`;

  if (typeof document !== 'undefined') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const copied = await copyToClipboard(json);
  return { filename, json, copied, payload };
}

if (typeof window !== 'undefined') {
  window.__PHYMETROID_APPLY_DESIGN__ = applyDesignConfig;
  window.__PHYMETROID_GET_DESIGN__ = buildExportPayload;
}
