#!/usr/bin/env node
/**
 * Schema v4 contract checks (no Phaser). Run: npm run test:schema
 */
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION,
  applyDesignConfig,
  buildExportPayload,
  canonicalAbilityId,
  getAbilitiesDesign,
  getFeel,
  getGates,
  getGravityDesign,
  getPickups,
  getPlayerDesign,
  getProgressDesign,
  getRooms,
  resetDesignToDefaults,
  validateDesignGraph,
} from '../src/designConfig.js';
import { ROOMS } from '../src/rooms.js';
import {
  composeVelocity,
  downArrowRotation,
  downVector,
  DOWN_ARROW_GLYPH,
  gravityAccel,
  rotateCardinal,
  snapDownToNearestAxis,
  walkTangent,
} from '../src/gravity.js';
import { describeMapContents, describeRoomMapContents } from '../src/mapContents.js';
import {
  corridorJoinIsSealed,
  corridorJoinXs,
  countRoomSourceSolids,
  listWorldSolidRects,
  pointInRect,
  punchOverlappingGateRects,
  rectsOverlap,
  solidToWorldRect,
  splitRectAroundGate,
} from '../src/worldSolids.js';
import {
  ABILITY,
  advancePhaseOnAbility,
  getAbilityGrants,
  getGravityDown,
  getRunState,
  hasAbility,
  resetRun,
  unlockAbility,
} from '../src/runState.js';

function section(name, fn) {
  fn();
  console.log(`ok  ${name}`);
}

resetDesignToDefaults();
resetRun();

section('schemaVersion 4 export shape', () => {
  const dump = buildExportPayload();
  assert.equal(dump.schemaVersion, 4);
  assert.equal(SCHEMA_VERSION, 4);
  assert.equal(dump.game, 'phymetroid');
  assert.equal(dump.logicalW, 640);
  assert.equal(dump.logicalH, 360);
  assert.equal(dump.worldScale, 2);
  assert.equal(dump.gravity, undefined);
  const s = dump.sections;
  for (const key of ['feel', 'gravity', 'abilities', 'player', 'progress', 'rooms', 'pickups', 'gates']) {
    assert.ok(s[key], `missing sections.${key}`);
  }
  assert.equal(s.feel.moveSpeed, 220);
  assert.equal(s.feel.gravityY, 1960);
  assert.equal(s.feel.jumpVelocity, -550);
  assert.equal(s.feel.maxFallSpeed, 640);
  assert.equal(s.feel.floatNudge, 56);
  assert.equal(s.gravity.rotateVectorOnly, true);
  assert.equal(s.gravity.rotateCamera, false);
  assert.equal(s.gravity.defaultDown, 'down');
  assert.equal(s.gravity.airLockRequiresAbility, 'gravityFall');
  assert.ok(s.abilities.gravityFall);
  assert.ok(!s.abilities.gravity);
  assert.deepEqual(s.abilities.gravityFall.legacyIds, ['gravity']);
  assert.equal(s.abilities.gravityFall.grants.canWalk, false);
  assert.equal(s.abilities.surfaceWalk.grants.canWalk, true);
  assert.equal(s.abilities.surfaceWalk.grants.canJump, false);
  assert.equal(s.abilities.reactionJump.grants.canJump, true);
  assert.equal(s.abilities.gravityField.grants.gravityDirections, 'arbitrary');
  assert.deepEqual(s.player.abilityUnlockOrder, [
    'gravityFall',
    'surfaceWalk',
    'reactionJump',
    'gravityField',
  ]);
  assert.equal(s.progress.abilityPhases.gravityFall, 'exploration');
  assert.equal(s.progress.abilityPhases.surfaceWalk, 'frictionLesson');
  assert.ok(s.progress.pathIntent.en);
  assert.ok(Array.isArray(s.progress.pathIntent.zh));
  assert.ok(s.abilities.gravityFall.why);
});

section('rooms / pickups / gates coords', () => {
  const rooms = Object.fromEntries(getRooms().map((r) => [r.id, r]));
  assert.deepEqual(
    { x: rooms.R3.x, y: rooms.R3.y, w: rooms.R3.w, h: rooms.R3.h },
    { x: 640, y: 360, w: 640, h: 360 }
  );
  assert.deepEqual(
    { x: rooms.R4.x, y: rooms.R4.y, w: rooms.R4.w, h: rooms.R4.h },
    { x: 1280, y: -360, w: 640, h: 360 }
  );
  const orb = getPickups().find((p) => p.id === 'surfaceWalkOrb');
  assert.ok(orb);
  assert.equal(orb.x, 1320);
  assert.equal(orb.y, -320);
  assert.equal(orb.ability, 'surfaceWalk');
  const yellow = getPickups().find((p) => p.id === 'gravityOrb');
  assert.equal(yellow.ability, 'gravityFall');
  const gate = getGates().find((g) => g.id === 'gate_R2_to_R4');
  assert.deepEqual(gate.world, { x: 1520, y: 0, w: 80, h: 16 });
  assert.equal(gate.requireAbility, 'gravityFall');
  const pit = getGates().find((g) => g.id === 'gate_R1_to_R3');
  assert.equal(pit.world, undefined, 'gate_R1_to_R3 has no invented world rect');
  assert.equal(pit.kind, 'floorGap');
});

