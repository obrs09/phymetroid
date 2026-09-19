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
 *
 * schemaVersion 2 adds sections.player + sections.progress. v1 feel-only
 * dumps still import (unknown sections ignored; missing keys keep current).
 */

import { GAME_H, GAME_W, WORLD_SCALE } from './rooms.js';

export const SCHEMA_VERSION = 2;
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

/** Heart-based HP. 3/3 default — 数值策划 can raise maxHp without a combat rewrite. */
export const PLAYER_DESIGN_DEFAULTS = Object.freeze({
  maxHp: 3,
  startingHp: 3,
  startingAbilities: Object.freeze([]),
  startingItems: Object.freeze({}),
});

export const PHASE_IDS = Object.freeze(['intro', 'exploration', 'boss']);

export const PROGRESS_DESIGN_DEFAULTS = Object.freeze({
  defaultPhase: 'intro',
  phaseAfterGravity: 'exploration',
  phaseLabels: Object.freeze({
    intro: 'INTRO',
    exploration: 'EXPLORE',
    boss: 'BOSS',
  }),
});

/** @type {Set<(feel: ReturnType<typeof getFeel>) => void>} */
const listeners = new Set();

function cloneFeel(src = FEEL_DEFAULTS) {
  return { ...FEEL_DEFAULTS, ...src };
}

function clonePlayer(src = PLAYER_DESIGN_DEFAULTS) {
  const base = {
    maxHp: PLAYER_DESIGN_DEFAULTS.maxHp,
    startingHp: PLAYER_DESIGN_DEFAULTS.startingHp,
    startingAbilities: [...PLAYER_DESIGN_DEFAULTS.startingAbilities],
    startingItems: { ...PLAYER_DESIGN_DEFAULTS.startingItems },
  };
  return sanitizePlayerPatch(base, src);
}

function cloneProgress(src = PROGRESS_DESIGN_DEFAULTS) {
  const base = {
    defaultPhase: PROGRESS_DESIGN_DEFAULTS.defaultPhase,
    phaseAfterGravity: PROGRESS_DESIGN_DEFAULTS.phaseAfterGravity,
    phaseLabels: { ...PROGRESS_DESIGN_DEFAULTS.phaseLabels },
  };
  return sanitizeProgressPatch(base, src);
}

