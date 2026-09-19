/**
 * Central mutable design config for live feel tweaks + 策划 bot dumps.
 *
 * Export JSON (camelCase) ↔ in-game labels:
 *   moveSpeed          MOVE SPEED     walk speed after surfaceWalk
 *   airControl         AIR CONTROL    fraction of moveSpeed while airborne
 *   jumpVelocity       JUMP VEL       impulse against gravity down (negative = away)
 *   jumpCutMultiplier  JUMP CUT       keep this * along-gravity vel on early release
 *   gravityY           GRAVITY Y      gravity *vector magnitude* (not camera)
 *   maxFallSpeed       MAX FALL       max speed along current down
 *   coyoteMs           COYOTE MS      grounded grace after leaving a ledge
 *   jumpBufferMs       BUFFER MS      jump-press remember window
 *   floatNudge         FLOAT NUDGE    pre-gravity A/D air nudge
 *
 * Pixel velocities (moveSpeed, jumpVelocity, gravityY, maxFallSpeed, floatNudge)
 * are already WORLD_SCALE × the original 320×180 defaults. Do **not** re-scale
 * v3 dumps. Time / ratio keys are unchanged. Ability tiers live in
 * sections.abilities / runState — never mixed into feel numbers.
 *
 * Persistence: localStorage key `phymetroid.designConfig` (optional boot load).
 * `layoutRevision` (currently 5) stamps baked solids. Boot migrates incompatible
 * dumps (full-height R2_doorframe, pre-pit R3 ceilings) and rewrites storage.
 * Programmatic import: window.__PHYMETROID_APPLY_DESIGN__(objOrJson)
 * or applyDesignConfig(obj). The future 策划 bot can write this same JSON.
 *
 * schemaVersion 4 adds rooms[].solids (explicit rects, default space:local,
 * optional space:world + gapGateId). v3 dumps without solids still import:
 * engine falls back to worldSolids.js hardcode. v1 feel-only and v2
 * player/progress dumps still import. Legacy ability id `gravity` maps to
 * `gravityFall`. Feel debugger keys are unchanged.
 */

import { GAME_H, GAME_W, ROOMS, WORLD_SCALE } from './rooms.js';
import { CARDINAL_AXES, isCardinal, normalizeDown } from './gravity.js';
import DEFAULT_V4 from './design/defaultV4.js';
import { isTallR2SolidNearGate, solidToWorldRect } from './worldSolids.js';

export const SCHEMA_VERSION = 4;
/** Bump when baked solids are incompatible with older localStorage dumps. */
export const LAYOUT_REVISION = 5;
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

/** Field metadata for the F1 debugger (steps, clamps, labels). Feel keys unchanged. */
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

export const ABILITY_ID = Object.freeze({
  GRAVITY_FALL: 'gravityFall',
  SURFACE_WALK: 'surfaceWalk',
  REACTION_JUMP: 'reactionJump',
  GRAVITY_FIELD: 'gravityField',
});

export const ABILITY_UNLOCK_ORDER = Object.freeze([
  ABILITY_ID.GRAVITY_FALL,
  ABILITY_ID.SURFACE_WALK,
  ABILITY_ID.REACTION_JUMP,
  ABILITY_ID.GRAVITY_FIELD,
]);

const LEGACY_ABILITY_MAP = Object.freeze({
  gravity: ABILITY_ID.GRAVITY_FALL,
});

/** 策划 feel aliases → F1 debugger keys. Never rename FEEL_FIELDS. */
const FEEL_KEY_ALIASES = Object.freeze({
  walkSpeed: 'moveSpeed',
  move_speed: 'moveSpeed',
  air_control: 'airControl',
  jumpVel: 'jumpVelocity',
  jumpSpeed: 'jumpVelocity',
  jump_velocity: 'jumpVelocity',
  jumpCut: 'jumpCutMultiplier',
  gravY: 'gravityY',
  gravityStrength: 'gravityY',
  maxFall: 'maxFallSpeed',
  coyote: 'coyoteMs',
  jumpBuffer: 'jumpBufferMs',
  float_nudge: 'floatNudge',
});

export function canonicalAbilityId(id) {
  if (typeof id !== 'string') return '';
  const trimmed = id.trim();
  if (!trimmed) return '';
  return LEGACY_ABILITY_MAP[trimmed] ?? trimmed;
}

export const GRAVITY_DESIGN_DEFAULTS = Object.freeze({
  rotateVectorOnly: true,
  rotateCamera: false,
  affects: 'allNonFixedBodies',
  fixedBodiesTag: 'fixed',
  cardinalOnlyUntil: ABILITY_ID.GRAVITY_FIELD,
  cardinalAxes: CARDINAL_AXES,
  snapDownToNearestAxis: true,
  defaultDown: 'down',
  magnitudeKey: 'feel.gravityY',
  airLocksDirection: true,
  airLockRequiresAbility: ABILITY_ID.GRAVITY_FALL,
  changeDirectionRequires: Object.freeze({
    groundedOrSupported: true,
    exceptAbility: ABILITY_ID.GRAVITY_FIELD,
  }),
});