section('v4 rooms[].solids source counts + local/world math', () => {
  const rooms = getRooms();
  assert.deepEqual(countRoomSourceSolids(rooms), { R0: 5, R1: 6, R2: 7, R3: 7, R4: 7 });
  const r4 = rooms.find((r) => r.id === 'R4');
  assert.equal(r4.y, -360);
  const floor = r4.solids.find((s) => s.id === 'R4_floor');
  assert.equal(floor.space, 'local');
  assert.deepEqual(solidToWorldRect(r4, floor), { x: 1280, y: -32, w: 640, h: 32 });
  const r2 = rooms.find((r) => r.id === 'R2');
  const door = r2.solids.find((s) => s.id === 'R2_doorframe');
  assert.equal(door.space, 'local');
  assert.deepEqual(solidToWorldRect(r2, door), { x: 1600, y: 264, w: 24, h: 64 });
  assert.ok(door.h <= 80, 'doorframe is a short catch stub, not a mid-room wall');
  assert.equal(r2.solids.find((s) => s.id === 'R2_ceil').gapGateId, 'gate_R2_to_R4');
  assert.equal(floor.gapGateId, 'gate_R2_to_R4');
});

section('gapGateId cuts R2 ceiling / R4 floor; doorframe misses the opening', () => {
  const rooms = getRooms();
  const gates = getGates();
  const gate = gates.find((g) => g.id === 'gate_R2_to_R4').world;
  const rects = listWorldSolidRects(rooms, gates);
  const covers = (x, y) => rects.some((r) => pointInRect(r, x, y));
  for (let x = gate.x + 4; x < gate.x + gate.w; x += 8) {
    for (let y = gate.y + 2; y < gate.y + gate.h; y += 4) {
      assert.equal(covers(x, y), false, `solid covers gate interior (${x},${y})`);
    }
    assert.equal(covers(x, -16), false, `solid covers R4 floor hole (${x},-16)`);
  }
  assert.equal(covers(1400, 8), true, 'R2 ceiling left remains');
  assert.equal(covers(1700, 8), true, 'R2 ceiling right remains');
  assert.equal(covers(1400, -16), true, 'R4 floor left remains');
  const door = rects.find((r) => r.tag === 'doorframe');
  assert.ok(door, 'R2_doorframe world rect present');
  assert.deepEqual({ x: door.x, y: door.y, w: door.w, h: door.h }, { x: 1600, y: 264, w: 24, h: 64 });
  assert.equal(rectsOverlap(door, gate), false, 'doorframe must not cover the gate opening');
  const midR2Walls = rects.filter(
    (r) =>
      r.h > 160 &&
      r.y < 40 &&
      r.y + r.h > 280 &&
      r.x < 1600 &&
      r.x + r.w > 1320 &&
      r.x + r.w < 1900
  );
  assert.equal(midR2Walls.length, 0, `full-height mid-R2 blocker: ${JSON.stringify(midR2Walls)}`);
  // Floor-level I-mode AABB (24×32) can travel from the R2 entrance to under the hole.
  const playerW = 24;
  const playerH = 32;
  const floorY = 312;
  const hitsBlocking = (x) =>
    rects.some((r) => {
      if (r.tag === 'floor' || r.tag === 'ceiling') return false;
      return rectsOverlap(r, { x: x - playerW / 2, y: floorY - playerH / 2, w: playerW, h: playerH });
    });
  for (let x = 1320; x <= 1564; x += 4) {
    assert.equal(hitsBlocking(x), false, `floor approach blocked at x=${x}`);
  }
  const split = splitRectAroundGate({ x: 1280, y: 0, w: 640, h: 16 }, { x: 1520, y: 0, w: 80, h: 16 });
  assert.deepEqual(split, [
    { x: 1280, y: 0, w: 240, h: 16 },
    { x: 1600, y: 0, w: 320, h: 16 },
  ]);
  const punched = punchOverlappingGateRects(
    [{ x: 1496, y: 0, w: 48, h: 80, tag: 'doorframe' }],
    [{ world: gate }]
  );
  assert.equal(
    punched.some((r) => pointInRect(r, 1560, 8)),
    false,
    '2D overlap punch must open a doorframe that covers the gate'
  );
});

