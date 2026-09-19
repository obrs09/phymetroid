/**
 * Gravity *vector* (not camera). Cardinal down until gravityField.
 * Arcade world.gravity is wired from this vector; camera stays axis-aligned.
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

export function isCardinal(axis) {
  return AXIS_VEC[axis] != null;
}

export function normalizeDown(axis, fallback = 'down') {
  return isCardinal(axis) ? axis : fallback;
}

/** Unit vector pointing toward current "down". */
export function downVector(axis) {
  return AXIS_VEC[normalizeDown(axis)];
}

/**
 * Walk tangent: rotate down 90° CW in y-down space so D walks +X when down=down.
 * (gx, gy) → (gy, -gx)
 */
function unsignZero(n) {
  return n === 0 ? 0 : n;
}

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

export function isSupportedOnDown(body, axis) {
  if (!body) return false;
  switch (normalizeDown(axis)) {
    case 'up':
      return Boolean(body.blocked?.up || body.touching?.up);
    case 'left':
      return Boolean(body.blocked?.left || body.touching?.left);
    case 'right':
      return Boolean(body.blocked?.right || body.touching?.right);
    case 'down':
    default:
      return Boolean(body.blocked?.down || body.touching?.down);
  }
}

/** Wall = contact on the axis perpendicular to gravity (for wall-slide). */
export function isTouchingWall(body, axis) {
  if (!body) return false;
  switch (normalizeDown(axis)) {
    case 'left':
    case 'right':
      return Boolean(
        body.blocked?.up ||
          body.blocked?.down ||
          body.touching?.up ||
          body.touching?.down
      );
    case 'up':
    case 'down':
    default:
      return Boolean(
        body.blocked?.left ||
          body.blocked?.right ||
          body.touching?.left ||
          body.touching?.right
      );
  }
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
  switch (normalizeDown(axis)) {
    case 'up':
      return 'UP';
    case 'left':
      return 'LEFT';
    case 'right':
      return 'RIGHT';
    default:
      return 'DOWN';
  }
}