export const ABILITY_DESIGN_DEFAULTS = Object.freeze({
  [ABILITY_ID.GRAVITY_FALL]: Object.freeze({
    id: ABILITY_ID.GRAVITY_FALL,
    tier: 'I',
    legacyIds: Object.freeze(['gravity']),
    label: 'GRAVITY FALL',
    grants: Object.freeze({
      hasGravity: true,
      canWalk: false,
      canJump: false,
      canWallSlide: false,
      canWallJump: false,
      canCrawlCeiling: false,
      canFly: false,
      gravityDirections: 'cardinal',
      snapDownOnPickup: true,
      bodyMode: 'falling',
    }),
  }),
  [ABILITY_ID.SURFACE_WALK]: Object.freeze({
    id: ABILITY_ID.SURFACE_WALK,
    tier: 'II',
    label: 'SURFACE WALK',
    requires: Object.freeze([ABILITY_ID.GRAVITY_FALL]),
    grants: Object.freeze({
      canWalk: true,
      hasFriction: true,
      canWallSlide: true,
      canJump: false,
      canWallJump: false,
      gravityDirections: 'cardinal',
    }),
  }),
  [ABILITY_ID.REACTION_JUMP]: Object.freeze({
    id: ABILITY_ID.REACTION_JUMP,
    tier: 'II+',
    label: 'REACTION JUMP',
    requires: Object.freeze([ABILITY_ID.SURFACE_WALK]),
    grants: Object.freeze({
      canJump: true,
      canWallJump: true,
      usesFeelJump: true,
    }),
  }),
  [ABILITY_ID.GRAVITY_FIELD]: Object.freeze({
    id: ABILITY_ID.GRAVITY_FIELD,
    tier: 'III',
    label: 'GRAVITY FIELD',
    requires: Object.freeze([ABILITY_ID.REACTION_JUMP]),
    grants: Object.freeze({
      gravityDirections: 'arbitrary',
      toggleAnytime: true,
      adjustableMagnitude: true,
      airLocksDirection: false,
    }),
  }),
});

/** Heart-based HP. 3/3 default — 数值策划 can raise maxHp without a combat rewrite. */
export const PLAYER_DESIGN_DEFAULTS = Object.freeze({
  maxHp: 3,
  startingHp: 3,
  startingAbilities: Object.freeze([]),
  startingItems: Object.freeze({}),
  abilityUnlockOrder: ABILITY_UNLOCK_ORDER,
});

export const PHASE_IDS = Object.freeze([
  'intro',
  'exploration',
  'frictionLesson',
  'jumpLesson',
  'boss',
]);

export const PROGRESS_DESIGN_DEFAULTS = Object.freeze({
  defaultPhase: 'intro',
  phaseAfterGravity: 'exploration',
  phaseLabels: Object.freeze({
    intro: 'INTRO',
    exploration: 'EXPLORE',
    frictionLesson: 'FRICTION',
    jumpLesson: 'JUMP',
    boss: 'BOSS',
  }),
  abilityPhases: Object.freeze({
    [ABILITY_ID.GRAVITY_FALL]: 'exploration',
    [ABILITY_ID.SURFACE_WALK]: 'frictionLesson',
    [ABILITY_ID.REACTION_JUMP]: 'jumpLesson',
    [ABILITY_ID.GRAVITY_FIELD]: 'exploration',
  }),
  pathIntent: Object.freeze({
    zh: Object.freeze([
      'R0：漂浮 → 碰 gravityOrb → 获得 gravityFall（I）。世界重力矢量开启，「下」吸附最近轴；仍不能走/跳。',
      'I 阶段：用四向重力当唯一位移手段（着地时可改方向；空中锁定）。穿过 R1 缺口进入 R2。',
      'R2→R4：R2 顶开通道（第一扇真门，门禁 requireAbility: gravityFall）。右落到门洞右侧短立柱着地，把「下」拨到 up，落体「向上」坠入 R4。门前不得有通高墙。',
      'R4：摩擦房。左上角 surfaceWalk 拾取 → 获得 II。此后可沿当前「下」行走/扒墙滑。',
      '其后（本 JSON 未摆放拾取）：reactionJump → 再后 gravityField（III）。',
      '旧 R3（R1 正下方）保留探索支线，不改 id，不承担摩擦教学。',
    ]),
    en: 'R0 float → orb → gravityFall → reach R2 via cardinal gravity → flip down to up → fall into R4 → surfaceWalk → walk/slide.',
  }),
});

export const PICKUP_DESIGN_DEFAULTS = Object.freeze([
  Object.freeze({
    id: 'gravityOrb',
    ability: ABILITY_ID.GRAVITY_FALL,
    roomId: 'R0',
    x: 256,
    y: 136,
    color: '#ffeb3b',
    requires: Object.freeze([]),
    onCollect: Object.freeze({
      unlockAbility: ABILITY_ID.GRAVITY_FALL,
      addItem: Object.freeze({ gravityOrb: 1 }),
      advancePhase: 'exploration',
      statusBanner: 'GRAVITY ON',
    }),
  }),
  Object.freeze({
    id: 'surfaceWalkOrb',
    ability: ABILITY_ID.SURFACE_WALK,
    roomId: 'R4',
    x: 1320,
    y: -320,
    color: '#80cbc4',
    requires: Object.freeze([ABILITY_ID.GRAVITY_FALL]),
    onCollect: Object.freeze({
      unlockAbility: ABILITY_ID.SURFACE_WALK,
      addItem: Object.freeze({ frictionBoots: 1 }),
      advancePhase: 'frictionLesson',
      statusBanner: 'SURFACE WALK',
    }),
  }),
]);

