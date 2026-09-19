/**
 * Room map data for Metroidvania camera.
 * Each room matches the logical game resolution so one room fills the view.
 * Future: replace colored Graphics / static bodies with a Tiled tilemap
 * (e.g. load via Phaser's Tilemap API and map room ids to tile layers).
 */

/** Logical resolution (16:9). Exact 2× of the original 320×180 prototype. */
export const GAME_W = 640;
export const GAME_H = 360;

/**
 * Scale vs the original 320×180 layout / Arcade feel numbers.
 * Geometry and pixel-velocities are multiplied by this so hang time,
 * room-cross time, and platform clearance stay the same.
 */
export const WORLD_SCALE = 2;

/** Map an original 320×180 design coordinate / size into current logical pixels. */
export function px(n) {
  return n * WORLD_SCALE;
}

/** Monospace HUD stack — 2× the original 7/8/10px sizes so glyphs stay readable. */
export const UI_FONT_FAMILY = '"Courier New", Courier, monospace';
export const UI_FONT_SM = `${px(7)}px`;
export const UI_FONT_MD = `${px(8)}px`;
export const UI_FONT_LG = `${px(10)}px`;

/**
 * Default room AABBs (schema v3 fallback). v4 solids live on design rooms.
 * R3 stays under R1; R4 sits above R2 (neg Y).
 * R5 (jump) and R6 (field) continue the Y=0 corridor east of R2.
 * @type {{ id: string, x: number, y: number, w: number, h: number, role?: string }[]}
 */
export const ROOMS = [
  { id: 'R0', x: 0, y: 0, w: GAME_W, h: GAME_H, role: 'intro' },
  { id: 'R1', x: GAME_W, y: 0, w: GAME_W, h: GAME_H, role: 'hub' },
  { id: 'R2', x: GAME_W * 2, y: 0, w: GAME_W, h: GAME_H, role: 'preFriction' },
  { id: 'R3', x: GAME_W, y: GAME_H, w: GAME_W, h: GAME_H, role: 'legacyPit' },
  { id: 'R4', x: GAME_W * 2, y: -GAME_H, w: GAME_W, h: GAME_H, role: 'frictionLesson' },
  { id: 'R5', x: GAME_W * 3, y: 0, w: GAME_W, h: GAME_H, role: 'jumpLesson' },
  { id: 'R6', x: GAME_W * 4, y: 0, w: GAME_W, h: GAME_H, role: 'fieldLesson' },
];

/** Full world AABB covering all rooms (minY may be negative — R4). */
export function getWorldBounds(rooms = ROOMS) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rooms) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function findRoomById(id, rooms = ROOMS) {
  return rooms.find((r) => r.id === id) || null;
}

/** Find room containing a world point (player center). Prefer last match on edges. */
export function findRoomAt(px, py, rooms = ROOMS) {
  let found = null;
  for (const r of rooms) {
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
      found = r;
    }
  }
  return found;
}
