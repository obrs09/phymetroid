/**
 * In-game level editor (F1 / ` panel → Level edit).
 *
 * Pure helpers are the design-bot contract: rooms store world x,y,w,h;
 * solids default to space:"local" (xy relative to room origin); pickups are
 * world x,y + roomId; gates use fromRoomId/toRoomId/kind/requireAbility and
 * optional world rect. Corridor merge / ghost-wall skip stay in worldSolids.js
 * — this module never bakes corridorJoin geometry as solids.
 *
 * Persistence goes through applyDesignConfig → localStorage
 * `phymetroid.designConfig`. layoutRevision is stamped to the current
 * contract constant on export (not incremented per edit).
 */

import {
  ABILITY_ID,
  ABILITY_UNLOCK_ORDER,
  LAYOUT_REVISION,
  PICKUP_DESIGN_DEFAULTS,
  SCHEMA_VERSION,
  applyDesignConfig,
  buildExportPayload,
  getGates,
  getPickups,
  getRooms,
  resetDesignToDefaults,
  validateDesignGraph,
} from './designConfig.js';
import { findRoomAt, GAME_H, GAME_W } from './rooms.js';
import { pointInRect, solidToWorldRect } from './worldSolids.js';

export const EDITOR_TOOLS = Object.freeze([
  'select',
  'room',
  'wall',
  'pickup',
  'gate',
  'delete',
]);

export const EDITOR_GRID_SIZES = Object.freeze([8, 16]);

export const SOLID_KIND_OPTIONS = Object.freeze([
  'wall',
  'floor',
  'ceiling',
  'plat',
  'block',
  'doorframe',
  'custom',
]);

export const GATE_KIND_OPTIONS = Object.freeze([
  'corridorJoin',
  'mustJumpGap',
  'ceilingPassage',
  'floorGap',
  'sidePassage',
  'passage',
  'gap',
]);

export const PICKUP_TYPE_OPTIONS = Object.freeze([...ABILITY_UNLOCK_ORDER]);

export const HANDLE_SIZE = 8;
export const MIN_ROOM = 32;
export const MIN_SOLID = 8;
export const DEFAULT_ROOM = Object.freeze({ w: GAME_W, h: GAME_H });
const WALL_T = 16;
const FLOOR_H = 32;

const PICKUP_PRESETS = Object.fromEntries(
  PICKUP_DESIGN_DEFAULTS.map((p) => [
    p.ability,
    {
      ability: p.ability,
      color: p.color,
      requires: [...(p.requires || [])],
      onCollect: {
        ...p.onCollect,
        addItem: p.onCollect?.addItem ? { ...p.onCollect.addItem } : undefined,
      },
      idBase: p.id,
    },
  ])
);

export function snapToGrid(n, grid = 16) {
  const g = Number(grid);
  if (!Number.isFinite(g) || g <= 0) return Math.round(n);
  return Math.round(Number(n) / g) * g;
}

export function snapPoint(x, y, grid = 16) {
  return { x: snapToGrid(x, grid), y: snapToGrid(y, grid) };
}

export function normalizeRect(x0, y0, x1, y1, grid = 16, min = MIN_SOLID) {
  const a = snapPoint(x0, y0, grid);
  const b = snapPoint(x1, y1, grid);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.max(min, Math.abs(b.x - a.x));
  const h = Math.max(min, Math.abs(b.y - a.y));
  return { x, y, w, h };
}