export const GATE_DESIGN_DEFAULTS = Object.freeze([
  Object.freeze({
    id: 'gate_R2_to_R4',
    fromRoomId: 'R2',
    toRoomId: 'R4',
    kind: 'ceilingPassage',
    requireAbility: ABILITY_ID.GRAVITY_FALL,
    world: Object.freeze({ x: 1520, y: 0, w: 80, h: 16 }),
    intent: '第一扇真正的门/通道。仅 I 可到：在 R2 着地后将「下」拨到 up，落体穿过顶通道坠入 R4。无 surfaceWalk 时不可走过去。',
  }),
  Object.freeze({
    id: 'gate_R1_to_R3',
    fromRoomId: 'R1',
    toRoomId: 'R3',
    kind: 'floorGap',
    requireAbility: ABILITY_ID.GRAVITY_FALL,
    intent: '旧坑道入口；与摩擦教学无关。',
  }),
]);

export const INTENT_DEFAULTS = Object.freeze({
  zh: '只转重力矢量、不转镜头。I 落体教学 → II 摩擦行走（R4）→ reactionJump → III 任意角重力场。旧 R3 保留在 R1 下方；新摩擦房为 R4（R2 正上方）。',
  en: 'Rotate gravity vector only; camera stays axis-aligned. Teach fall body (I) before friction walk (II in R4). Keep legacy R3 under R1; new friction room is R4 above R2.',
});

export const COMPAT_DEFAULTS = Object.freeze({
  fromSchemaVersion: 3,
  notes: Object.freeze([
    'v4 adds rooms[].solids (explicit rects, default space:local). No macros in v4.',
    'v3 dumps without solids still import: engine falls back to worldSolids.js hardcode.',
    'pickups/gates remain the only pickup/gate source of truth; solids may reference gates via gapGateId.',
    'world = room.x/y + local; space:world allowed for cross-room pieces (e.g. doorframe).',
    'Unknown solid.kind → treat as custom/block. Corridor shared vertical walls omitted; engine skips join seals.',
    'Pixel feel already WORLD_SCALE×2; do not re-scale. Feel debugger keys unchanged.',
    "Ability id rename: runtime ABILITY.GRAVITY / 'gravity' → 'gravityFall'. Map on import for old saves.",
    'gate_R1_to_R3 has no world rect; R1→R3 openings come from R1 floorA/B/C pits only.',
    'layoutRevision 5: strip full-height R2_doorframe on load; keep the short catch stub under gate_R2_to_R4.',
    'R3 ceiling openings align to R1 pits only (160–240, 400–480). Seal the middle under R1_floorB.',
    'R3 L/R walls stay sealed even though they share join X 640/1280 — those X values are corridor joins only on the R0–R2 Y band.',
  ]),
});

/** Baked v4 rooms (with solids) from 数值策划. AABB-only ROOMS is the v3 fallback. */
export const ROOM_DESIGN_DEFAULTS = DEFAULT_V4.sections.rooms;

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
    abilityUnlockOrder: [...PLAYER_DESIGN_DEFAULTS.abilityUnlockOrder],
  };
  return sanitizePlayerPatch(base, src);
}

function clonePathIntentMap(src) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  for (const [key, value] of Object.entries(src)) {
    if (typeof value === 'string') out[key] = value;
    else if (Array.isArray(value)) out[key] = [...value];
  }
  return out;
}

function sanitizePathIntentValue(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const lines = value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
    return lines.length ? lines : null;
  }
  return null;
}

function cloneProgress(src = PROGRESS_DESIGN_DEFAULTS) {
  const base = {
    defaultPhase: PROGRESS_DESIGN_DEFAULTS.defaultPhase,
    phaseAfterGravity: PROGRESS_DESIGN_DEFAULTS.phaseAfterGravity,
    phaseLabels: { ...PROGRESS_DESIGN_DEFAULTS.phaseLabels },
    abilityPhases: { ...PROGRESS_DESIGN_DEFAULTS.abilityPhases },
    pathIntent: clonePathIntentMap(PROGRESS_DESIGN_DEFAULTS.pathIntent),
  };
  return sanitizeProgressPatch(base, src);
}

function cloneGravity(src = GRAVITY_DESIGN_DEFAULTS) {
  return sanitizeGravityPatch({ ...GRAVITY_DESIGN_DEFAULTS }, src);
}

function cloneAbilityDef(id, src) {
  const fallback = ABILITY_DESIGN_DEFAULTS[id];
  const base = fallback
    ? {
        ...fallback,
        legacyIds: fallback.legacyIds ? [...fallback.legacyIds] : undefined,
        requires: fallback.requires ? [...fallback.requires] : undefined,
        grants: { ...fallback.grants },
      }
    : { id, grants: {} };
  return sanitizeAbilityDef(base, src);
}

function abilityPatchFrom(src, id) {
  if (!src || typeof src !== 'object') return undefined;
  if (src[id]) return src[id];
  if (id === ABILITY_ID.GRAVITY_FALL && src.gravity) return src.gravity;
  return undefined;
}