section('v3 rooms without solids fall back to hardcode', () => {
  applyDesignConfig({
    schemaVersion: 3,
    logicalW: 640,
    logicalH: 360,
    sections: { rooms: ROOMS.map((r) => ({ ...r })) },
  });
  const rooms = getRooms();
  assert.equal(rooms.find((r) => r.id === 'R0').solids, undefined);
  assert.deepEqual(countRoomSourceSolids(rooms), { R0: 0, R1: 0, R2: 0, R3: 0, R4: 0 });
  const rects = listWorldSolidRects(rooms, getGates());
  const joins = corridorJoinXs(rooms);
  assert.deepEqual(joins, [640, 1280]);
  for (const x of joins) {
    assert.equal(corridorJoinIsSealed(rects, x), false, `v3 fallback join x=${x} sealed`);
  }
  const mergedFloor = rects.find((r) => r.tag === 'floor' && r.x < 1280 && r.x + r.w > 1280);
  assert.ok(mergedFloor, 'v3 fallback still merges R1|R2 floor');
  resetDesignToDefaults();
  assert.equal(getRooms().find((r) => r.id === 'R0').solids.length, 5);
});

section('R1 floor pits open R3 without gate.world', () => {
  const r1 = getRooms().find((r) => r.id === 'R1');
  const floors = r1.solids
    .filter((s) => s.kind === 'floor')
    .map((s) => ({ x: r1.x + s.x, w: s.w }))
    .sort((a, b) => a.x - b.x);
  assert.deepEqual(
    floors.map((f) => [f.x, f.x + f.w]),
    [
      [640, 800],
      [880, 1040],
      [1120, 1280],
    ]
  );
  const rects = listWorldSolidRects(getRooms(), getGates());
  const coversFloor = (x) =>
    rects.some((r) => r.tag === 'floor' && x >= r.x && x < r.x + r.w && r.y === 328);
  assert.equal(coversFloor(820), false, 'pit between floorA and floorB');
  assert.equal(coversFloor(1080), false, 'pit between floorB and floorC');
  assert.equal(coversFloor(720), true);
});

section('data-driven key slabs match v3 hardcode', () => {
  const data = listWorldSolidRects(getRooms(), getGates()).map((r) => ({
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    tag: r.tag,
  }));
  applyDesignConfig({
    schemaVersion: 3,
    logicalW: 640,
    logicalH: 360,
    sections: { rooms: ROOMS.map((r) => ({ ...r })) },
  });
  const hard = listWorldSolidRects(getRooms(), getGates()).map((r) => ({
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    tag: r.tag,
  }));
  const key = (list, pred) => list.find(pred);
  const doorD = key(data, (r) => r.tag === 'doorframe');
  const doorH = key(hard, (r) => r.tag === 'doorframe');
  assert.ok(doorD && doorH);
  assert.deepEqual(doorD, doorH);
  assert.deepEqual({ x: doorD.x, y: doorD.y, w: doorD.w, h: doorD.h }, { x: 1600, y: 264, w: 24, h: 64 });
  const covers = (list, x, y) => list.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  assert.equal(covers(data, 1560, 8), covers(hard, 1560, 8));
  assert.equal(covers(data, 1560, -16), covers(hard, 1560, -16));
  assert.equal(covers(data, 200, 336), covers(hard, 200, 336));
  resetDesignToDefaults();
});

section('design graph validation logs, does not throw', () => {
  assert.deepEqual(validateDesignGraph(), []);
  const errors = [];
  const warns = [];
  const origErr = console.error;
  const origWarn = console.warn;
  console.error = (msg) => errors.push(String(msg));
  console.warn = (msg) => warns.push(String(msg));
  try {
    applyDesignConfig({
      schemaVersion: 4,
      logicalW: 640,
      logicalH: 360,
      sections: {
        pickups: [{ id: 'ghost', roomId: 'NOPE', x: 0, y: 0 }],
        gates: [{ id: 'broken', fromRoomId: '', toRoomId: 'NOPE' }],
        rooms: [
          {
            id: 'R0',
            x: 0,
            y: 0,
            w: 640,
            h: 360,
            solids: [{ id: 'bad', kind: 'floor', x: 0, y: 0, w: 8, h: 8, gapGateId: 'missing_gate' }],
          },
        ],
      },
    });
  } finally {
    console.error = origErr;
    console.warn = origWarn;
  }
  const graph = validateDesignGraph();
  assert.ok(graph.some((e) => e.includes('ghost') && e.includes('NOPE')));
  assert.ok(graph.some((e) => e.includes('broken') && e.includes('fromRoomId')));
  assert.ok(!graph.some((e) => e.includes('gapGateId')), 'missing gapGateId is a warn, not a hard error');
  assert.ok(errors.some((e) => e.includes('design validation')));
  assert.ok(warns.some((e) => e.includes('gapGateId') && e.includes('missing_gate')));
  resetDesignToDefaults();
});

