/**
 * Static room solids. Stub for a future Tiled tilemap.
 * R3 stays the legacy pit under R1. R4 is the new friction room above R2.
 * The R2 ceiling / R4 floor share gate_R2_to_R4 as a passage (not a camera rotate).
 *
 * schemaVersion 4: if rooms[i].solids is non-empty, build that room from JSON
 * (local → world, optional space:"world", gapGateId hole). Rooms without solids
 * fall back to the v3 hardcode below.
 *
 * R0–R1–R2 is a clear horizontal corridor. Adjacent floor/ceiling slabs at a
 * room join are merged into one body so Arcade AABB does not treat the seam
 * as a ghost wall (classic internal-edge). Shared vertical walls at those
 * joins are skipped (full-height doorway). PR #5 — keep this engine pass
 * even when solids come from JSON.
 */

import { px } from './rooms.js';
import { tagFixed } from './gravity.js';

const SOLID_KINDS = new Set(['floor', 'ceiling', 'wall', 'plat', 'block', 'doorframe', 'custom']);
const CORRIDOR_ROOM_IDS = new Set(['R0', 'R1', 'R2', 'R5', 'R6']);

const KIND_COLOR = Object.freeze({
  floor: 0x4e342e,
  ceiling: 0x3e2723,
  wall: 0x3e2723,
  plat: 0x6d4c41,
  block: 0x795548,
  doorframe: 0x6d4c41,
  custom: 0x5d4037,
});

const ROOM_KIND_COLOR = Object.freeze({
  R4: Object.freeze({
    floor: 0x37474f,
    ceiling: 0x263238,
    wall: 0x263238,
    plat: 0x546e7a,
  }),
  R5: Object.freeze({
    floor: 0x4e3b2f,
    ceiling: 0x3e2723,
    wall: 0x5d4037,
    plat: 0xbf6a4e,
  }),
  R6: Object.freeze({
    floor: 0x4a148c,
    ceiling: 0x311b92,
    wall: 0x6a1b9a,
    plat: 0x8e24aa,
  }),
});

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
  for (const piece of splitRectAroundGate({ x, y, w, h }, gap)) {
    addRect(piece.x, piece.y, piece.w, piece.h, color);
  }
}