function cloneAbilities(src = DEFAULT_V4.sections.abilities) {
  const next = {};
  for (const id of ABILITY_UNLOCK_ORDER) {
    next[id] = cloneAbilityDef(id, abilityPatchFrom(src, id));
  }
  if (src && typeof src === 'object') {
    for (const [rawId, def] of Object.entries(src)) {
      const id = canonicalAbilityId(rawId);
      if (!id || next[id]) continue;
      next[id] = cloneAbilityDef(id, def);
    }
  }
  return next;
}

function cloneRooms(src = ROOM_DESIGN_DEFAULTS) {
  return sanitizeRooms(src);
}

function clonePickups(src = DEFAULT_V4.sections.pickups) {
  return sanitizePickups(src);
}

function cloneGates(src = DEFAULT_V4.sections.gates) {
  return sanitizeGates(src);
}

/** @type {{ schemaVersion: number, sections: object }} */
let state = {
  schemaVersion: SCHEMA_VERSION,
  sections: {
    feel: cloneFeel(),
    gravity: cloneGravity(),
    abilities: cloneAbilities(),
    player: clonePlayer(),
    progress: cloneProgress(),
    rooms: cloneRooms(),
    pickups: clonePickups(),
    gates: cloneGates(),
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

function remapFeelPatch(patch) {
  if (!patch || typeof patch !== 'object') return patch;
  const out = { ...patch };
  for (const [alias, key] of Object.entries(FEEL_KEY_ALIASES)) {
    if (out[key] === undefined && out[alias] !== undefined) out[key] = out[alias];
  }
  return out;
}

function sanitizeFeel(patch) {
  const next = cloneFeel(state.sections.feel);
  const src = remapFeelPatch(patch);
  if (!src || typeof src !== 'object') return next;
  for (const key of Object.keys(FEEL_DEFAULTS)) {
    if (src[key] !== undefined) next[key] = clampFeelValue(key, src[key]);
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
  return [
    ...new Set(
      list
        .map((id) => canonicalAbilityId(id))
        .filter((id) => typeof id === 'string' && id)
    ),
  ];
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
    abilityUnlockOrder: [...(base.abilityUnlockOrder ?? ABILITY_UNLOCK_ORDER)],
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
  const order = sanitizeAbilityList(patch.abilityUnlockOrder);
  if (order && order.length) next.abilityUnlockOrder = order;
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
    abilityPhases: { ...base.abilityPhases },
    pathIntent: clonePathIntentMap(base.pathIntent),
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
  if (patch.abilityPhases && typeof patch.abilityPhases === 'object') {
    for (const [key, value] of Object.entries(patch.abilityPhases)) {
      const id = canonicalAbilityId(key);
      if (id && typeof value === 'string' && value.trim()) {
        next.abilityPhases[id] = value.trim();
      }
    }
  }
  if (patch.pathIntent && typeof patch.pathIntent === 'object') {
    for (const [key, value] of Object.entries(patch.pathIntent)) {
      if (typeof key !== 'string' || !key) continue;
      const nextVal = sanitizePathIntentValue(value);
      if (nextVal !== null) next.pathIntent[key] = nextVal;
    }
  }
  return next;
}

function sanitizeProgress(patch) {
  return sanitizeProgressPatch(state.sections.progress, patch);
}

function sanitizeGravityPatch(base, patch) {
  const next = {
    rotateVectorOnly: base.rotateVectorOnly !== false,
    rotateCamera: base.rotateCamera === true,
    affects: base.affects || 'allNonFixedBodies',
    fixedBodiesTag: base.fixedBodiesTag || 'fixed',
    cardinalOnlyUntil: canonicalAbilityId(base.cardinalOnlyUntil) || ABILITY_ID.GRAVITY_FIELD,
    cardinalAxes: [...(base.cardinalAxes ?? CARDINAL_AXES)],
    snapDownToNearestAxis: base.snapDownToNearestAxis !== false,
    defaultDown: normalizeDown(base.defaultDown),
    magnitudeKey: base.magnitudeKey || 'feel.gravityY',
    airLocksDirection: base.airLocksDirection !== false,
    airLockRequiresAbility: canonicalAbilityId(base.airLockRequiresAbility) || ABILITY_ID.GRAVITY_FALL,
    changeDirectionRequires: {
      groundedOrSupported: base.changeDirectionRequires?.groundedOrSupported !== false,
      exceptAbility:
        canonicalAbilityId(base.changeDirectionRequires?.exceptAbility) || ABILITY_ID.GRAVITY_FIELD,
    },
  };
  if (!patch || typeof patch !== 'object') return next;
  if (patch.rotateVectorOnly !== undefined) next.rotateVectorOnly = patch.rotateVectorOnly !== false;
  if (patch.rotateCamera !== undefined) next.rotateCamera = patch.rotateCamera === true;
  if (typeof patch.affects === 'string' && patch.affects.trim()) next.affects = patch.affects.trim();
  if (typeof patch.fixedBodiesTag === 'string' && patch.fixedBodiesTag.trim()) {
    next.fixedBodiesTag = patch.fixedBodiesTag.trim();
  }
  if (typeof patch.cardinalOnlyUntil === 'string') {
    next.cardinalOnlyUntil = canonicalAbilityId(patch.cardinalOnlyUntil) || next.cardinalOnlyUntil;
  }
  if (Array.isArray(patch.cardinalAxes)) {
    const axes = patch.cardinalAxes.filter((a) => isCardinal(a));
    if (axes.length) next.cardinalAxes = [...new Set(axes)];
  }
  if (patch.snapDownToNearestAxis !== undefined) {
    next.snapDownToNearestAxis = patch.snapDownToNearestAxis !== false;
  }
  if (typeof patch.defaultDown === 'string') next.defaultDown = normalizeDown(patch.defaultDown);
  if (typeof patch.magnitudeKey === 'string' && patch.magnitudeKey.trim()) {
    next.magnitudeKey = patch.magnitudeKey.trim();
  }
  if (patch.airLocksDirection !== undefined) next.airLocksDirection = patch.airLocksDirection !== false;
  if (typeof patch.airLockRequiresAbility === 'string') {
    next.airLockRequiresAbility =
      canonicalAbilityId(patch.airLockRequiresAbility) || next.airLockRequiresAbility;
  }
  if (patch.changeDirectionRequires && typeof patch.changeDirectionRequires === 'object') {
    if (patch.changeDirectionRequires.groundedOrSupported !== undefined) {
      next.changeDirectionRequires.groundedOrSupported =
        patch.changeDirectionRequires.groundedOrSupported !== false;
    }
    if (typeof patch.changeDirectionRequires.exceptAbility === 'string') {
      next.changeDirectionRequires.exceptAbility =
        canonicalAbilityId(patch.changeDirectionRequires.exceptAbility) ||
        next.changeDirectionRequires.exceptAbility;
    }
  }
  return next;
}

function sanitizeGravity(patch) {
  return sanitizeGravityPatch(state.sections.gravity, patch);
}

function sanitizeAbilityDef(base, patch) {
  const next = {
    id: canonicalAbilityId(base.id) || base.id,
    tier: base.tier,
    label: base.label,
    grants: { ...(base.grants || {}) },
  };
  if (base.legacyIds) next.legacyIds = [...base.legacyIds];
  if (base.requires) next.requires = [...base.requires];
  if (typeof base.why === 'string' && base.why.trim()) next.why = base.why.trim();
  if (!patch || typeof patch !== 'object') return next;
  if (typeof patch.id === 'string') next.id = canonicalAbilityId(patch.id) || next.id;
  if (typeof patch.tier === 'string' && patch.tier.trim()) next.tier = patch.tier.trim();
  if (typeof patch.label === 'string' && patch.label.trim()) next.label = patch.label.trim();
  if (typeof patch.why === 'string' && patch.why.trim()) next.why = patch.why.trim();
  if (Array.isArray(patch.legacyIds)) {
    next.legacyIds = [
      ...new Set(patch.legacyIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())),
    ];
  }
  const requires = sanitizeAbilityList(patch.requires);
  if (requires) next.requires = requires;
  if (patch.grants && typeof patch.grants === 'object') {
    next.grants = { ...next.grants, ...patch.grants };
    if (typeof next.grants.gravityDirections === 'string') {
      next.grants.gravityDirections = next.grants.gravityDirections.trim();
    }
  }
  return next;
}

function sanitizeAbilities(patch) {
  return cloneAbilities(patch && typeof patch === 'object' ? patch : state.sections.abilities);
}

function sanitizeSolid(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const w = Number(raw.w);
  const h = Number(raw.h);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  const kind = typeof raw.kind === 'string' && raw.kind.trim() ? raw.kind.trim() : 'custom';
  const space = raw.space === 'world' ? 'world' : 'local';
  const solid = { x, y, w, h, kind, space };
  if (typeof raw.id === 'string' && raw.id.trim()) solid.id = raw.id.trim();
  if (typeof raw.gapGateId === 'string' && raw.gapGateId.trim()) {
    solid.gapGateId = raw.gapGateId.trim();
  }
  solid.fixed = raw.fixed !== false;
  return solid;
}

function sanitizeRooms(list) {
  const fallback = ROOM_DESIGN_DEFAULTS;
  const src = Array.isArray(list) && list.length ? list : fallback;
  const rooms = [];
  const seen = new Set();
  for (const raw of src) {
    if (!raw || typeof raw !== 'object') continue;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id || seen.has(id)) continue;
    const x = Number(raw.x);
    const y = Number(raw.y);
    const w = Number(raw.w);
    const h = Number(raw.h);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    seen.add(id);
    const room = { id, x, y, w, h };
    if (typeof raw.role === 'string' && raw.role.trim()) room.role = raw.role.trim();
    if (typeof raw.intent === 'string' && raw.intent.trim()) room.intent = raw.intent.trim();
    if (Array.isArray(raw.solids)) {
      const solids = raw.solids.map(sanitizeSolid).filter(Boolean);
      if (solids.length) room.solids = solids;
    }
    rooms.push(room);
  }
  return rooms.length ? rooms : fallback.map((r) => ({ ...r, solids: r.solids ? r.solids.map((s) => ({ ...s })) : undefined }));
}

function bakedR2Doorframe() {
  const r2 = ROOM_DESIGN_DEFAULTS.find((r) => r.id === 'R2');
  const door = r2?.solids?.find((s) => s.id === 'R2_doorframe');
  return door
    ? { ...door }
    : {
        id: 'R2_doorframe',
        kind: 'doorframe',
        space: 'local',
        x: 320,
        y: 264,
        w: 24,
        h: 64,
        fixed: true,
      };
}

function bakedR3Ceilings() {
  const r3 = ROOM_DESIGN_DEFAULTS.find((r) => r.id === 'R3');
  const ceils = (r3?.solids || []).filter((s) => s.kind === 'ceiling').map((s) => ({ ...s }));
  if (ceils.length) return ceils;
  return [
    { id: 'R3_ceilL', kind: 'ceiling', space: 'local', x: 0, y: 0, w: 160, h: 16, fixed: true },
    { id: 'R3_ceilM', kind: 'ceiling', space: 'local', x: 240, y: 0, w: 160, h: 16, fixed: true },
    { id: 'R3_ceilR', kind: 'ceiling', space: 'local', x: 480, y: 0, w: 160, h: 16, fixed: true },
  ];
}

function isLegacyR3CeilingLayout(room) {
  const ceils = (room.solids || []).filter((s) => s.kind === 'ceiling' && s.space !== 'world');
  if (ceils.length !== 2) return false;
  const sorted = [...ceils].sort((a, b) => a.x - b.x);
  return sorted[0].x === 0 && sorted[0].w === 200 && sorted[1].x === 440 && sorted[1].w === 200;
}

function migrateR2Doorframe(room) {
  if (!Array.isArray(room.solids) || !room.solids.length) return { room, changed: false };
  let changed = false;
  let replacedDoor = false;
  const solids = [];
  for (const s of room.solids) {
    const world = solidToWorldRect(room, s);
    const isDoor = s.id === 'R2_doorframe' || s.kind === 'doorframe';
    if (isTallR2SolidNearGate(world)) {
      changed = true;
      if (isDoor && !replacedDoor) {
        solids.push(bakedR2Doorframe());
        replacedDoor = true;
      }
      continue;
    }
    solids.push(s);
  }
  if (changed && !replacedDoor && !solids.some((s) => s.id === 'R2_doorframe' || s.kind === 'doorframe')) {
    solids.push(bakedR2Doorframe());
  }
  return { room: changed ? { ...room, solids } : room, changed };
}

function migrateR3Ceilings(room) {
  if (!Array.isArray(room.solids) || !room.solids.length) return { room, changed: false };
  if (!isLegacyR3CeilingLayout(room)) return { room, changed: false };
  const solids = room.solids.filter((s) => s.kind !== 'ceiling').concat(bakedR3Ceilings());
  return { room: { ...room, solids }, changed: true };
}

/**
 * Replace known-incompatible v4 solids (tall R2_doorframe, pre-pit R3 ceilings).
 * Idempotent on the current bake.
 */
export function migrateLegacyRoomSolids(rooms) {
  if (!Array.isArray(rooms)) return { rooms, changed: false };
  let changed = false;
  const next = rooms.map((room) => {
    if (room.id === 'R2') {
      const result = migrateR2Doorframe(room);
      changed = changed || result.changed;
      return result.room;
    }
    if (room.id === 'R3') {
      const result = migrateR3Ceilings(room);
      changed = changed || result.changed;
      return result.room;
    }
    return room;
  });
  return { rooms: next, changed };
}

function sanitizeOnCollect(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const next = {};
  if (typeof raw.unlockAbility === 'string') {
    next.unlockAbility = canonicalAbilityId(raw.unlockAbility);
  }
  const items = sanitizeItemMap(raw.addItem);
  if (items) next.addItem = items;
  if (typeof raw.advancePhase === 'string' && raw.advancePhase.trim()) {
    next.advancePhase = raw.advancePhase.trim();
  }
  if (typeof raw.statusBanner === 'string' && raw.statusBanner.trim()) {
    next.statusBanner = raw.statusBanner.trim();
  }
  return next;
}

function sanitizePickups(list) {
  const src = Array.isArray(list) && list.length ? list : PICKUP_DESIGN_DEFAULTS;
  const pickups = [];
  const seen = new Set();
  for (const raw of src) {
    if (!raw || typeof raw !== 'object') continue;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id || seen.has(id)) continue;
    const x = Number(raw.x);
    const y = Number(raw.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    seen.add(id);
    const requires = sanitizeAbilityList(raw.requires);
    const pickup = {
      id,
      ability: canonicalAbilityId(raw.ability) || id,
      roomId: typeof raw.roomId === 'string' ? raw.roomId.trim() : '',
      x,
      y,
      requires: requires ?? [],
      onCollect: sanitizeOnCollect(raw.onCollect),
    };
    if (typeof raw.color === 'string' && raw.color.trim()) pickup.color = raw.color.trim();
    if (typeof raw.notes === 'string' && raw.notes.trim()) pickup.notes = raw.notes.trim();
    pickups.push(pickup);
  }
  return pickups;
}

function sanitizeGates(list) {
  const src = Array.isArray(list) && list.length ? list : GATE_DESIGN_DEFAULTS;
  const gates = [];
  const seen = new Set();
  for (const raw of src) {
    if (!raw || typeof raw !== 'object') continue;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const gate = {
      id,
      fromRoomId: typeof raw.fromRoomId === 'string' ? raw.fromRoomId.trim() : '',
      toRoomId: typeof raw.toRoomId === 'string' ? raw.toRoomId.trim() : '',
      kind: typeof raw.kind === 'string' ? raw.kind.trim() : 'passage',
      requireAbility: canonicalAbilityId(raw.requireAbility),
    };
    if (raw.world && typeof raw.world === 'object') {
      const x = Number(raw.world.x);
      const y = Number(raw.world.y);
      const w = Number(raw.world.w);
      const h = Number(raw.world.h);
      if ([x, y, w, h].every(Number.isFinite)) gate.world = { x, y, w, h };
    }
    if (typeof raw.intent === 'string' && raw.intent.trim()) gate.intent = raw.intent.trim();
    gates.push(gate);
  }
  return gates;
}

/**
 * Graph checks for a 策划 dump. Logs errors; never throws (boot stays up).
 * @returns {string[]}
 */
export function validateDesignGraph(sections = state.sections) {
  const errors = [];
  const rooms = Array.isArray(sections?.rooms) ? sections.rooms : [];
  const pickups = Array.isArray(sections?.pickups) ? sections.pickups : [];
  const gates = Array.isArray(sections?.gates) ? sections.gates : [];
  const roomIds = new Set(rooms.map((r) => r.id).filter(Boolean));
  const gateIds = new Set(gates.map((g) => g.id).filter(Boolean));

  for (const p of pickups) {
    if (p.roomId && !roomIds.has(p.roomId)) {
      errors.push(`pickup "${p.id}" references missing roomId "${p.roomId}"`);
    }
  }
  for (const g of gates) {
    if (!g.fromRoomId || !roomIds.has(g.fromRoomId)) {
      errors.push(`gate "${g.id}" missing fromRoomId "${g.fromRoomId || ''}"`);
    }
    if (!g.toRoomId || !roomIds.has(g.toRoomId)) {
      errors.push(`gate "${g.id}" missing toRoomId "${g.toRoomId || ''}"`);
    }
  }
  return errors;
}

function warnMissingGapGateIds(sections = state.sections) {
  const gates = Array.isArray(sections?.gates) ? sections.gates : [];
  const rooms = Array.isArray(sections?.rooms) ? sections.rooms : [];
  const gateIds = new Set(gates.map((g) => g.id).filter(Boolean));
  for (const room of rooms) {
    for (const s of room.solids || []) {
      if (s.gapGateId && !gateIds.has(s.gapGateId)) {
        console.warn(
          `[phymetroid] design validation: solid "${s.id || '?'}" in ${room.id} references missing gapGateId "${s.gapGateId}" (skip hole)`
        );
      }
    }
  }
}

function logDesignValidation(errors) {
  for (const msg of errors) {
    console.error(`[phymetroid] design validation: ${msg}`);
  }
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
    ls.setItem(DESIGN_STORAGE_KEY, JSON.stringify(buildExportPayload()));
  } catch {
    // quota / private mode — live tweaks still work this session
  }
}

