/**
 * Static room solids. Stub for a future Tiled tilemap.
 * R3 stays the legacy pit under R1. R4 is the new friction room above R2.
 * The R2 ceiling / R4 floor share gate_R2_to_R4 as a passage (not a camera rotate).
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

export function buildWorldSolids(scene, solids, rooms, gates = []) {
  const addRect = (x, y, w, h, color) => addSolidRect(scene, solids, x, y, w, h, color);

  const floorH = px(16);
  const wallW = px(8);
  const platH = px(8);
  const r2r4 = ceilingGap(gates, 'R2', 'R4');
  const gap = r2r4?.world ?? { x: 1520, y: 0, w: 80, h: 16 };

  const r0 = roomById(rooms, 'R0');
  if (r0) {
    addRect(r0.x, r0.y + r0.h - floorH, r0.w, floorH, 0x4e342e);
    addRect(r0.x, r0.y, wallW, r0.h, 0x3e2723);
    addRect(r0.x, r0.y, r0.w, wallW, 0x3e2723);
    addRect(r0.x + px(100), r0.y + px(100), px(48), platH, 0x6d4c41);
    addRect(r0.x + px(200), r0.y + r0.h - floorH - px(24), px(24), px(24), 0x795548);
  }

  const r1 = roomById(rooms, 'R1');
  if (r1) {
    addRect(r1.x, r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addRect(r1.x + px(120), r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addRect(r1.x + px(240), r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addRect(r1.x, r1.y, r1.w, wallW, 0x3e2723);
    addRect(r1.x + px(40), r1.y + px(90), px(40), platH, 0x6d4c41);
    addRect(r1.x + px(180), r1.y + px(70), px(56), platH, 0x6d4c41);
  }

  const r2 = roomById(rooms, 'R2');
  if (r2) {
    addRect(r2.x, r2.y + r2.h - floorH, r2.w, floorH, 0x4e342e);
    addRect(r2.x + r2.w - wallW, r2.y, wallW, r2.h, 0x3e2723);
    addHorizontalWithGap(addRect, r2.x, r2.y, r2.w, wallW, gap, 0x3e2723);
    addRect(r2.x + px(60), r2.y + px(110), px(40), platH, 0x6d4c41);
    addRect(r2.x + px(160), r2.y + px(80), px(40), platH, 0x6d4c41);
    addRect(r2.x + px(240), r2.y + r2.h - floorH - px(32), px(32), px(32), 0x795548);
    // Doorframe just left of the ceiling gate. A leftward I-mode fall at any
    // height grounds on this face, then flip down / up through the hole.
    const frameW = px(12);
    addRect(gap.x - frameW, r2.y + wallW, frameW, r2.h - floorH - wallW, 0x6d4c41);
  }

  const r3 = roomById(rooms, 'R3');
  if (r3) {
    addRect(r3.x, r3.y + r3.h - floorH, r3.w, floorH, 0x4e342e);
    addRect(r3.x, r3.y, wallW, r3.h, 0x3e2723);
    addRect(r3.x + r3.w - wallW, r3.y, wallW, r3.h, 0x3e2723);
    addRect(r3.x + px(80), r3.y + px(80), px(48), platH, 0x6d4c41);
    addRect(r3.x + px(180), r3.y + px(100), px(48), platH, 0x6d4c41);
    addRect(r3.x, r3.y, px(100), wallW, 0x3e2723);
    addRect(r3.x + px(220), r3.y, px(100), wallW, 0x3e2723);
  }

  const r4 = roomById(rooms, 'R4');
  if (r4) {
    addHorizontalWithGap(addRect, r4.x, r4.y + r4.h - floorH, r4.w, floorH, gap, 0x37474f);
    addRect(r4.x, r4.y, r4.w, wallW, 0x263238);
    addRect(r4.x, r4.y, wallW, r4.h, 0x263238);
    addRect(r4.x + r4.w - wallW, r4.y, wallW, r4.h, 0x263238);
    addRect(r4.x + px(20), r4.y + px(28), px(56), platH, 0x546e7a);
    addRect(r4.x + px(140), r4.y + px(90), px(48), platH, 0x546e7a);
    addRect(r4.x + px(280), r4.y + px(50), wallW, px(90), 0x455a64);
  }
}