section('unknown solid.kind is custom and does not throw', () => {
  applyDesignConfig({
    schemaVersion: 4,
    logicalW: 640,
    logicalH: 360,
    sections: {
      rooms: [
        {
          id: 'R0',
          x: 0,
          y: 0,
          w: 640,
          h: 360,
          solids: [{ id: 'weird', kind: 'mysteryBox', space: 'local', x: 10, y: 10, w: 8, h: 8 }],
        },
      ],
    },
  });
  const rects = listWorldSolidRects(getRooms(), getGates());
  const custom = rects.find((r) => r.x === 10 && r.y === 10 && r.w === 8 && r.h === 8);
  assert.equal(custom.tag, 'custom');
  resetDesignToDefaults();
});

section('feel alias maps without renaming F1 keys', () => {
  applyDesignConfig({
    schemaVersion: 4,
    sections: { feel: { walkSpeed: 200, gravY: 1800 } },
  });
  const feel = getFeel();
  assert.equal(feel.moveSpeed, 200);
  assert.equal(feel.gravityY, 1800);
  assert.deepEqual(Object.keys(feel), [
    'moveSpeed',
    'airControl',
    'jumpVelocity',
    'jumpCutMultiplier',
    'gravityY',
    'maxFallSpeed',
    'coyoteMs',
    'jumpBufferMs',
    'floatNudge',
  ]);
  resetDesignToDefaults();
});

section('legacy gravity → gravityFall', () => {
  assert.equal(canonicalAbilityId('gravity'), 'gravityFall');
  assert.equal(ABILITY.GRAVITY, 'gravityFall');
  applyDesignConfig({
    schemaVersion: 2,
    logicalW: 640,
    logicalH: 360,
    sections: { player: { startingAbilities: ['gravity'] } },
  });
  assert.deepEqual(getPlayerDesign().startingAbilities, ['gravityFall']);
  resetRun();
  assert.equal(hasAbility('gravity'), true);
  assert.equal(hasAbility('gravityFall'), true);
  assert.equal(getAbilityGrants().hasGravity, true);
  assert.equal(getAbilityGrants().canWalk, false);
  assert.equal(getAbilityGrants().canJump, false);
  resetDesignToDefaults();
  resetRun();
});

section('v1 feel-only import does not rescale', () => {
  applyDesignConfig({ schemaVersion: 1, sections: { feel: { moveSpeed: 220, gravityY: 1960 } } });
  const feel = getFeel();
  assert.equal(feel.moveSpeed, 220);
  assert.equal(feel.gravityY, 1960);
  resetDesignToDefaults();
});

section('v2 player/progress still import', () => {
  applyDesignConfig({
    schemaVersion: 2,
    sections: {
      player: { maxHp: 5, startingHp: 4 },
      progress: { defaultPhase: 'intro', phaseLabels: { intro: 'START' } },
    },
  });
  assert.equal(getPlayerDesign().maxHp, 5);
  assert.equal(getProgressDesign().phaseLabels.intro, 'START');
  assert.equal(getGravityDesign().rotateCamera, false);
  resetDesignToDefaults();
});

section('ability grants stack I then II', () => {
  resetRun();
  assert.equal(getAbilityGrants().bodyMode, 'float');
  unlockAbility('gravityFall');
  let g = getAbilityGrants();
  assert.equal(g.hasGravity, true);
  assert.equal(g.canWalk, false);
  assert.equal(g.canJump, false);
  assert.equal(g.canWallSlide, false);
  assert.equal(g.bodyMode, 'falling');
  unlockAbility('surfaceWalk');
  g = getAbilityGrants();
  assert.equal(g.canWalk, true);
  assert.equal(g.hasFriction, true);
  assert.equal(g.canWallSlide, true);
  assert.equal(g.canJump, false);
  unlockAbility('reactionJump');
  assert.equal(getAbilityGrants().canJump, true);
  resetRun();
});

section('phase mapping', () => {
  resetRun();
  advancePhaseOnAbility('gravityFall');
  assert.equal(getRunState().phase, 'exploration');
  advancePhaseOnAbility('surfaceWalk');
  assert.equal(getRunState().phase, 'frictionLesson');
  resetRun();
});