function applyImportedObject(obj) {
  const feel = obj?.sections?.feel ?? obj?.feel;
  if (feel && typeof feel === 'object') {
    state.sections.feel = sanitizeFeel(feel);
  }
  const gravity = obj?.sections?.gravity ?? obj?.gravity;
  if (gravity && typeof gravity === 'object') {
    state.sections.gravity = sanitizeGravity(gravity);
  }
  const abilities = obj?.sections?.abilities ?? obj?.abilities;
  if (abilities && typeof abilities === 'object') {
    state.sections.abilities = sanitizeAbilities(abilities);
  }
  const player = obj?.sections?.player ?? obj?.player;
  if (player && typeof player === 'object') {
    state.sections.player = sanitizePlayer(player);
  }
  const progress = obj?.sections?.progress ?? obj?.progress;
  if (progress && typeof progress === 'object') {
    state.sections.progress = sanitizeProgress(progress);
  }
  const rooms = obj?.sections?.rooms ?? obj?.rooms;
  if (Array.isArray(rooms)) {
    state.sections.rooms = sanitizeRooms(rooms);
  }
  const pickups = obj?.sections?.pickups ?? obj?.pickups;
  if (Array.isArray(pickups)) {
    state.sections.pickups = sanitizePickups(pickups);
  }
  const gates = obj?.sections?.gates ?? obj?.gates;
  if (Array.isArray(gates)) {
    state.sections.gates = sanitizeGates(gates);
  }
  const migrated = migrateLegacyRoomSolids(state.sections.rooms);
  state.sections.rooms = migrated.rooms;
  logDesignValidation(validateDesignGraph(state.sections));
  warnMissingGapGateIds(state.sections);
  return { migrated: migrated.changed };
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
    const result = applyImportedObject(obj);
    // Rewrite stale dumps (tall R2_doorframe / old R3 ceilings / missing layoutRevision).
    if (result.migrated || Number(obj.layoutRevision) !== LAYOUT_REVISION) {
      persist();
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
    abilityUnlockOrder: [...(p.abilityUnlockOrder ?? ABILITY_UNLOCK_ORDER)],
  };
}

