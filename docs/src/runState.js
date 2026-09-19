/**
 * Live run / character state: HP, abilities, inventory, phase, flags, gravity down.
 *
 * Design defaults (maxHp, starting abilities, phase labels, ability defs) live in
 * designConfig.js for the 数值策划 bot. This module is the single source
 * of truth for the current playthrough. HUD and gravity logic read here.
 *
 * Ability tiers live here / in sections.abilities — not mixed into feel numbers.
 * HP is heart-based: default 3/3 (see sections.player.maxHp).
 */

import {
  ABILITY_ID,
  ABILITY_UNLOCK_ORDER,
  canonicalAbilityId,
  getAbilitiesDesign,
  getGravityDesign,
  getPlayerDesign,
  getProgressDesign,
  subscribeDesign,
} from './designConfig.js';
import { normalizeDown } from './gravity.js';

export const ABILITY = Object.freeze({
  GRAVITY_FALL: ABILITY_ID.GRAVITY_FALL,
  SURFACE_WALK: ABILITY_ID.SURFACE_WALK,
  REACTION_JUMP: ABILITY_ID.REACTION_JUMP,
  GRAVITY_FIELD: ABILITY_ID.GRAVITY_FIELD,
  /** @deprecated legacy id `gravity` — runtime value is gravityFall */
  GRAVITY: ABILITY_ID.GRAVITY_FALL,
});

/** Known ability ids (HUD chips), unlock order. */
export const KNOWN_ABILITIES = ABILITY_UNLOCK_ORDER;

const BASE_GRANTS = Object.freeze({
  hasGravity: false,
  canWalk: false,
  canJump: false,
  canWallSlide: false,
  canWallJump: false,
  canCrawlCeiling: false,
  canFly: false,
  hasFriction: false,
  gravityDirections: 'none',
  snapDownOnPickup: false,
  bodyMode: 'float',
  toggleAnytime: false,
  adjustableMagnitude: false,
  airLocksDirection: true,
  usesFeelJump: false,
});

/** @type {Set<(snap: ReturnType<typeof getRunState>) => void>} */
const listeners = new Set();

function defaultDown() {
  return normalizeDown(getGravityDesign().defaultDown);
}

function createInitialRun() {
  const player = getPlayerDesign();
  const progress = getProgressDesign();
  const hp = Math.max(0, Math.min(player.maxHp, player.startingHp));
  const abilities = new Set(player.startingAbilities.map((id) => canonicalAbilityId(id)).filter(Boolean));
  return {
    hp,
    maxHp: player.maxHp,
    abilities,
    items: { ...player.startingItems },
    phase: progress.defaultPhase,
    flags: {},
    visitedRooms: new Set(),
    deaths: 0,
    gravityDown: defaultDown(),
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
  for (const raw of player.startingAbilities) {
    const id = canonicalAbilityId(raw);
    if (id && !run.abilities.has(id)) {
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
    gravityDown: run.gravityDown,
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
  const key = canonicalAbilityId(id);
  return Boolean(key && run.abilities.has(key));
}

export function unlockAbility(id) {
  const key = canonicalAbilityId(id);
  if (!key) return getRunState();
  if (run.abilities.has(key)) return getRunState();
  run.abilities.add(key);
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

/** Stacked grants from unlocked abilities (design section, unlock order). */
export function getAbilityGrants() {
  const defs = getAbilitiesDesign();
  const grants = { ...BASE_GRANTS };
  const order = getPlayerDesign().abilityUnlockOrder ?? ABILITY_UNLOCK_ORDER;
  for (const id of order) {
    if (!hasAbility(id)) continue;
    const extra = defs[id]?.grants;
    if (extra && typeof extra === 'object') Object.assign(grants, extra);
  }
  return grants;
}

export function getGravityDown() {
  return run.gravityDown;
}

export function setGravityDown(axis) {
  const next = normalizeDown(axis, run.gravityDown);
  if (next === run.gravityDown) return getRunState();
  run.gravityDown = next;
  notify();
  return getRunState();
}

export function snapGravityDownToDefault() {
  return setGravityDown(defaultDown());
}

/**
 * Cardinal gravity change: air-locked after gravityFall unless gravityField.
 * Camera is never rotated — this only writes the down axis.
 */
export function canChangeGravityDirection(supported) {
  const grants = getAbilityGrants();
  if (!grants.hasGravity) return false;
  const gravity = getGravityDesign();
  if (hasAbility(gravity.changeDirectionRequires?.exceptAbility || ABILITY.GRAVITY_FIELD)) {
    return true;
  }
  if (grants.toggleAnytime) return true;
  if (gravity.airLocksDirection && hasAbility(gravity.airLockRequiresAbility || ABILITY.GRAVITY_FALL)) {
    return Boolean(supported);
  }
  if (gravity.changeDirectionRequires?.groundedOrSupported) return Boolean(supported);
  return true;
}

export function trySetGravityDown(axis, supported) {
  if (!canChangeGravityDirection(supported)) return { changed: false, down: run.gravityDown };
  const gravity = getGravityDesign();
  let next = axis;
  if (gravity.snapDownToNearestAxis && !hasAbility(ABILITY.GRAVITY_FIELD)) {
    next = normalizeDown(axis, run.gravityDown);
  }
  const prev = run.gravityDown;
  setGravityDown(next);
  return { changed: prev !== run.gravityDown, down: run.gravityDown };
}

/** Advance phase from sections.progress.abilityPhases (or phaseAfterGravity). */
export function advancePhaseOnAbility(abilityId) {
  const id = canonicalAbilityId(abilityId);
  const progress = getProgressDesign();
  const mapped = progress.abilityPhases?.[id];
  if (mapped) {
    setPhase(mapped);
    return getRunState();
  }
  if (id === ABILITY.GRAVITY_FALL) return advancePhaseOnGravity();
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
