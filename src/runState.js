/**
 * Live run / character state: HP, abilities, inventory, phase, flags.
 *
 * Design defaults (maxHp, starting abilities, phase labels) live in
 * designConfig.js for the 数值策划 bot. This module is the single source
 * of truth for the current playthrough. HUD and gravity logic read here.
 *
 * HP is heart-based: default 3/3 (see sections.player.maxHp).
 */

import { getPlayerDesign, getProgressDesign, subscribeDesign } from './designConfig.js';

export const ABILITY = Object.freeze({
  GRAVITY: 'gravity',
  DOUBLE_JUMP: 'doubleJump',
  DASH: 'dash',
});

/** Known ability ids (HUD chips). Unlocked set may include future ids. */
export const KNOWN_ABILITIES = Object.freeze([ABILITY.GRAVITY, ABILITY.DOUBLE_JUMP, ABILITY.DASH]);

/** @type {Set<(snap: ReturnType<typeof getRunState>) => void>} */
const listeners = new Set();

function createInitialRun() {
  const player = getPlayerDesign();
  const progress = getProgressDesign();
  const hp = Math.max(0, Math.min(player.maxHp, player.startingHp));
  return {
    hp,
    maxHp: player.maxHp,
    abilities: new Set(player.startingAbilities),
    items: { ...player.startingItems },
    phase: progress.defaultPhase,
    flags: {},
    visitedRooms: new Set(),
    deaths: 0,
  };
}

/** @type {ReturnType<typeof createInitialRun>} */
let run = createInitialRun();

function notify() {
  const snap = getRunState();
  for (const fn of listeners) {
    try {
      fn(snap);
    } catch (err) {
      console.warn('runState listener failed', err);
    }
  }
}

function syncFromDesign() {
  const player = getPlayerDesign();
  let changed = false;
  if (player.maxHp !== run.maxHp) {
    run.maxHp = player.maxHp;
    run.hp = Math.min(run.hp, run.maxHp);
    changed = true;
  }
  for (const id of player.startingAbilities) {
    if (!run.abilities.has(id)) {
      run.abilities.add(id);
      changed = true;
    }
  }
  if (changed) notify();
}

subscribeDesign(() => syncFromDesign());

/** Subscribe to live run mutations. Returns unsubscribe. */
export function subscribeRun(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Immutable-ish snapshot for HUD / export / console. */
export function getRunState() {
  return {
    hp: run.hp,
    maxHp: run.maxHp,
    abilities: [...run.abilities],
    items: { ...run.items },
    phase: run.phase,
    flags: { ...run.flags },
    visitedRooms: [...run.visitedRooms],
    deaths: run.deaths,
  };
}

export function getHp() {
  return run.hp;
}

export function getMaxHp() {
  return run.maxHp;
}

export function isDead() {
  return run.hp <= 0;
}

/**
 * Apply damage. HP clamps at 0; deaths increments when crossing into dead.
 * Call respawn() to restore HP (prototype has no enemy loop yet).
 */
export function damage(n = 1) {
  const amount = Math.max(0, Math.round(Number(n) || 0));
  if (amount <= 0) return getRunState();
  const wasAlive = run.hp > 0;
  run.hp = Math.max(0, run.hp - amount);
  if (wasAlive && run.hp <= 0) {
    run.deaths += 1;
    run.flags.lastDeathAt = Date.now();
  }
  notify();
  return getRunState();
}

export function heal(n = 1) {
  const amount = Math.max(0, Math.round(Number(n) || 0));
  if (amount <= 0) return getRunState();
  run.hp = Math.min(run.maxHp, run.hp + amount);
  notify();
  return getRunState();
}

/** Restore HP to max after a death stub (does not reset abilities / phase). */
export function respawn() {
  run.hp = run.maxHp;
  notify();
  return getRunState();
}

export function hasAbility(id) {
  return run.abilities.has(id);
}

export function unlockAbility(id) {
  if (typeof id !== 'string' || !id) return getRunState();
  if (run.abilities.has(id)) return getRunState();
  run.abilities.add(id);
  notify();
  return getRunState();
}

export function addItem(id, count = 1) {
  if (typeof id !== 'string' || !id) return getRunState();
  const n = Math.round(Number(count) || 0);
  if (n === 0) return getRunState();
  const next = (run.items[id] ?? 0) + n;
  if (next <= 0) delete run.items[id];
  else run.items[id] = next;
  notify();
  return getRunState();
}

export function getItemCount(id) {
  return run.items[id] ?? 0;
}

export function getItemTotal() {
  let total = 0;
  for (const n of Object.values(run.items)) total += n;
  return total;
}

export function getPhase() {
  return run.phase;
}

export function setPhase(phase) {
  if (typeof phase !== 'string' || !phase || run.phase === phase) return getRunState();
  run.phase = phase;
  notify();
  return getRunState();
}

/** Advance intro → exploration when gravity is first unlocked. */
export function advancePhaseOnGravity() {
  const progress = getProgressDesign();
  if (run.phase === progress.defaultPhase || run.phase === 'intro') {
    setPhase(progress.phaseAfterGravity);
  }
  return getRunState();
}

export function setFlag(key, value = true) {
  if (typeof key !== 'string' || !key) return getRunState();
  run.flags[key] = value;
  notify();
  return getRunState();
}

export function getFlag(key, fallback) {
  return Object.prototype.hasOwnProperty.call(run.flags, key) ? run.flags[key] : fallback;
}

export function markRoomVisited(id) {
  if (!id || run.visitedRooms.has(id)) return false;
  run.visitedRooms.add(id);
  notify();
  return true;
}

export function hasVisitedRoom(id) {
  return run.visitedRooms.has(id);
}

export function getVisitedRooms() {
  return new Set(run.visitedRooms);
}

/** Reset live run from current design defaults (not called by feel-debugger R). */
export function resetRun() {
  run = createInitialRun();
  notify();
  return getRunState();
}

if (typeof window !== 'undefined') {
  window.__PHYMETROID_GET_RUN__ = getRunState;
}