/** Progress design defaults (copy) — not live phase / flags. */
export function getProgressDesign() {
  const p = state.sections.progress;
  return {
    defaultPhase: p.defaultPhase,
    phaseAfterGravity: p.phaseAfterGravity,
    phaseLabels: { ...p.phaseLabels },
    abilityPhases: { ...p.abilityPhases },
    pathIntent: clonePathIntentMap(p.pathIntent),
  };
}

export function getGravityDesign() {
  const g = state.sections.gravity;
  return {
    ...g,
    cardinalAxes: [...g.cardinalAxes],
    changeDirectionRequires: { ...g.changeDirectionRequires },
  };
}

export function getAbilitiesDesign() {
  return cloneAbilities(state.sections.abilities);
}

export function getAbilityDesign(id) {
  const key = canonicalAbilityId(id);
  const def = state.sections.abilities[key];
  return def ? cloneAbilityDef(key, def) : null;
}

export function getRooms() {
  return state.sections.rooms.map((r) => ({
    ...r,
    solids: r.solids ? r.solids.map((s) => ({ ...s })) : undefined,
  }));
}

export function getPickups() {
  return state.sections.pickups.map((p) => ({
    ...p,
    requires: [...p.requires],
    onCollect: {
      ...p.onCollect,
      addItem: p.onCollect.addItem ? { ...p.onCollect.addItem } : undefined,
    },
  }));
}

