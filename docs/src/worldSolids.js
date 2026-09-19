/**
 * Static room solids. Stub for a future Tiled tilemap.
 * R3 stays the legacy pit under R1. R4 is the new friction room above R2.
 * The R2 ceiling / R4 floor share gate_R2_to_R4 as a passage (not a camera rotate).
 *
 * R0–R1–R2 is a clear horizontal corridor. Adjacent floor/ceiling slabs at a
 * room join are merged into one body so Arcade AABB does not treat the seam
 * as a ghost wall (classic internal-edge). Shared vertical walls at those
 * joins are skipped (full-height doorway).
 */

import { px } from './rooms.js';
import { tagFixed } from './gravity.js';

function addSolidRect(scene, solids, x, y, w, h, color = 0x5d4037) {
  if (w <= 0 || h <= 0) return null;
  const key = `solid_${Math.round(x)}_${Math.round(y)}_${Math.round(w)}_${Math.round(h)}_${color}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(2, 0x8d6e63, 1);
    g.strokeRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }
  const s = solids.create(x + w / 2, y + h / 2, key);
  s.refreshBody();
  s.setDepth(5);
  tagFixed(s);
  return s;
}

function roomById(rooms, id) {
  return rooms.find((r) => r.id === id) || null;
}

function ceilingGap(gates, fromId, toId) {
  return gates.find(
    (g) => g.kind === 'ceilingPassage' && g.fromRoomId === fromId && g.toRoomId === toId && g.world
  );
}

/** Split a horizontal slab around an optional world-space gap. */
function addHorizontalWithGap(addRect, x, y, w, h, gap, color) {
  if (!gap) {
    addRect(x, y, w, h, color);
    return;
  }
  const gapX = gap.x;
  const gapW = gap.w;
  const leftW = Math.max(0, gapX - x);
  const rightX = gapX + gapW;
  const rightW = Math.max(0, x + w - rightX);
  if (leftW > 0) addRect(x, y, leftW, h, color);
  if (rightW > 0) addRect(rightX, y, rightW, h, color);
}

/** Horizontally adjacent room-join X values on the R0–R1–R2 band. */
export function corridorJoinXs(rooms = []) {
  const joins = [];
  const band = rooms.filter((r) => r && (r.id === 'R0' || r.id === 'R1' || r.id === 'R2'));
  for (const a of band) {
    for (const b of band) {
      if (a.id >= b.id) continue;
      const sameBand = a.y === b.y && a.h === b.h;
      if (!sameBand) continue;
      if (a.x + a.w === b.x) joins.push(b.x);
      if (b.x + b.w === a.x) joins.push(a.x);
    }
  }
  return [...new Set(joins)].sort((x, y) => x - y);
}

function overlapsJoinX(x, w, joinX, pad = 1) {
  return x <= joinX + pad && x + w >= joinX - pad;
}

/**
 * Skip a full-height (or tall) wall that would seal a corridor join.
 * A large / full-height doorway is "place nothing" — lintels stay on the
 * room ceiling/floor slabs instead.
 */
function addWallUnlessCorridorJoin(addRect, joinXs, x, y, w, h, color) {
  const sealsJoin = joinXs.some((jx) => overlapsJoinX(x, w, jx) && h > px(40));
  if (sealsJoin) return;
  addRect(x, y, w, h, color);
}

function mergeTouchingHorizontal(rects) {
  const items = rects
    .filter((r) => r.w > 0 && r.h > 0)
    .map((r) => ({ ...r }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const out = [];
  for (const r of items) {
    const prev = out[out.length - 1];
    const sameBand =
      prev &&
      prev.y === r.y &&
      prev.h === r.h &&
      prev.color === r.color &&
      r.x <= prev.x + prev.w + 1;
    if (sameBand) {
      prev.w = Math.max(prev.x + prev.w, r.x + r.w) - prev.x;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/**
 * Pure geometry used by buildWorldSolids and schema tests.
 * @returns {{ x: number, y: number, w: number, h: number, color: number, tag?: string }[]}
 */
export function listWorldSolidRects(rooms, gates = []) {
  const rects = [];
  const addRect = (x, y, w, h, color = 0x5d4037, tag) => {
    if (w <= 0 || h <= 0) return;
    rects.push({ x, y, w, h, color, tag });
  };

  const floorH = px(16);
  const wallW = px(8);
  const platH = px(8);
  const r2r4 = ceilingGap(gates, 'R2', 'R4');
  const gap = r2r4?.world ?? { x: 1520, y: 0, w: 80, h: 16 };
  const joinXs = corridorJoinXs(rooms);
  const pendingFloor = [];
  const pendingCeil = [];

  const addFloor = (x, y, w, h, color) => pendingFloor.push({ x, y, w, h, color, tag: 'floor' });
  const addCeil = (x, y, w, h, color) => pendingCeil.push({ x, y, w, h, color, tag: 'ceiling' });
  const addWall = (x, y, w, h, color) => addWallUnlessCorridorJoin(addRect, joinXs, x, y, w, h, color);

  const r0 = roomById(rooms, 'R0');
  if (r0) {
    addFloor(r0.x, r0.y + r0.h - floorH, r0.w, floorH, 0x4e342e);
    addWall(r0.x, r0.y, wallW, r0.h, 0x3e2723);
    addCeil(r0.x, r0.y, r0.w, wallW, 0x3e2723);
    addRect(r0.x + px(100), r0.y + px(100), px(48), platH, 0x6d4c41, 'plat');
    addRect(r0.x + px(200), r0.y + r0.h - floorH - px(24), px(24), px(24), 0x795548, 'block');
  }

  const r1 = roomById(rooms, 'R1');
  if (r1) {
    // Intentional pits down to R3 — keep the gaps, only merge the join slabs.
    addFloor(r1.x, r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addFloor(r1.x + px(120), r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addFloor(r1.x + px(240), r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addCeil(r1.x, r1.y, r1.w, wallW, 0x3e2723);
    addRect(r1.x + px(40), r1.y + px(90), px(40), platH, 0x6d4c41, 'plat');
    addRect(r1.x + px(180), r1.y + px(70), px(56), platH, 0x6d4c41, 'plat');
  }

  const r2 = roomById(rooms, 'R2');
  if (r2) {
    addFloor(r2.x, r2.y + r2.h - floorH, r2.w, floorH, 0x4e342e);
    addWall(r2.x + r2.w - wallW, r2.y, wallW, r2.h, 0x3e2723);
    addHorizontalWithGap(addCeil, r2.x, r2.y, r2.w, wallW, gap, 0x3e2723);
    addRect(r2.x + px(60), r2.y + px(110), px(40), platH, 0x6d4c41, 'plat');
    addRect(r2.x + px(160), r2.y + px(80), px(40), platH, 0x6d4c41, 'plat');
    addRect(r2.x + px(240), r2.y + r2.h - floorH - px(32), px(32), px(32), 0x795548, 'block');
    // Doorframe just left of the ceiling gate. A leftward I-mode fall at any
    // height grounds on this face, then flip down / up through the hole.
    const frameW = px(12);
    addRect(gap.x - frameW, r2.y + wallW, frameW, r2.h - floorH - wallW, 0x6d4c41, 'doorframe');
  }

  for (const r of mergeTouchingHorizontal(pendingFloor)) {
    addRect(r.x, r.y, r.w, r.h, r.color, r.tag);
  }
  for (const r of mergeTouchingHorizontal(pendingCeil)) {
    addRect(r.x, r.y, r.w, r.h, r.color, r.tag);
  }

  const r3 = roomById(rooms, 'R3');
  if (r3) {
    addRect(r3.x, r3.y + r3.h - floorH, r3.w, floorH, 0x4e342e, 'floor');
    addRect(r3.x, r3.y, wallW, r3.h, 0x3e2723, 'wall');
    addRect(r3.x + r3.w - wallW, r3.y, wallW, r3.h, 0x3e2723, 'wall');
    addRect(r3.x + px(80), r3.y + px(80), px(48), platH, 0x6d4c41, 'plat');
    addRect(r3.x + px(180), r3.y + px(100), px(48), platH, 0x6d4c41, 'plat');
    addRect(r3.x, r3.y, px(100), wallW, 0x3e2723, 'ceiling');
    addRect(r3.x + px(220), r3.y, px(100), wallW, 0x3e2723, 'ceiling');
  }

  const r4 = roomById(rooms, 'R4');
  if (r4) {
    addHorizontalWithGap(addRect, r4.x, r4.y + r4.h - floorH, r4.w, floorH, gap, 0x37474f);
    addRect(r4.x, r4.y, r4.w, wallW, 0x263238, 'ceiling');
    addRect(r4.x, r4.y, wallW, r4.h, 0x263238, 'wall');
    addRect(r4.x + r4.w - wallW, r4.y, wallW, r4.h, 0x263238, 'wall');
    addRect(r4.x + px(20), r4.y + px(28), px(56), platH, 0x546e7a, 'plat');
    addRect(r4.x + px(140), r4.y + px(90), px(48), platH, 0x546e7a, 'plat');
    addRect(r4.x + px(280), r4.y + px(50), wallW, px(90), 0x455a64, 'wall');
  }

  return rects;
}

/**
 * True when a vertical band around `x` is sealed by a tall solid
 * (floor/ceiling slabs and short platforms do not count).
 */
/** Which vertical sides of a room are corridor joins (leave the stroke open). */
export function corridorOpenEdges(room, rooms = []) {
  const joins = corridorJoinXs(rooms);
  if (!room) return { left: false, right: false };
  return {
    left: joins.includes(room.x),
    right: joins.includes(room.x + room.w),
  };
}

export function corridorJoinIsSealed(rects, joinX, { y0 = 40, y1 = 300, minBlock = 40 } = {}) {
  const bandH = y1 - y0;
  if (bandH <= 0) return false;
  let covered = 0;
  for (const r of rects) {
    if (!overlapsJoinX(r.x, r.w, joinX)) continue;
    const overlap = Math.min(r.y + r.h, y1) - Math.max(r.y, y0);
    if (overlap > 0) covered += overlap;
  }
  return covered >= Math.min(minBlock, bandH);
}

export function buildWorldSolids(scene, solids, rooms, gates = []) {
  for (const r of listWorldSolidRects(rooms, gates)) {
    addSolidRect(scene, solids, r.x, r.y, r.w, r.h, r.color);
  }
}