export function nextRoomId(rooms = []) {
  let max = 0;
  for (const r of rooms) {
    const m = /^R(\d+)$/.exec(r?.id || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `R${max + 1}`;
}

export function nextSolidId(room, kind = 'wall') {
  const prefix = `${room?.id || 'R'}_${kind}`;
  const used = new Set((room?.solids || []).map((s) => s.id).filter(Boolean));
  if (!used.has(prefix)) return prefix;
  let i = 2;
  while (used.has(`${prefix}_${i}`)) i += 1;
  return `${prefix}_${i}`;
}

export function nextPickupId(pickups = [], ability = ABILITY_ID.GRAVITY_FALL) {
  const base = PICKUP_PRESETS[ability]?.idBase || `${ability}Orb`;
  const used = new Set(pickups.map((p) => p.id).filter(Boolean));
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export function nextGateId(gates = [], fromRoomId = 'R0', toRoomId = 'R0') {
  const base = `gate_${fromRoomId}_to_${toRoomId}`;
  const used = new Set(gates.map((g) => g.id).filter(Boolean));
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export function worldToLocal(room, worldRect) {
  return {
    x: worldRect.x - room.x,
    y: worldRect.y - room.y,
    w: worldRect.w,
    h: worldRect.h,
  };
}

export function fourWallsForRoom(room) {
  const id = room.id;
  return [
    {
      id: `${id}_floor`,
      kind: 'floor',
      space: 'local',
      x: 0,
      y: Math.max(0, room.h - FLOOR_H),
      w: room.w,
      h: FLOOR_H,
      fixed: true,
    },
    {
      id: `${id}_ceil`,
      kind: 'ceiling',
      space: 'local',
      x: 0,
      y: 0,
      w: room.w,
      h: WALL_T,
      fixed: true,
    },
    {
      id: `${id}_wallL`,
      kind: 'wall',
      space: 'local',
      x: 0,
      y: 0,
      w: WALL_T,
      h: room.h,
      fixed: true,
    },
    {
      id: `${id}_wallR`,
      kind: 'wall',
      space: 'local',
      x: Math.max(0, room.w - WALL_T),
      y: 0,
      w: WALL_T,
      h: room.h,
      fixed: true,
    },
  ];
}

export function makeRoom(worldRect, rooms = [], { id, role = 'custom', autoWalls = true } = {}) {
  const rid = (typeof id === 'string' && id.trim()) || nextRoomId(rooms);
  const room = {
    id: rid,
    x: worldRect.x,
    y: worldRect.y,
    w: worldRect.w,
    h: worldRect.h,
    role,
    intent: 'editor',
  };
  if (autoWalls) room.solids = fourWallsForRoom(room);
  return room;
}

export function makeSolidLocal(room, worldRect, { id, kind = 'wall', gapGateId } = {}) {
  const local = worldToLocal(room, worldRect);
  const solid = {
    id: (typeof id === 'string' && id.trim()) || nextSolidId(room, kind),
    kind: SOLID_KIND_OPTIONS.includes(kind) ? kind : 'custom',
    space: 'local',
    x: local.x,
    y: local.y,
    w: local.w,
    h: local.h,
    fixed: true,
  };
  if (typeof gapGateId === 'string' && gapGateId.trim()) solid.gapGateId = gapGateId.trim();
  return solid;
}

export function makePickup(x, y, ability, rooms = [], pickups = []) {
  const type = PICKUP_TYPE_OPTIONS.includes(ability) ? ability : ABILITY_ID.GRAVITY_FALL;
  const preset = PICKUP_PRESETS[type] || PICKUP_PRESETS[ABILITY_ID.GRAVITY_FALL];
  const room = findRoomAt(x, y, rooms);
  return {
    id: nextPickupId(pickups, type),
    ability: type,
    roomId: room?.id || '',
    x,
    y,
    color: preset.color,
    requires: [...(preset.requires || [])],
    onCollect: {
      ...preset.onCollect,
      addItem: preset.onCollect?.addItem ? { ...preset.onCollect.addItem } : undefined,
    },
  };
}

export function makeGate(worldRect, rooms = [], gates = [], opts = {}) {
  const cx = worldRect.x + worldRect.w / 2;
  const cy = worldRect.y + worldRect.h / 2;
  const host = findRoomAt(cx, cy, rooms);
  const fromRoomId = opts.fromRoomId || host?.id || rooms[0]?.id || '';
  const toRoomId = opts.toRoomId || fromRoomId;
  const kind = GATE_KIND_OPTIONS.includes(opts.kind) ? opts.kind : 'passage';
  const gate = {
    id: (typeof opts.id === 'string' && opts.id.trim()) || nextGateId(gates, fromRoomId, toRoomId),
    fromRoomId,
    toRoomId,
    kind,
    requireAbility: opts.requireAbility || '',
    world: { x: worldRect.x, y: worldRect.y, w: worldRect.w, h: worldRect.h },
    intent: opts.intent || 'editor',
  };
  return gate;
}

export function pickupWorldRect(p) {
  const s = 16;
  return { x: p.x - s / 2, y: p.y - s / 2, w: s, h: s };
}

export function selectionWorldRect(sel, rooms = []) {
  if (!sel) return null;
  if (sel.type === 'room') return { x: sel.room.x, y: sel.room.y, w: sel.room.w, h: sel.room.h };
  if (sel.type === 'solid') return solidToWorldRect(sel.room, sel.solid);
  if (sel.type === 'pickup') return pickupWorldRect(sel.pickup);
  if (sel.type === 'gate' && sel.gate.world) return { ...sel.gate.world };
  if (sel.type === 'gate') {
    const room = rooms.find((r) => r.id === sel.gate.fromRoomId);
    if (!room) return null;
    return { x: room.x + room.w / 2 - 16, y: room.y + room.h / 2 - 16, w: 32, h: 32 };
  }
  return null;
}

function area(rect) {
  return (rect?.w || 0) * (rect?.h || 0);
}

/**
 * Smallest covering object wins so solids/pickups beat the host room.
 * @returns {{ type: string, room?: object, solid?: object, pickup?: object, gate?: object } | null}
 */
export function hitTestEditor(rooms, pickups, gates, x, y) {
  const hits = [];
  for (const pickup of pickups || []) {
    const rect = pickupWorldRect(pickup);
    if (pointInRect(rect, x, y)) {
      hits.push({ type: 'pickup', pickup, room: rooms.find((r) => r.id === pickup.roomId), rect });
    }
  }
  for (const gate of gates || []) {
    if (!gate.world) continue;
    if (pointInRect(gate.world, x, y)) {
      hits.push({
        type: 'gate',
        gate,
        room: rooms.find((r) => r.id === gate.fromRoomId),
        rect: gate.world,
      });
    }
  }
  for (const room of rooms || []) {
    for (const solid of room.solids || []) {
      const rect = solidToWorldRect(room, solid);
      if (pointInRect(rect, x, y)) hits.push({ type: 'solid', room, solid, rect });
    }
    if (pointInRect(room, x, y)) hits.push({ type: 'room', room, rect: room });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => area(a.rect) - area(b.rect));
  const top = hits[0];
  return { type: top.type, room: top.room, solid: top.solid, pickup: top.pickup, gate: top.gate };
}

export function handleAtPoint(rect, x, y, pad = HANDLE_SIZE) {
  if (!rect) return null;
  const corners = {
    nw: { x: rect.x, y: rect.y },
    ne: { x: rect.x + rect.w, y: rect.y },
    sw: { x: rect.x, y: rect.y + rect.h },
    se: { x: rect.x + rect.w, y: rect.y + rect.h },
  };
  for (const [name, p] of Object.entries(corners)) {
    if (Math.abs(x - p.x) <= pad && Math.abs(y - p.y) <= pad) return name;
  }
  return null;
}

export function resizeRect(rect, handle, worldX, worldY, grid = 16, min = MIN_SOLID) {
  const p = snapPoint(worldX, worldY, grid);
  let { x, y, w, h } = rect;
  const r = x + w;
  const b = y + h;
  if (handle.includes('w')) x = Math.min(p.x, r - min);
  if (handle.includes('e')) {
    /* keep x */
  }
  if (handle.includes('n')) y = Math.min(p.y, b - min);
  if (handle.includes('s')) {
    /* keep y */
  }
  const x2 = handle.includes('e') ? Math.max(p.x, x + min) : r;
  const y2 = handle.includes('s') ? Math.max(p.y, y + min) : b;
  if (handle.includes('w')) w = x2 - x;
  else w = x2 - x;
  if (handle.includes('n')) h = y2 - y;
  else h = y2 - y;
  return { x, y, w: Math.max(min, w), h: Math.max(min, h) };
}

function findRoomMut(rooms, id) {
  return rooms.find((r) => r.id === id) || null;
}

export function applyWorldRectToSelection(sel, rect, rooms, pickups) {
  if (!sel || !rect) return;
  if (sel.type === 'room') {
    const room = findRoomMut(rooms, sel.room.id);
    if (!room) return;
    const dx = rect.x - room.x;
    const dy = rect.y - room.y;
    room.x = rect.x;
    room.y = rect.y;
    room.w = rect.w;
    room.h = rect.h;
    if (dx || dy) {
      for (const p of pickups) {
        if (p.roomId === room.id) {
          p.x += dx;
          p.y += dy;
        }
      }
    }
    return;
  }
  if (sel.type === 'solid') {
    const room = findRoomMut(rooms, sel.room.id);
    const solid = room?.solids?.find((s) => s === sel.solid || s.id === sel.solid.id);
    if (!solid) return;
    const local = worldToLocal(room, rect);
    solid.x = local.x;
    solid.y = local.y;
    solid.w = local.w;
    solid.h = local.h;
    return;
  }
  if (sel.type === 'pickup') {
    const pickup = pickups.find((p) => p === sel.pickup || p.id === sel.pickup.id);
    if (!pickup) return;
    pickup.x = rect.x + rect.w / 2;
    pickup.y = rect.y + rect.h / 2;
    const host = findRoomAt(pickup.x, pickup.y, rooms);
    if (host) pickup.roomId = host.id;
    return;
  }
  if (sel.type === 'gate') {
    sel.gate.world = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  }
}

export function deleteSelection(sel, rooms, pickups, gates) {
  if (!sel) return { rooms, pickups, gates };
  if (sel.type === 'room') {
    return {
      rooms: rooms.filter((r) => r.id !== sel.room.id),
      pickups,
      gates,
    };
  }
  if (sel.type === 'solid') {
    const room = rooms.find((r) => r.id === sel.room.id);
    if (room?.solids) {
      room.solids = room.solids.filter((s) => s.id !== sel.solid.id);
    }
    return { rooms, pickups, gates };
  }
  if (sel.type === 'pickup') {
    return { rooms, pickups: pickups.filter((p) => p.id !== sel.pickup.id), gates };
  }
  if (sel.type === 'gate') {
    return { rooms, pickups, gates: gates.filter((g) => g.id !== sel.gate.id) };
  }
  return { rooms, pickups, gates };
}

/**
 * Apply rooms/pickups/gates through the same import path as a 策划 dump.
 * Stamps schemaVersion 4 + current layoutRevision via buildExportPayload persist.
 */
export function commitLayout({ rooms, pickups, gates } = {}) {
  return applyDesignConfig({
    schemaVersion: SCHEMA_VERSION,
    layoutRevision: LAYOUT_REVISION,
    logicalW: GAME_W,
    logicalH: GAME_H,
    sections: {
      rooms: rooms ?? getRooms(),
      pickups: pickups ?? getPickups(),
      gates: gates ?? getGates(),
    },
  });
}

export function snapshotLayout() {
  return { rooms: getRooms(), pickups: getPickups(), gates: getGates() };
}

export function isTypingInEditorField(el = typeof document !== 'undefined' ? document.activeElement : null) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el.isContentEditable;
}

if (typeof window !== 'undefined') {
  window.__PHYMETROID_EDITOR_HELPERS__ = {
    snapToGrid,
    nextRoomId,
    makeRoom,
    makeSolidLocal,
    makePickup,
    makeGate,
    fourWallsForRoom,
    hitTestEditor,
    commitLayout,
    snapshotLayout,
    validate: validateDesignGraph,
    exportPayload: buildExportPayload,
    reset: resetDesignToDefaults,
  };
}