section('gravity vector math (no camera)', () => {
  assert.deepEqual(downVector('down'), { x: 0, y: 1 });
  assert.deepEqual(downVector('up'), { x: 0, y: -1 });
  assert.deepEqual(gravityAccel(1960, 'up'), { x: 0, y: -1960 });
  assert.deepEqual(gravityAccel(1960, 'right'), { x: 1960, y: 0 });
  assert.deepEqual(walkTangent('down'), { x: 1, y: 0 });
  assert.deepEqual(composeVelocity('down', 220, 0), { x: 220, y: 0 });
  assert.deepEqual(composeVelocity('left', 220, 0), { x: 0, y: 220 });
  assert.equal(rotateCardinal('down', -1), 'left');
  assert.equal(rotateCardinal('down', 1), 'right');
  assert.equal(snapDownToNearestAxis(10, 1), 'right');
  assert.equal(snapDownToNearestAxis(-1, -10), 'up');
  assert.equal(getGravityDown(), 'down');
});

section('R0-R1-R2 corridor joins are not sealed', () => {
  const rooms = getRooms();
  const rects = listWorldSolidRects(rooms, getGates());
  const joins = corridorJoinXs(rooms);
  assert.deepEqual(joins, [640, 1280]);
  for (const x of joins) {
    assert.equal(
      corridorJoinIsSealed(rects, x),
      false,
      `corridor join x=${x} is sealed by a tall solid`
    );
    const tall = rects.filter((r) => r.x <= x && r.x + r.w >= x && r.h > 80 && r.y < 40 && r.y + r.h > 300);
    assert.equal(tall.length, 0, `full-height wall at x=${x}: ${JSON.stringify(tall)}`);
  }
  const mergedFloor = rects.find((r) => r.tag === 'floor' && r.x < 1280 && r.x + r.w > 1280);
  assert.ok(mergedFloor, 'R1 last floor and R2 floor should merge across x=1280');
  const mergedR0 = rects.find((r) => r.tag === 'floor' && r.x < 640 && r.x + r.w > 640);
  assert.ok(mergedR0, 'R0 floor and R1 first floor should merge across x=640');
});

section('visited map contents / unexplored stay empty', () => {
  const rooms = getRooms();
  const pickups = getPickups();
  const gates = getGates();
  const unseen = describeRoomMapContents(rooms.find((r) => r.id === 'R4'), {
    visited: false,
    pickups,
    gates,
    rooms,
  });
  assert.equal(unseen.pickups.length, 0);
  assert.equal(unseen.gates.length, 0);
  assert.equal(unseen.role, null);
  const r2 = describeRoomMapContents(rooms.find((r) => r.id === 'R2'), {
    visited: true,
    pickups,
    gates,
    rooms,
  });
  assert.equal(r2.role, 'pre-fric');
  assert.ok(r2.gates.some((g) => g.dest === 'R4' && g.edge === 'top'));
  const r1 = describeRoomMapContents(rooms.find((r) => r.id === 'R1'), {
    visited: true,
    pickups,
    gates,
    rooms,
  });
  assert.equal(r1.role, 'hub');
  assert.ok(r1.gates.some((g) => g.dest === 'R3' && g.edge === 'bottom'));
  const r0 = describeRoomMapContents(rooms.find((r) => r.id === 'R0'), {
    visited: true,
    pickups,
    gates,
    rooms,
  });
  assert.ok(r0.pickups.some((p) => p.id === 'gravityOrb' && p.tag === 'G'));
  const all = describeMapContents(rooms, { visitedIds: ['R0'], pickups, gates });
  assert.equal(all.R4.pickups.length, 0);
  assert.ok(all.R0.pickups.length > 0);
});

section('gravity down flash math (screen-space, no camera)', () => {
  assert.equal(DOWN_ARROW_GLYPH.down, '↓');
  assert.equal(DOWN_ARROW_GLYPH.right, '→');
  assert.equal(downArrowRotation('down'), 0);
  assert.equal(downArrowRotation('up'), Math.PI);
  assert.equal(downArrowRotation('left'), Math.PI / 2);
  assert.equal(downArrowRotation('right'), -Math.PI / 2);
});

section('abilities design not mixed into feel', () => {
  const feelKeys = Object.keys(getFeel());
  assert.ok(!feelKeys.includes('canWalk'));
  assert.ok(!feelKeys.includes('gravityFall'));
  assert.ok(getAbilitiesDesign().gravityFall.tier === 'I');
});

console.log('\nAll schema v4 contract checks passed.');