/** @type {{ schemaVersion: number, sections: { feel: Record<string, number>, player: object, progress: object } }} */
let state = {
  schemaVersion: SCHEMA_VERSION,
  sections: {
    feel: cloneFeel(),
    player: clonePlayer(),
    progress: cloneProgress(),
  },
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

function clampInt(raw, min, max, fallback) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeAbilityList(list) {
  if (!Array.isArray(list)) return null;
  return [...new Set(list.filter((id) => typeof id === 'string' && id.trim()))].map((id) => id.trim());
}

function sanitizeItemMap(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const items = {};
  for (const [id, count] of Object.entries(obj)) {
    if (typeof id !== 'string' || !id.trim()) continue;
    const n = Math.round(Number(count));
    if (!Number.isFinite(n) || n <= 0) continue;
    items[id.trim()] = n;
  }
  return items;
}

function sanitizePlayerPatch(base, patch) {
  const next = {
    maxHp: base.maxHp,
    startingHp: base.startingHp,
    startingAbilities: [...base.startingAbilities],
    startingItems: { ...base.startingItems },
  };
  if (!patch || typeof patch !== 'object') return next;
  if (patch.maxHp !== undefined) next.maxHp = clampInt(patch.maxHp, 1, 20, next.maxHp);
  if (patch.startingHp !== undefined) {
    next.startingHp = clampInt(patch.startingHp, 0, next.maxHp, next.startingHp);
  } else {
    next.startingHp = Math.min(next.startingHp, next.maxHp);
  }
  const abilities = sanitizeAbilityList(patch.startingAbilities);
  if (abilities) next.startingAbilities = abilities;
  const items = sanitizeItemMap(patch.startingItems);
  if (items) next.startingItems = items;
  return next;
}

function sanitizePlayer(patch) {
  return sanitizePlayerPatch(state.sections.player, patch);
}

function sanitizeProgressPatch(base, patch) {
  const next = {
    defaultPhase: base.defaultPhase,
    phaseAfterGravity: base.phaseAfterGravity,
    phaseLabels: { ...base.phaseLabels },
  };
  if (!patch || typeof patch !== 'object') return next;
  if (typeof patch.defaultPhase === 'string' && patch.defaultPhase.trim()) {
    next.defaultPhase = patch.defaultPhase.trim();
  }
  if (typeof patch.phaseAfterGravity === 'string' && patch.phaseAfterGravity.trim()) {
    next.phaseAfterGravity = patch.phaseAfterGravity.trim();
  }
  if (patch.phaseLabels && typeof patch.phaseLabels === 'object') {
    for (const [key, value] of Object.entries(patch.phaseLabels)) {
      if (typeof key === 'string' && key && typeof value === 'string' && value.trim()) {
        next.phaseLabels[key] = value.trim();
      }
    }
  }
  return next;
}

function sanitizeProgress(patch) {
  return sanitizeProgressPatch(state.sections.progress, patch);
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
        sections: {
          feel: getFeel(),
          player: getPlayerDesign(),
          progress: getProgressDesign(),
        },
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
    const player = obj?.sections?.player ?? obj?.player;
    if (player && typeof player === 'object') {
      state.sections.player = sanitizePlayer(player);
    }
    const progress = obj?.sections?.progress ?? obj?.progress;
    if (progress && typeof progress === 'object') {
      state.sections.progress = sanitizeProgress(progress);
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

/** Player design defaults (copy) — not live HP / unlocked abilities. */
export function getPlayerDesign() {
  const p = state.sections.player;
  return {
    maxHp: p.maxHp,
    startingHp: p.startingHp,
    startingAbilities: [...p.startingAbilities],
    startingItems: { ...p.startingItems },
  };
}

/** Progress design defaults (copy) — not live phase / flags. */
export function getProgressDesign() {
  const p = state.sections.progress;
  return {
    defaultPhase: p.defaultPhase,
    phaseAfterGravity: p.phaseAfterGravity,
    phaseLabels: { ...p.phaseLabels },
  };
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
    sections: {
      feel: cloneFeel(),
      player: clonePlayer(),
      progress: cloneProgress(),
    },
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
  const player = getPlayerDesign();
  const progress = getProgressDesign();
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
      player: {
        maxHp: player.maxHp,
        startingHp: player.startingHp,
        startingAbilities: [...player.startingAbilities],
        startingItems: { ...player.startingItems },
      },
      progress: {
        defaultPhase: progress.defaultPhase,
        phaseAfterGravity: progress.phaseAfterGravity,
        phaseLabels: { ...progress.phaseLabels },
      },
    },
  };
}

/**
 * Apply a full dump or `{ sections: { feel, player, progress } }`.
 * Unknown keys are ignored; missing sections / keys keep current values.
 * v1 feel-only JSON is valid. Player/progress patches merge when present.
 * @param {object|string} input
 */
export function applyDesignConfig(input) {
  const obj = typeof input === 'string' ? JSON.parse(input) : input;
  if (!obj || typeof obj !== 'object') {
    throw new Error('design config must be an object or JSON string');
  }
  const feel = obj.sections?.feel ?? obj.feel;
  if (feel && typeof feel === 'object') {
    state.sections.feel = sanitizeFeel(feel);
  }
  const player = obj.sections?.player ?? obj.player;
  if (player && typeof player === 'object') {
    state.sections.player = sanitizePlayer(player);
  }
  const progress = obj.sections?.progress ?? obj.progress;
  if (progress && typeof progress === 'object') {
    state.sections.progress = sanitizeProgress(progress);
  }
  persist();
  notify();
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
