/**
 * M-map content descriptors. Visited rooms show pickups, gates, and a short
 * role hint. Unexplored rooms stay spoiler-free (id only).
 */

export const ROLE_HINT = Object.freeze({
  intro: 'intro',
  hub: 'hub',
  preFriction: 'pre-fric',
  frictionLesson: 'fric',
  jumpLesson: 'jump',
  fieldStub: 'field',
  fieldLesson: 'field',
  legacyPit: 'pit',
});

export const PICKUP_MARK = Object.freeze({
  gravityOrb: Object.freeze({ tag: 'G', label: 'grav', color: 0xffeb3b }),
  surfaceWalkOrb: Object.freeze({ tag: 'W', label: 'walk', color: 0x80deea }),
  reactionJumpOrb: Object.freeze({ tag: 'J', label: 'jump', color: 0xff8a65 }),
  gravityFieldOrb: Object.freeze({ tag: 'F', label: 'field', color: 0xce93d8 }),
});

export function pointInRoom(x, y, room) {
  if (!room) return false;
  return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
}

export function pickupRoomId(pickup, rooms = []) {
  if (pickup?.roomId) return pickup.roomId;
  const hit = rooms.find((r) => pointInRoom(pickup?.x, pickup?.y, r));
  return hit?.id ?? null;
}

function gateTouchesRoom(gate, room) {
  if (!room) return false;
  if (gate.fromRoomId === room.id || gate.toRoomId === room.id) return true;
  const w = gate.world;
  if (!w) return false;
  const cx = w.x + w.w / 2;
  const cy = w.y + w.h / 2;
  return pointInRoom(cx, cy, room) || pointInRoom(cx, cy - 1, room) || pointInRoom(cx, cy + 1, room);
}

function gateEdge(gate, room) {
  if (gate.kind === 'ceilingPassage') {
    return gate.fromRoomId === room.id ? 'top' : 'bottom';
  }
  if (gate.kind === 'floorGap' || gate.kind === 'jumpGap' || gate.kind === 'mustJumpGap') {
    return gate.fromRoomId === room.id ? 'bottom' : 'top';
  }
  if (gate.kind === 'sidePassage' || gate.kind === 'corridorJoin') {
    if (gate.world && room) {
      const cx = gate.world.x + gate.world.w / 2;
      if (cx >= room.x + room.w - 8) return 'right';
      if (cx <= room.x + 8) return 'left';
    }
    return gate.fromRoomId === room.id ? 'right' : 'left';
  }
  if (gate.world && room) {
    const cy = gate.world.y + gate.world.h / 2;
    if (cy <= room.y + 8) return 'top';
    if (cy >= room.y + room.h - 8) return 'bottom';
  }
  return 'top';
}

function gateWorldOnRoom(gate, room) {
  if (gate.world) {
    return { x: gate.world.x + gate.world.w / 2, y: gate.world.y + gate.world.h / 2 };
  }
  const edge = gateEdge(gate, room);
  const midY = room.y + room.h - 40;
  if (edge === 'bottom') return { x: room.x + room.w / 2, y: room.y + room.h };
  if (edge === 'left') return { x: room.x, y: midY };
  if (edge === 'right') return { x: room.x + room.w, y: midY };
  return { x: room.x + room.w / 2, y: room.y };
}

/**
 * @param {{ id: string, x: number, y: number, w: number, h: number, role?: string }} room
 * @param {{ visited: boolean, pickups?: object[], gates?: object[], rooms?: object[] }} opts
 */
export function describeRoomMapContents(room, { visited = false, pickups = [], gates = [], rooms = [] } = {}) {
  if (!room) {
    return { id: null, visited: false, role: null, pickups: [], gates: [] };
  }
  if (!visited) {
    return { id: room.id, visited: false, role: null, pickups: [], gates: [] };
  }
  const shownPickups = pickups
    .filter((p) => pickupRoomId(p, rooms) === room.id)
    .map((p) => {
      const mark = PICKUP_MARK[p.id] || { tag: '?', label: p.id, color: 0xb0bec5 };
      return {
        id: p.id,
        tag: mark.tag,
        label: mark.label,
        color: mark.color,
        x: p.x,
        y: p.y,
      };
    });
  const shownGates = gates.filter((g) => gateTouchesRoom(g, room)).map((g) => {
    const dest = g.fromRoomId === room.id ? g.toRoomId : g.fromRoomId;
    const edge = gateEdge(g, room);
    const world = gateWorldOnRoom(g, room);
    return {
      id: g.id,
      kind: g.kind,
      dest,
      edge,
      x: world.x,
      y: world.y,
    };
  });
  return {
    id: room.id,
    visited: true,
    role: ROLE_HINT[room.role] || room.role || null,
    pickups: shownPickups,
    gates: shownGates,
  };
}

export function describeMapContents(rooms, { visitedIds, pickups, gates } = {}) {
  const visited = visitedIds instanceof Set ? visitedIds : new Set(visitedIds || []);
  const out = {};
  for (const room of rooms) {
    out[room.id] = describeRoomMapContents(room, {
      visited: visited.has(room.id),
      pickups,
      gates,
      rooms,
    });
  }
  return out;
}
