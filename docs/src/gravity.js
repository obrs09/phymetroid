/**
 * Gravity *vector* (not camera). Cardinal down until gravityField.
 * Arcade world.gravity is wired from this vector; camera stays axis-aligned.
 *
 * After gravityField, down may be an angle in degrees (clockwise from
 * screen-down): 0=down, 90=right, 180=up, 270=left. Cardinal strings stay
 * the on-axis spelling so existing run/HUD checks keep working.
 */

export const CARDINAL_AXES = Object.freeze(['up', 'down', 'left', 'right']);

/** Clockwise from screen-down. Q = CCW (−1), E = CW (+1). */
export const CARDINAL_CW = Object.freeze(['down', 'right', 'up', 'left']);

const AXIS_VEC = Object.freeze({
  down: Object.freeze({ x: 0, y: 1 }),
  up: Object.freeze({ x: 0, y: -1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

const CARDINAL_DEG = Object.freeze({
  down: 0,
  right: 90,
  up: 180,
  left: 270,
});

function unsignZero(n) {
  return n === 0 ? 0 : n;
}

/** Degrees clockwise from screen-down, wrapped to [0, 360). */
export function downAngleDeg(axis, fallback = 0) {
  if (typeof axis === 'number' && Number.isFinite(axis)) {
    return ((axis % 360) + 360) % 360;
  }
  if (typeof axis === 'string') {
    if (Object.prototype.hasOwnProperty.call(CARDINAL_DEG, axis)) return CARDINAL_DEG[axis];
    const n = Number(axis);
    if (Number.isFinite(n)) return ((n % 360) + 360) % 360;
  }
  return fallback;
}

export function cardinalFromAngle(deg) {
  const d = downAngleDeg(deg);
  if (d === 0) return 'down';
  if (d === 90) return 'right';
  if (d === 180) return 'up';
  if (d === 270) return 'left';
  return null;
}

export function isCardinal(axis) {
  if (typeof axis === 'number' && Number.isFinite(axis)) {
    return cardinalFromAngle(axis) != null;
  }
  return AXIS_VEC[axis] != null;
}

/**
 * Canonical live down: cardinal string when on-axis, else degrees.
 * Does not snap diagonals to a nearby axis.
 */
export function canonicalizeDown(axis, fallback = 'down') {
  if (typeof axis === 'number' && Number.isFinite(axis)) {
    const d = downAngleDeg(axis);
    return cardinalFromAngle(d) ?? d;
  }
  if (typeof axis === 'string') {
    if (AXIS_VEC[axis]) return axis;
    const n = Number(axis.trim());
    if (Number.isFinite(n)) return canonicalizeDown(n, fallback);
  }
  if (AXIS_VEC[fallback]) return fallback;
  if (typeof fallback === 'number' && Number.isFinite(fallback)) {
    return canonicalizeDown(fallback, 'down');
  }
  return 'down';
}

/** Snap to a cardinal axis string (pre-gravityField callers). */
export function normalizeDown(axis, fallback = 'down') {
  const canon = canonicalizeDown(axis, fallback);
  if (typeof canon === 'string' && AXIS_VEC[canon]) return canon;
  const g = downVector(canon);
  return snapDownToNearestAxis(g.x, g.y, typeof fallback === 'string' ? fallback : 'down');
}

/** Unit vector pointing toward current "down". */
export function downVector(axis) {
  const canon = canonicalizeDown(axis);
  if (typeof canon === 'string' && AXIS_VEC[canon]) return AXIS_VEC[canon];
  const deg = downAngleDeg(canon);
  const rad = (deg * Math.PI) / 180;
  return { x: unsignZero(Math.sin(rad)), y: unsignZero(Math.cos(rad)) };
}

/**
 * Walk tangent: rotate down 90° CW in y-down space so D walks +X when down=down.
 * (gx, gy) → (gy, -gx)
 */
export function walkTangent(axis) {
  const g = downVector(axis);
  return { x: unsignZero(g.y), y: unsignZero(-g.x) };
}

export function rotateCardinal(axis, steps = 1) {
  const cur = normalizeDown(axis);
  const i = CARDINAL_CW.indexOf(cur);
  const n = CARDINAL_CW.length;
  return CARDINAL_CW[(i + steps + n * 4) % n];
}

/**
 * Rotate down by `stepDeg` clockwise per +step (E). Q uses steps = −1.
 * stepDeg 90 keeps cardinals; gravityField uses 45 (Shift: 15).
 */
export function rotateDown(axis, steps = 1, stepDeg = 90) {
  const deg = Number(stepDeg);
  const size = Number.isFinite(deg) && deg !== 0 ? deg : 90;
  return canonicalizeDown(downAngleDeg(axis) + steps * size);
}

/** Snap an arbitrary vector to the nearest cardinal down. */
export function snapDownToNearestAxis(x, y, fallback = 'down') {
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || (nx === 0 && ny === 0)) {
    return fallback;
  }
  if (Math.abs(nx) > Math.abs(ny)) return nx > 0 ? 'right' : 'left';
  if (Math.abs(ny) > Math.abs(nx)) return ny > 0 ? 'down' : 'up';
  // Tie: prefer the existing fallback axis if it matches a tied component.
  if (fallback === 'left' || fallback === 'right') return nx >= 0 ? 'right' : 'left';
  return ny >= 0 ? 'down' : 'up';
}

export function gravityAccel(magnitude, axis) {
  const g = downVector(axis);
  const mag = Number(magnitude);
  const m = Number.isFinite(mag) ? mag : 0;
  return { x: unsignZero(g.x * m), y: unsignZero(g.y * m) };
}

function sideHit(body, side) {
  return Boolean(body?.blocked?.[side] || body?.touching?.[side]);
}

export function isSupportedOnDown(body, axis) {
  if (!body) return false;
  const g = downVector(axis);
  let supported = false;
  if (g.y > 0.35 && sideHit(body, 'down')) supported = true;
  if (g.y < -0.35 && sideHit(body, 'up')) supported = true;
  if (g.x > 0.35 && sideHit(body, 'right')) supported = true;
  if (g.x < -0.35 && sideHit(body, 'left')) supported = true;
  return supported;
}

/** Wall = contact on the axis perpendicular to gravity (for wall-slide). */
export function isTouchingWall(body, axis) {
  if (!body) return false;
  const g = downVector(axis);
  const horizGrav = Math.abs(g.x) > Math.abs(g.y);
  if (horizGrav) {
    return sideHit(body, 'up') || sideHit(body, 'down');
  }
  return sideHit(body, 'left') || sideHit(body, 'right');
}

/**
 * Walk-tangent sign that pushes *away* from the touched wall, or 0 if none.
 * Used by reactionJump wall-jump.
 */
export function wallJumpWalkSign(body, axis) {
  if (!body) return 0;
  const t = walkTangent(axis);
  if (t.x >= 0.5) {
    if (sideHit(body, 'left')) return 1;
    if (sideHit(body, 'right')) return -1;
  } else if (t.x <= -0.5) {
    if (sideHit(body, 'right')) return 1;
    if (sideHit(body, 'left')) return -1;
  }
  if (t.y >= 0.5) {
    if (sideHit(body, 'up')) return 1;
    if (sideHit(body, 'down')) return -1;
  } else if (t.y <= -0.5) {
    if (sideHit(body, 'down')) return 1;
    if (sideHit(body, 'up')) return -1;
  }
  return 0;
}

export function projectAlong(vx, vy, axisUnit) {
  return vx * axisUnit.x + vy * axisUnit.y;
}

/**
 * Compose world velocity from walk (tangent) + along-gravity components.
 */
export function composeVelocity(axis, walkSpeed, alongGravity) {
  const t = walkTangent(axis);
  const g = downVector(axis);
  return {
    x: unsignZero(t.x * walkSpeed + g.x * alongGravity),
    y: unsignZero(t.y * walkSpeed + g.y * alongGravity),
  };
}

export function splitVelocity(vx, vy, axis) {
  const t = walkTangent(axis);
  const g = downVector(axis);
  return {
    walk: projectAlong(vx, vy, t),
    alongGravity: projectAlong(vx, vy, g),
  };
}

const FIXED_TAG = 'fixed';

export function isFixedBody(body) {
  if (!body) return true;
  if (body.immovable) return true;
  if (body.allowGravity === false && body.moves === false) return true;
  const go = body.gameObject;
  if (go?.getData?.(FIXED_TAG) === true) return true;
  return false;
}

export function tagFixed(gameObject) {
  gameObject?.setData?.(FIXED_TAG, true);
  if (gameObject?.body) {
    gameObject.body.setAllowGravity?.(false);
  }
  return gameObject;
}

/**
 * Apply the current gravity vector via Arcade world.gravity.
 * Static / `fixed`-tagged / immovable bodies stay unaffected.
 * Dynamic non-fixed bodies get allowGravity so the vector accelerates them.
 */
export function applyGravityVectorToWorld(world, magnitude, axis, { enabled = true } = {}) {
  if (!world) return { x: 0, y: 0 };
  const accel = enabled ? gravityAccel(magnitude, axis) : { x: 0, y: 0 };
  if (world.gravity?.set) world.gravity.set(accel.x, accel.y);
  else if (world.gravity) {
    world.gravity.x = accel.x;
    world.gravity.y = accel.y;
  }

  const applyBody = (body) => {
    if (!body || !body.enable) return;
    if (isFixedBody(body)) {
      body.setAllowGravity?.(false);
      return;
    }
    if (enabled) body.setAllowGravity?.(true);
    else body.setAllowGravity?.(false);
  };

  if (world.bodies?.iterate) world.bodies.iterate(applyBody);
  else {
    const arr = world.bodies?.getArray?.() ?? world.bodies?.entries ?? [];
    for (const body of arr) applyBody(body);
  }

  return accel;
}

export function axisLabel(axis) {
  const canon = canonicalizeDown(axis);
  switch (canon) {
    case 'up':
      return 'UP';
    case 'left':
      return 'LEFT';
    case 'right':
      return 'RIGHT';
    case 'down':
      return 'DOWN';
    default:
      return `${Math.round(downAngleDeg(canon))}°`;
  }
}

/** Screen-space down glyph (HUD / map). Not a camera rotation. */
export const DOWN_ARROW_GLYPH = Object.freeze({
  down: '↓',
  up: '↑',
  left: '←',
  right: '→',
});

/** Screen-space glyph for cardinal or diagonal down. Camera stays unrotated. */
export function downArrowGlyph(axis) {
  const canon = canonicalizeDown(axis);
  if (DOWN_ARROW_GLYPH[canon]) return DOWN_ARROW_GLYPH[canon];
  const d = downAngleDeg(canon);
  if (d > 0 && d < 90) return '↘';
  if (d > 90 && d < 180) return '↗';
  if (d > 180 && d < 270) return '↖';
  if (d > 270 && d < 360) return '↙';
  return '↓';
}

/** Phaser rotation (clockwise, y-down) for an arrow texture that points +Y. */
export function downArrowRotation(axis) {
  switch (canonicalizeDown(axis)) {
    case 'left':
      return Math.PI / 2;
    case 'up':
      return Math.PI;
    case 'right':
      return -Math.PI / 2;
    case 'down':
      return 0;
    default:
      return (-downAngleDeg(axis) * Math.PI) / 180;
  }
}