/** Horizontally adjacent room-join X values on the R0–R1–R2 band. */
export function corridorJoinXs(rooms = []) {
  const joins = [];
  const band = rooms.filter((r) => r && CORRIDOR_ROOM_IDS.has(r.id));
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

/** R0–R1–R2 playable mid-band. R3 (y=360) only touches the seam — keep its L/R walls. */
const CORRIDOR_PLAYABLE = Object.freeze({ y0: 40, y1: 300 });

export function occupiesCorridorPlayableBand(y, h, minOverlap = 40) {
  const overlap = Math.min(y + h, CORRIDOR_PLAYABLE.y1) - Math.max(y, CORRIDOR_PLAYABLE.y0);
  return overlap > minOverlap;
}

/**
 * Skip a full-height (or tall) wall that would seal a corridor join.
 * A large / full-height doorway is "place nothing" — lintels stay on the
 * room ceiling/floor slabs instead.
 * Only walls that occupy the R0–R2–R5–R6 playable Y band are skipped. R3/R4
 * walls that merely share a join X (640 / 1280) must stay sealed.
 */
function addWallUnlessCorridorJoin(addRect, joinXs, x, y, w, h, color, tag) {
  const sealsJoin =
    occupiesCorridorPlayableBand(y, h) &&
    joinXs.some((jx) => overlapsJoinX(x, w, jx) && h > px(40));
  if (sealsJoin) return;
  addRect(x, y, w, h, color, tag);
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

export function normalizeSolidKind(kind) {
  const k = typeof kind === 'string' ? kind.trim() : '';
  return SOLID_KINDS.has(k) ? k : 'custom';
}

export function roomHasSolids(room) {
  return Array.isArray(room?.solids) && room.solids.length > 0;
}

/** Source-JSON solid counts (before gap split / corridor merge). */
export function countRoomSourceSolids(rooms = []) {
  const counts = {};
  for (const r of rooms) {
    counts[r.id] = roomHasSolids(r) ? r.solids.length : 0;
  }
  return counts;
}

export function colorForSolid(roomId, kind, solid = {}) {
  const k = normalizeSolidKind(kind);
  if ((roomId === 'R4' || roomId === 'R5') && k === 'wall' && Number(solid.h) < 360) {
    return roomId === 'R5' ? 0x6d4c41 : 0x455a64;
  }
  return ROOM_KIND_COLOR[roomId]?.[k] ?? KIND_COLOR[k] ?? KIND_COLOR.custom;
}

/** Default space is local: world = room origin + solid xy. */
export function solidToWorldRect(room, solid) {
  const x = Number(solid.x);
  const y = Number(solid.y);
  const w = Number(solid.w);
  const h = Number(solid.h);
  if (solid.space === 'world') return { x, y, w, h };
  return { x: room.x + x, y: room.y + y, w, h };
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointInRect(rect, x, y) {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

/**
 * Cut a hole on the gate's X span (same as the v3 R2/R4 ceiling-floor gap).
 * Y is ignored so an adjacent R4 floor at y=-32 still opens at gate y=0.
 */
export function splitRectAroundGate(rect, gap) {
  if (!gap || ![gap.x, gap.w].every(Number.isFinite)) return [{ ...rect }];
  const overlapsX = rect.x < gap.x + gap.w && rect.x + rect.w > gap.x;
  if (!overlapsX) return [{ ...rect }];
  const out = [];
  const leftW = Math.max(0, gap.x - rect.x);
  const rightX = gap.x + gap.w;
  const rightW = Math.max(0, rect.x + rect.w - rightX);
  if (leftW > 0) out.push({ ...rect, x: rect.x, w: leftW });
  if (rightW > 0) out.push({ ...rect, x: rightX, w: rightW });
  return out;
}

/**
 * Safety pass: any solid that 2D-overlaps a gate.world rect is X-split so the
 * opening stays walkable. Floor/ceiling slabs that only share the gate's X
 * (R2 floor at y=328) are left intact.
 */
/** World-X band around gate_R2_to_R4 where a tall mid-R2 wall must not exist. */
export const TALL_R2_NEAR_GATE = Object.freeze({ x0: 1480, x1: 1620, minH: 200 });

/** Baked short catch stub (right edge of the ceiling gate). */
export const SHORT_R2_DOORFRAME_WORLD = Object.freeze({ x: 1600, y: 264, w: 24, h: 64 });

/** R1 floor pits in room-local X (also R3 ceiling openings). */
export const R1_PIT_LOCAL_SPANS = Object.freeze([
  Object.freeze({ x: 160, w: 80 }),
  Object.freeze({ x: 400, w: 80 }),
]);

export function isTallR2SolidNearGate(rect) {
  if (!rect) return false;
  const h = Number(rect.h);
  const x = Number(rect.x);
  const w = Number(rect.w);
  if (![h, x, w].every(Number.isFinite) || h < TALL_R2_NEAR_GATE.minH || w <= 0) return false;
  return x < TALL_R2_NEAR_GATE.x1 && x + w > TALL_R2_NEAR_GATE.x0;
}

/** Gaps in [x0, x1] not covered by {x,w} slabs. */
export function openSpansOnAxis(slabs, x0, x1) {
  const items = (slabs || [])
    .map((s) => ({ x: Number(s.x), w: Number(s.w) }))
    .filter((s) => Number.isFinite(s.x) && Number.isFinite(s.w) && s.w > 0)
    .sort((a, b) => a.x - b.x);
  const opens = [];
  let cursor = x0;
  for (const s of items) {
    const left = Math.max(s.x, x0);
    const right = Math.min(s.x + s.w, x1);
    if (right <= left) continue;
    if (left > cursor) opens.push({ x: cursor, w: left - cursor });
    cursor = Math.max(cursor, right);
  }
  if (cursor < x1) opens.push({ x: cursor, w: x1 - cursor });
  return opens;
}

function ensureShortR2Doorframe(rects, rooms) {
  const next = rects.filter((r) => !isTallR2SolidNearGate(r));
  const hasStub = next.some(
    (r) =>
      r.tag === 'doorframe' &&
      r.h < TALL_R2_NEAR_GATE.minH &&
      r.x < TALL_R2_NEAR_GATE.x1 &&
      r.x + r.w > TALL_R2_NEAR_GATE.x0
  );
  if (!hasStub && rooms.some((r) => r.id === 'R2')) {
    next.push({
      x: SHORT_R2_DOORFRAME_WORLD.x,
      y: SHORT_R2_DOORFRAME_WORLD.y,
      w: SHORT_R2_DOORFRAME_WORLD.w,
      h: SHORT_R2_DOORFRAME_WORLD.h,
      color: KIND_COLOR.doorframe,
      tag: 'doorframe',
    });
  }
  return next;
}

export function punchOverlappingGateRects(rects, gates = []) {
  const gaps = gates
    .map((g) => g?.world)
    .filter((w) => w && [w.x, w.y, w.w, w.h].every(Number.isFinite));
  let out = rects;
  for (const gap of gaps) {
    const next = [];
    for (const r of out) {
      if (rectsOverlap(r, gap)) next.push(...splitRectAroundGate(r, gap));
      else next.push(r);
    }
    out = next;
  }
  return out;
}

function appendDataDrivenRoom(room, gates, helpers) {
  const { addRect, addFloor, addCeil, addWall } = helpers;
  const corridor = CORRIDOR_ROOM_IDS.has(room.id);
  for (const raw of room.solids) {
    if (!raw || typeof raw !== 'object') continue;
    const kind = normalizeSolidKind(raw.kind);
    const world = solidToWorldRect(room, raw);
    if (![world.x, world.y, world.w, world.h].every(Number.isFinite) || world.w <= 0 || world.h <= 0) {
      continue;
    }
    const color = colorForSolid(room.id, kind, raw);
    let pieces = [world];
    if (raw.gapGateId) {
      const gate = gates.find((g) => g.id === raw.gapGateId);
      if (!gate) {
        console.warn(
          `[phymetroid] gapGateId "${raw.gapGateId}" on ${raw.id || room.id} not in gates; skip hole`
        );
      } else if (gate.world) {
        pieces = splitRectAroundGate(world, gate.world);
      }
    }
    for (const piece of pieces) {
      if (kind === 'wall') {
        addWall(piece.x, piece.y, piece.w, piece.h, color);
        continue;
      }
      if (corridor && kind === 'floor') {
        addFloor(piece.x, piece.y, piece.w, piece.h, color);
        continue;
      }
      if (corridor && kind === 'ceiling') {
        addCeil(piece.x, piece.y, piece.w, piece.h, color);
        continue;
      }
      addRect(piece.x, piece.y, piece.w, piece.h, color, kind);
    }
  }
}

function appendHardcodedRooms(rooms, gates, helpers) {
  const { addRect, addFloor, addCeil, addWall } = helpers;
  const floorH = px(16);
  const wallW = px(8);
  const platH = px(8);
  const r2r4 = ceilingGap(gates, 'R2', 'R4');
  const gap = r2r4?.world ?? { x: 1520, y: 0, w: 80, h: 16 };

  const r0 = roomById(rooms, 'R0');
  if (r0 && !roomHasSolids(r0)) {
    addFloor(r0.x, r0.y + r0.h - floorH, r0.w, floorH, 0x4e342e);
    addWall(r0.x, r0.y, wallW, r0.h, 0x3e2723);
    addCeil(r0.x, r0.y, r0.w, wallW, 0x3e2723);
    addRect(r0.x + px(100), r0.y + px(100), px(48), platH, 0x6d4c41, 'plat');
    addRect(r0.x + px(200), r0.y + r0.h - floorH - px(24), px(24), px(24), 0x795548, 'block');
  }

  const r1 = roomById(rooms, 'R1');
  if (r1 && !roomHasSolids(r1)) {
    // Intentional pits down to R3 — keep the gaps, only merge the join slabs.
    addFloor(r1.x, r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addFloor(r1.x + px(120), r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addFloor(r1.x + px(240), r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addCeil(r1.x, r1.y, r1.w, wallW, 0x3e2723);
    addRect(r1.x + px(40), r1.y + px(90), px(40), platH, 0x6d4c41, 'plat');
    addRect(r1.x + px(180), r1.y + px(70), px(56), platH, 0x6d4c41, 'plat');
  }

  const r2 = roomById(rooms, 'R2');
  if (r2 && !roomHasSolids(r2)) {
    addFloor(r2.x, r2.y + r2.h - floorH, r2.w, floorH, 0x4e342e);
    addHorizontalWithGap(addCeil, r2.x, r2.y, r2.w, wallW, gap, 0x3e2723);
    addRect(r2.x + px(60), r2.y + px(110), px(40), platH, 0x6d4c41, 'plat');
    addRect(r2.x + px(160), r2.y + px(80), px(40), platH, 0x6d4c41, 'plat');
    addRect(r2.x + px(240), r2.y + r2.h - floorH - px(32), px(32), px(32), 0x795548, 'block');
    // Short catch stub on the right edge of the ceiling gate (not a mid-room
    // wall). A rightward I-mode fall grounds under the hole, then flip to up.
    const frameW = px(12);
    const frameH = px(32);
    addRect(gap.x + gap.w, r2.y + r2.h - floorH - frameH, frameW, frameH, 0x6d4c41, 'doorframe');
  }

  const r3 = roomById(rooms, 'R3');
  if (r3 && !roomHasSolids(r3)) {
    addRect(r3.x, r3.y + r3.h - floorH, r3.w, floorH, 0x4e342e, 'floor');
    addRect(r3.x, r3.y, wallW, r3.h, 0x3e2723, 'wall');
    addRect(r3.x + r3.w - wallW, r3.y, wallW, r3.h, 0x3e2723, 'wall');
    addRect(r3.x + px(80), r3.y + px(80), px(48), platH, 0x6d4c41, 'plat');
    addRect(r3.x + px(180), r3.y + px(100), px(48), platH, 0x6d4c41, 'plat');
    // Ceiling openings align to R1 pits only (160–240, 400–480). Seal the middle.
    addRect(r3.x, r3.y, px(80), wallW, 0x3e2723, 'ceiling');
    addRect(r3.x + px(120), r3.y, px(80), wallW, 0x3e2723, 'ceiling');
    addRect(r3.x + px(240), r3.y, px(80), wallW, 0x3e2723, 'ceiling');
  }

  const r4 = roomById(rooms, 'R4');
  if (r4 && !roomHasSolids(r4)) {
    addHorizontalWithGap(addRect, r4.x, r4.y + r4.h - floorH, r4.w, floorH, gap, 0x37474f);
    addRect(r4.x, r4.y, r4.w, wallW, 0x263238, 'ceiling');
    addRect(r4.x, r4.y, wallW, r4.h, 0x263238, 'wall');
    addRect(r4.x + r4.w - wallW, r4.y, wallW, r4.h, 0x263238, 'wall');
    addRect(r4.x + px(20), r4.y + px(28), px(56), platH, 0x546e7a, 'plat');
    addRect(r4.x + px(140), r4.y + px(90), px(48), platH, 0x546e7a, 'plat');
    addRect(r4.x + px(280), r4.y + px(50), wallW, px(90), 0x455a64, 'wall');
  }

  const r5 = roomById(rooms, 'R5');
  if (r5 && !roomHasSolids(r5)) {
    addFloor(r5.x, r5.y + r5.h - floorH, px(100), floorH, 0x4e3b2f);
    addFloor(r5.x + px(180), r5.y + r5.h - floorH, px(140), floorH, 0x4e3b2f);
    addCeil(r5.x, r5.y, r5.w, wallW, 0x3e2723);
    addRect(r5.x + px(20), r5.y + px(130), px(48), platH, 0xbf6a4e, 'plat');
    addRect(r5.x + px(180), r5.y + px(120), px(60), platH, 0xbf6a4e, 'plat');
  }

  const r6 = roomById(rooms, 'R6');
  if (r6 && !roomHasSolids(r6)) {
    addFloor(r6.x, r6.y + r6.h - floorH, r6.w, floorH, 0x4a148c);
    addCeil(r6.x, r6.y, r6.w, wallW, 0x311b92);
    addWall(r6.x + r6.w - wallW, r6.y, wallW, r6.h, 0x6a1b9a);
    addRect(r6.x + px(140), r6.y + px(80), px(64), platH, 0x8e24aa, 'plat');
  }
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

  const joinXs = corridorJoinXs(rooms);
  const pendingFloor = [];
  const pendingCeil = [];

  const addFloor = (x, y, w, h, color) => pendingFloor.push({ x, y, w, h, color, tag: 'floor' });
  const addCeil = (x, y, w, h, color) => pendingCeil.push({ x, y, w, h, color, tag: 'ceiling' });
  const addWall = (x, y, w, h, color) => addWallUnlessCorridorJoin(addRect, joinXs, x, y, w, h, color, 'wall');
  const helpers = { addRect, addFloor, addCeil, addWall };

  for (const room of rooms) {
    if (roomHasSolids(room)) appendDataDrivenRoom(room, gates, helpers);
  }
  appendHardcodedRooms(rooms, gates, helpers);

  for (const r of mergeTouchingHorizontal(pendingFloor)) {
    addRect(r.x, r.y, r.w, r.h, r.color, r.tag);
  }
  for (const r of mergeTouchingHorizontal(pendingCeil)) {
    addRect(r.x, r.y, r.w, r.h, r.color, r.tag);
  }

  return ensureShortR2Doorframe(punchOverlappingGateRects(rects, gates), rooms);
}

/**
 * True when a vertical band around `x` is sealed by a tall solid
 * (floor/ceiling slabs and short platforms do not count).
 */
/** Same-Y abutting rooms (R0–R2–R5–R6 Y=0 corridor; R4 is a separate band). */
export function horizontalJoinXs(rooms = []) {
  const joins = [];
  for (const a of rooms) {
    for (const b of rooms) {
      if (!a || !b || a.id >= b.id) continue;
      if (a.y !== b.y || a.h !== b.h) continue;
      if (a.x + a.w === b.x) joins.push(b.x);
      if (b.x + b.w === a.x) joins.push(a.x);
    }
  }
  return [...new Set(joins)].sort((x, y) => x - y);
}

/** Which vertical sides of a room are corridor joins (leave the stroke open). */
export function corridorOpenEdges(room, rooms = []) {
  const joins = horizontalJoinXs(rooms);
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