export function getGates() {
  return state.sections.gates.map((g) => ({
    ...g,
    world: g.world ? { ...g.world } : undefined,
  }));
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
      gravity: cloneGravity(),
      abilities: cloneAbilities(),
      player: clonePlayer(),
      progress: cloneProgress(),
      rooms: cloneRooms(),
      pickups: clonePickups(),
      gates: cloneGates(),
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

function exportAbility(id) {
  const a = state.sections.abilities[id] ?? cloneAbilityDef(id);
  const out = {
    id: a.id,
    tier: a.tier,
    label: a.label,
    grants: { ...a.grants },
  };
  if (a.legacyIds?.length) out.legacyIds = [...a.legacyIds];
  if (a.requires?.length) out.requires = [...a.requires];
  if (a.why) out.why = a.why;
  return out;
}

function exportGravity() {
  const g = getGravityDesign();
  return {
    rotateVectorOnly: g.rotateVectorOnly,
    rotateCamera: false,
    affects: g.affects,
    fixedBodiesTag: g.fixedBodiesTag,
    cardinalOnlyUntil: g.cardinalOnlyUntil,
    cardinalAxes: [...g.cardinalAxes],
    snapDownToNearestAxis: g.snapDownToNearestAxis,
    defaultDown: g.defaultDown,
    magnitudeKey: g.magnitudeKey,
    airLocksDirection: g.airLocksDirection,
    airLockRequiresAbility: g.airLockRequiresAbility,
    changeDirectionRequires: { ...g.changeDirectionRequires },
  };
}

/** Bot-friendly export payload (stable key order). schemaVersion 4. */
export function buildExportPayload(date = new Date()) {
  const feel = getFeel();
  const player = getPlayerDesign();
  const progress = getProgressDesign();
  return {
    schemaVersion: SCHEMA_VERSION,
    layoutRevision: LAYOUT_REVISION,
    game: GAME_ID,
    exportedAt: date.toISOString(),
    logicalW: GAME_W,
    logicalH: GAME_H,
    worldScale: WORLD_SCALE,
    intent: { ...INTENT_DEFAULTS },
    compat: {
      fromSchemaVersion: COMPAT_DEFAULTS.fromSchemaVersion,
      notes: [...COMPAT_DEFAULTS.notes],
    },
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
      gravity: exportGravity(),
      abilities: {
        [ABILITY_ID.GRAVITY_FALL]: exportAbility(ABILITY_ID.GRAVITY_FALL),
        [ABILITY_ID.SURFACE_WALK]: exportAbility(ABILITY_ID.SURFACE_WALK),
        [ABILITY_ID.REACTION_JUMP]: exportAbility(ABILITY_ID.REACTION_JUMP),
        [ABILITY_ID.GRAVITY_FIELD]: exportAbility(ABILITY_ID.GRAVITY_FIELD),
      },
      player: {
        maxHp: player.maxHp,
        startingHp: player.startingHp,
        startingAbilities: [...player.startingAbilities],
        startingItems: { ...player.startingItems },
        abilityUnlockOrder: [...player.abilityUnlockOrder],
      },
      progress: {
        defaultPhase: progress.defaultPhase,
        phaseAfterGravity: progress.phaseAfterGravity,
        phaseLabels: { ...progress.phaseLabels },
        abilityPhases: { ...progress.abilityPhases },
        pathIntent: { ...progress.pathIntent },
      },
      rooms: getRooms(),
      pickups: getPickups(),
      gates: getGates(),
    },
  };
}

/**
 * Apply a full dump or `{ sections: { feel, player, progress, rooms, ... } }`.
 * Unknown keys are ignored; missing sections / keys keep current values.
 * v1 feel-only, v2 player/progress, and v3 (no solids) JSON are valid.
 * Legacy ability id `gravity` maps to `gravityFall`. Feel numbers are not re-scaled.
 * Graph errors (missing roomId / gate / gapGateId) are logged, not thrown.
 * @param {object|string} input
 */
export function applyDesignConfig(input) {
  const obj = typeof input === 'string' ? JSON.parse(input) : input;
  if (!obj || typeof obj !== 'object') {
    throw new Error('design config must be an object or JSON string');
  }
  applyImportedObject(obj);
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
  window.__PHYMETROID_VALIDATE_DESIGN__ = () => validateDesignGraph();
}
