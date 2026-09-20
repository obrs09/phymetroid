#!/usr/bin/env node
/**
 * Schema v4 contract checks (no Phaser). Run: npm run test:schema
 */
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION,
  LAYOUT_REVISION,
  applyDesignConfig,
  applyFeel,
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
  migrateAbilityChainLayout,
  migrateLegacyRoomSolids,
  resetDesignToDefaults,
  stripInvalidGapGateIds,
  validateDesignGraph,
} from '../src/designConfig.js';
import {
  applyWorldRectToSelection,
  commitLayout,
  deleteSelection,
  fourWallsForRoom,
  hitTestEditor,
  makeGate,
  makePickup,
  makeRoom,
  makeSolidLocal,
  nextRoomId,
  renameRoomId,
  snapToGrid,
  worldToLocal,
} from '../src/levelEditor.js';
import { ROOMS } from '../src/rooms.js';
import {
  canonicalizeDown,
  composeVelocity,
  downAngleDeg,
  downArrowGlyph,
  downArrowRotation,
  downVector,
  DOWN_ARROW_GLYPH,
  gravityAccel,
  rotateCardinal,
  rotateDown,
  snapDownToNearestAxis,
  walkTangent,
} from '../src/gravity.js';
import { describeMapContents, describeRoomMapContents } from '../src/mapContents.js';
import {
  corridorJoinIsSealed,
  corridorJoinXs,
  countRoomSourceSolids,
  isTallR2SolidNearGate,
  listWorldSolidRects,
  openSpansOnAxis,
  pointInRect,
  punchOverlappingGateRects,
  R1_PIT_LOCAL_SPANS,
  rectsOverlap,
  SHORT_R2_DOORFRAME_WORLD,
  solidToWorldRect,
  splitRectAroundGate,
  TALL_R2_NEAR_GATE,
} from '../src/worldSolids.js';
import {
  ABILITY,
  advancePhaseOnAbility,
  getAbilityGrants,
  getGravityDown,
  getRunState,
  hasAbility,
  resetRun,
  revokeAbility,
  toggleAbility,
  trySetGravityDown,
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
  assert.equal(dump.layoutRevision, 5);
  assert.equal(LAYOUT_REVISION, 5);
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
  assert.equal(s.progress.abilityPhases.reactionJump, 'jumpLesson');
  assert.equal(s.progress.abilityPhases.gravityField, 'exploration');
  assert.ok(Array.isArray(s.progress.pathIntent.zh));
  assert.ok(s.progress.pathIntent.zh.length >= 4);
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
  assert.deepEqual(
    { x: rooms.R5.x, y: rooms.R5.y, w: rooms.R5.w, h: rooms.R5.h },
    { x: 1920, y: 0, w: 640, h: 360 }
  );
  assert.deepEqual(
    { x: rooms.R6.x, y: rooms.R6.y, w: rooms.R6.w, h: rooms.R6.h },
    { x: 2560, y: 0, w: 640, h: 360 }
  );
  const jumpOrb = getPickups().find((p) => p.id === 'reactionJumpOrb');
  assert.ok(jumpOrb);
  assert.equal(jumpOrb.x, 2000);
  assert.equal(jumpOrb.y, 220);
  assert.equal(jumpOrb.ability, 'reactionJump');
  assert.deepEqual(jumpOrb.requires, ['surfaceWalk']);
  const fieldOrb = getPickups().find((p) => p.id === 'gravityFieldOrb');
  assert.ok(fieldOrb);
  assert.equal(fieldOrb.x, 2880);
  assert.equal(fieldOrb.y, 120);
  assert.equal(fieldOrb.ability, 'gravityField');
  assert.deepEqual(fieldOrb.requires, ['reactionJump']);
  const side = getGates().find((g) => g.id === 'gate_R2_to_R5');
  assert.equal(side.requireAbility, 'surfaceWalk');
  assert.equal(side.kind, 'corridorJoin');
  const jumpGap = getGates().find((g) => g.id === 'gate_R5_mustJump');
  assert.deepEqual(jumpGap.world, { x: 2120, y: 328, w: 160, h: 32 });
  assert.equal(jumpGap.requireAbility, 'reactionJump');
  assert.equal(jumpGap.kind, 'mustJumpGap');
  assert.equal(jumpGap.toRoomId, 'R5');
  assert.equal(getGates().find((g) => g.id === 'gate_R5_to_R6').kind, 'corridorJoin');
  const r5 = rooms.R5;
  assert.deepEqual(
    r5.solids.map((s) => s.id),
    ['R5_floorL', 'R5_floorR', 'R5_ceil', 'R5_platOrb', 'R5_ledge']
  );
  const plat = r5.solids.find((s) => s.id === 'R5_platOrb');
  assert.deepEqual({ x: plat.x, y: plat.y, w: plat.w, h: plat.h }, { x: 40, y: 260, w: 96, h: 16 });
  const ledge = r5.solids.find((s) => s.id === 'R5_ledge');
  assert.deepEqual({ x: ledge.x, y: ledge.y, w: ledge.w, h: ledge.h }, { x: 360, y: 240, w: 120, h: 16 });
  const floorCover = (r5.solids || [])
    .filter((s) => s.kind === 'floor')
    .some((s) => s.y === 328 && s.x < 200 + 160 && s.x + s.w > 200);
  assert.equal(floorCover, false, 'R5 floor must leave the 160px jump gap');
  const r4Wall = rooms.R4.solids.find((s) => s.id === 'R4_wallR');
  assert.equal(r4Wall.h, 360, 'R4 right wall stays sealed (R5 is east of R2, not R4)');
  assert.equal(getGates().some((g) => g.id === 'gate_R4_to_R5'), false);
});

section('v4 rooms[].solids source counts + local/world math', () => {
  const rooms = getRooms();
  assert.deepEqual(countRoomSourceSolids(rooms), { R0: 5, R1: 6, R2: 6, R3: 8, R4: 7, R5: 5, R6: 4 });
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
  assert.deepEqual(countRoomSourceSolids(rooms), { R0: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0 });
  const rects = listWorldSolidRects(rooms, getGates());
  const joins = corridorJoinXs(rooms);
  assert.deepEqual(joins, [640, 1280, 1920, 2560]);
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

section('R3 ceiling openings match R1 pits only; L/R/bottom sealed', () => {
  const r3 = getRooms().find((r) => r.id === 'R3');
  const ceils = r3.solids.filter((s) => s.kind === 'ceiling');
  assert.deepEqual(openSpansOnAxis(ceils, 0, 640), [...R1_PIT_LOCAL_SPANS]);
  const mid = ceils.find((s) => s.id === 'R3_ceilB');
  assert.ok(mid, 'middle ceiling under R1_floorB');
  assert.deepEqual({ x: mid.x, w: mid.w }, { x: 240, w: 160 });

  const rects = listWorldSolidRects(getRooms(), getGates());
  const covers = (x, y) => rects.some((r) => pointInRect(r, x, y));
  const r3Ceils = rects.filter((r) => r.tag === 'ceiling' && r.y === 360);
  assert.deepEqual(openSpansOnAxis(r3Ceils, 640, 1280), [
    { x: 800, w: 80 },
    { x: 1040, w: 80 },
  ]);
  assert.equal(covers(648, 540), true, 'R3 left wall stays');
  assert.equal(covers(1272, 540), true, 'R3 right wall stays');
  assert.equal(covers(960, 700), true, 'R3 floor stays');
  assert.equal(covers(960, 368), true, 'middle under R1_floorB sealed');
  assert.equal(covers(820, 368), false, 'first pit shaft open');
  assert.equal(covers(1080, 368), false, 'second pit shaft open');
  // Unintended exits into void (left of R3 / right of R3 at pit Y) stay blocked.
  assert.equal(covers(640, 500), true);
  assert.equal(covers(1272, 500), true);
});

section('old / malicious tall R2_doorframe is migrated and never built', () => {
  const oldDump = buildExportPayload();
  const r2 = oldDump.sections.rooms.find((r) => r.id === 'R2');
  const door = r2.solids.find((s) => s.id === 'R2_doorframe');
  Object.assign(door, { space: 'world', x: 1496, y: 16, w: 24, h: 312 });
  const r3 = oldDump.sections.rooms.find((r) => r.id === 'R3');
  r3.solids = r3.solids.filter((s) => s.kind !== 'ceiling').concat([
    { id: 'R3_ceilL', kind: 'ceiling', space: 'local', x: 0, y: 0, w: 200, h: 16, fixed: true },
    { id: 'R3_ceilR', kind: 'ceiling', space: 'local', x: 440, y: 0, w: 200, h: 16, fixed: true },
  ]);
  delete oldDump.layoutRevision;

  applyDesignConfig(oldDump);
  const migratedR2 = getRooms().find((r) => r.id === 'R2');
  const migratedDoor = migratedR2.solids.find((s) => s.id === 'R2_doorframe');
  assert.equal(migratedDoor.space, 'local');
  assert.deepEqual(
    { x: migratedDoor.x, y: migratedDoor.y, w: migratedDoor.w, h: migratedDoor.h },
    { x: 320, y: 264, w: 24, h: 64 }
  );
  const migratedR3 = getRooms().find((r) => r.id === 'R3');
  assert.deepEqual(
    openSpansOnAxis(
      migratedR3.solids.filter((s) => s.kind === 'ceiling'),
      0,
      640
    ),
    [...R1_PIT_LOCAL_SPANS]
  );

  const rects = listWorldSolidRects(getRooms(), getGates());
  const tall = rects.filter((r) => isTallR2SolidNearGate(r));
  assert.equal(tall.length, 0, `tall mid-R2 solid survived load: ${JSON.stringify(tall)}`);
  const nearGate = rects.filter(
    (r) => r.h >= TALL_R2_NEAR_GATE.minH && r.x < 1620 && r.x + r.w > 1480
  );
  assert.equal(nearGate.length, 0, `h>=200 near gate: ${JSON.stringify(nearGate)}`);
  const stub = rects.find((r) => r.tag === 'doorframe');
  assert.deepEqual(
    { x: stub.x, y: stub.y, w: stub.w, h: stub.h },
    { ...SHORT_R2_DOORFRAME_WORLD }
  );
  const gate = getGates().find((g) => g.id === 'gate_R2_to_R4').world;
  assert.equal(rectsOverlap(stub, gate), false);
  resetDesignToDefaults();
});

section('listWorldSolidRects strips tall doorframe even if migrate is skipped', () => {
  const rooms = getRooms();
  const r2 = rooms.find((r) => r.id === 'R2');
  r2.solids = r2.solids.map((s) =>
    s.id === 'R2_doorframe' ? { ...s, space: 'world', x: 1496, y: 16, w: 24, h: 312 } : s
  );
  const rawWorld = solidToWorldRect(r2, r2.solids.find((s) => s.id === 'R2_doorframe'));
  assert.equal(isTallR2SolidNearGate(rawWorld), true);
  const rects = listWorldSolidRects(rooms, getGates());
  assert.equal(rects.filter((r) => isTallR2SolidNearGate(r)).length, 0);
  const stub = rects.find((r) => r.tag === 'doorframe');
  assert.deepEqual({ x: stub.x, y: stub.y, w: stub.w, h: stub.h }, { ...SHORT_R2_DOORFRAME_WORLD });
  const { changed } = migrateLegacyRoomSolids(rooms);
  assert.equal(changed, true);
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
  const bad = getRooms().find((r) => r.id === 'R0')?.solids?.find((s) => s.id === 'bad');
  assert.equal(bad?.gapGateId, undefined, 'missing gapGateId must be stripped on import');
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
  const exported = getRooms().find((r) => r.id === 'R0').solids.find((s) => s.id === 'weird');
  assert.equal(exported.kind, 'custom', 'unknown kind remaps to custom on export, rect kept');
  assert.deepEqual({ x: exported.x, y: exported.y, w: exported.w, h: exported.h }, { x: 10, y: 10, w: 8, h: 8 });
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
  assert.equal(getAbilityGrants().canWallJump, true);
  unlockAbility('gravityField');
  assert.equal(getAbilityGrants().gravityDirections, 'arbitrary');
  assert.equal(getAbilityGrants().toggleAnytime, true);
  revokeAbility('reactionJump');
  assert.equal(getAbilityGrants().canJump, false, 'revoke reactionJump removes jump');
  assert.equal(getAbilityGrants().gravityDirections, 'arbitrary');
  toggleAbility('reactionJump');
  assert.equal(getAbilityGrants().canJump, true);
  resetRun();
});

section('phase mapping', () => {
  resetRun();
  advancePhaseOnAbility('gravityFall');
  assert.equal(getRunState().phase, 'exploration');
  advancePhaseOnAbility('surfaceWalk');
  assert.equal(getRunState().phase, 'frictionLesson');
  advancePhaseOnAbility('reactionJump');
  assert.equal(getRunState().phase, 'jumpLesson');
  advancePhaseOnAbility('gravityField');
  assert.equal(getRunState().phase, 'exploration');
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
  const s = Math.SQRT1_2;
  assert.ok(Math.abs(downVector(45).x - s) < 1e-9);
  assert.ok(Math.abs(downVector(45).y - s) < 1e-9);
  assert.equal(canonicalizeDown(90), 'right');
  assert.equal(canonicalizeDown(45), 45);
  assert.equal(downAngleDeg('left'), 270);
  assert.equal(rotateDown('down', 1, 45), 45);
  assert.equal(rotateDown(45, 1, 45), 'right');
  assert.equal(downArrowGlyph(45), '↘');
  resetRun();
  unlockAbility('gravityFall');
  const snapped = trySetGravityDown(80, true);
  assert.equal(snapped.down, 'right', 'pre-field 80° snaps to nearest cardinal');
  unlockAbility('surfaceWalk');
  unlockAbility('reactionJump');
  unlockAbility('gravityField');
  const diag = trySetGravityDown(45, false);
  assert.equal(diag.changed, true);
  assert.equal(diag.down, 45);
  assert.equal(getGravityDown(), 45);
  resetRun();
});

section('R0-R1-R2 corridor joins are not sealed', () => {
  const rooms = getRooms();
  const rects = listWorldSolidRects(rooms, getGates());
  const joins = corridorJoinXs(rooms);
  assert.deepEqual(joins, [640, 1280, 1920, 2560]);
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
  const jumpGapOpen = !rects.some((r) => pointInRect(r, 2200, 336));
  assert.equal(jumpGapOpen, true, 'R5 jump gap world (2120,328,160,32) must be open');
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
  const r5 = describeRoomMapContents(rooms.find((r) => r.id === 'R5'), {
    visited: true,
    pickups,
    gates,
    rooms,
  });
  assert.equal(r5.role, 'jump');
  assert.ok(r5.pickups.some((p) => p.id === 'reactionJumpOrb' && p.tag === 'J'));
  assert.ok(r5.gates.some((g) => g.dest === 'R6'));
  const r6 = describeRoomMapContents(rooms.find((r) => r.id === 'R6'), {
    visited: true,
    pickups,
    gates,
    rooms,
  });
  assert.equal(r6.role, 'field');
  assert.ok(r6.pickups.some((p) => p.id === 'gravityFieldOrb' && p.tag === 'F'));
  const all = describeMapContents(rooms, { visitedIds: ['R0'], pickups, gates });
  assert.equal(all.R4.pickups.length, 0);
  assert.equal(all.R5.pickups.length, 0);
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

section('rev-5 dump gains R5/R6 on the Y=0 corridor', () => {
  const oldDump = buildExportPayload();
  oldDump.layoutRevision = 5;
  oldDump.sections.rooms = oldDump.sections.rooms.filter((r) => r.id !== 'R5' && r.id !== 'R6');
  oldDump.sections.pickups = oldDump.sections.pickups.filter(
    (p) => p.id !== 'reactionJumpOrb' && p.id !== 'gravityFieldOrb'
  );
  oldDump.sections.gates = oldDump.sections.gates.filter(
    (g) => g.id !== 'gate_R2_to_R5' && g.id !== 'gate_R5_mustJump' && g.id !== 'gate_R5_to_R6'
  );
  const r4 = oldDump.sections.rooms.find((r) => r.id === 'R4');
  const wall = r4.solids.find((s) => s.id === 'R4_wallR');
  wall.h = 360;

  applyDesignConfig(oldDump);
  const rooms = Object.fromEntries(getRooms().map((r) => [r.id, r]));
  assert.ok(rooms.R5, 'R5 restored');
  assert.ok(rooms.R6, 'R6 restored');
  assert.equal(rooms.R5.x, 1920);
  assert.equal(rooms.R5.y, 0);
  assert.equal(rooms.R6.x, 2560);
  assert.equal(rooms.R6.y, 0);
  assert.ok(getPickups().some((p) => p.id === 'reactionJumpOrb' && p.y === 220));
  assert.ok(getPickups().some((p) => p.id === 'gravityFieldOrb' && p.x === 2880));
  assert.ok(getGates().some((g) => g.id === 'gate_R5_mustJump'));
  const { changed } = migrateAbilityChainLayout({
    rooms: getRooms(),
    pickups: getPickups(),
    gates: getGates(),
  });
  assert.equal(changed, false, 'migration is idempotent on the current bake');
  const r2 = getRooms().find((r) => r.id === 'R2');
  const door = r2.solids.find((s) => s.id === 'R2_doorframe');
  assert.deepEqual({ x: door.x, y: door.y, w: door.w, h: door.h }, { x: 320, y: 264, w: 24, h: 64 });
  resetDesignToDefaults();
});

section('invented y=-360 R5/R6 dump relocates onto the Y=0 corridor', () => {
  const invented = buildExportPayload();
  const r5 = invented.sections.rooms.find((r) => r.id === 'R5');
  const r6 = invented.sections.rooms.find((r) => r.id === 'R6');
  r5.y = -360;
  r6.y = -360;
  const jump = invented.sections.pickups.find((p) => p.id === 'reactionJumpOrb');
  const field = invented.sections.pickups.find((p) => p.id === 'gravityFieldOrb');
  jump.x = 2000;
  jump.y = -80;
  field.x = 2680;
  field.y = -160;
  invented.sections.gates.push({
    id: 'gate_R4_to_R5',
    fromRoomId: 'R4',
    toRoomId: 'R5',
    kind: 'sidePassage',
    requireAbility: 'surfaceWalk',
    world: { x: 1904, y: -160, w: 32, h: 128 },
  });
  const r4 = invented.sections.rooms.find((r) => r.id === 'R4');
  r4.solids.find((s) => s.id === 'R4_wallR').h = 200;

  applyDesignConfig(invented);
  const rooms = Object.fromEntries(getRooms().map((r) => [r.id, r]));
  assert.equal(rooms.R5.y, 0);
  assert.equal(rooms.R5.x, 1920);
  assert.equal(rooms.R6.y, 0);
  assert.equal(rooms.R6.x, 2560);
  assert.equal(rooms.R5.solids.length, 5);
  assert.equal(rooms.R4.solids.find((s) => s.id === 'R4_wallR').h, 360);
  const jumpOrb = getPickups().find((p) => p.id === 'reactionJumpOrb');
  assert.deepEqual({ x: jumpOrb.x, y: jumpOrb.y, roomId: jumpOrb.roomId }, { x: 2000, y: 220, roomId: 'R5' });
  const fieldOrb = getPickups().find((p) => p.id === 'gravityFieldOrb');
  assert.deepEqual({ x: fieldOrb.x, y: fieldOrb.y }, { x: 2880, y: 120 });
  assert.equal(getGates().some((g) => g.id === 'gate_R4_to_R5'), false);
  assert.ok(getGates().some((g) => g.id === 'gate_R5_mustJump' && g.world?.x === 2120));
  resetDesignToDefaults();
});

section('abilities design not mixed into feel', () => {
  const feelKeys = Object.keys(getFeel());
  assert.ok(!feelKeys.includes('canWalk'));
  assert.ok(!feelKeys.includes('gravityFall'));
  assert.ok(getAbilitiesDesign().gravityFall.tier === 'I');
});

section('level editor helpers snap / ids / local solids', () => {
  assert.equal(snapToGrid(17, 16), 16);
  assert.equal(snapToGrid(25, 8), 24);
  const rooms = getRooms();
  assert.equal(nextRoomId(rooms), 'R7');
  const room = makeRoom({ x: 3200, y: 0, w: 640, h: 360 }, rooms, { autoWalls: false });
  assert.equal(room.id, 'R7');
  assert.deepEqual(room.solids, [], 'editor rooms without walls still carry solids: []');
  assert.deepEqual({ x: room.x, y: room.y, w: room.w, h: room.h }, { x: 3200, y: 0, w: 640, h: 360 });
  const walls = fourWallsForRoom(room);
  assert.equal(walls.length, 4);
  assert.equal(walls[0].space, 'local');
  assert.equal(walls[0].kind, 'floor');
  const wall = makeSolidLocal(room, { x: 3216, y: 16, w: 32, h: 64 }, { kind: 'wall' });
  assert.equal(wall.space, 'local');
  assert.deepEqual(worldToLocal(room, { x: 3216, y: 16, w: 32, h: 64 }), { x: 16, y: 16, w: 32, h: 64 });
  assert.deepEqual({ x: wall.x, y: wall.y, w: wall.w, h: wall.h }, { x: 16, y: 16, w: 32, h: 64 });
});

section('level editor round-trip: room + walls + pickup + gate validates', () => {
  resetDesignToDefaults();
  const rooms = getRooms();
  const pickups = getPickups();
  const gates = getGates();
  const room = makeRoom({ x: 3200, y: 0, w: 640, h: 360 }, rooms, { autoWalls: true });
  assert.equal(room.solids.length, 4);
  rooms.push(room);
  const extra = makeSolidLocal(room, { x: 3360, y: 200, w: 96, h: 16 }, { kind: 'plat' });
  room.solids.push(extra);
  const pickup = makePickup(3400, 180, 'reactionJump', rooms, pickups);
  assert.equal(pickup.ability, 'reactionJump');
  assert.equal(pickup.roomId, 'R7');
  assert.deepEqual(pickup.requires, ['surfaceWalk']);
  assert.equal(pickup.onCollect.unlockAbility, 'reactionJump');
  pickups.push(pickup);
  const gate = makeGate(
    { x: 3184, y: 200, w: 32, h: 80 },
    rooms,
    gates,
    { kind: 'corridorJoin', requireAbility: 'reactionJump', fromRoomId: 'R6', toRoomId: 'R7' }
  );
  assert.equal(gate.fromRoomId, 'R6');
  assert.equal(gate.toRoomId, 'R7');
  assert.equal(gate.kind, 'corridorJoin');
  assert.deepEqual(gate.world, { x: 3184, y: 200, w: 32, h: 80 });
  gates.push(gate);

  const dump = commitLayout({ rooms, pickups, gates });
  assert.equal(dump.schemaVersion, 4);
  assert.equal(dump.layoutRevision, 5);
  assert.ok(dump.sections.feel.moveSpeed);
  assert.deepEqual(validateDesignGraph(dump.sections), []);
  const r7 = getRooms().find((r) => r.id === 'R7');
  assert.ok(r7);
  assert.equal(r7.solids.filter((s) => s.space === 'local').length, r7.solids.length);
  assert.ok(r7.solids.some((s) => s.id === 'R7_floor' && s.kind === 'floor'));
  assert.ok(r7.solids.some((s) => s.id === extra.id && s.kind === 'plat' && s.x === 160));
  const orb = getPickups().find((p) => p.id === pickup.id);
  assert.equal(orb.x, 3400);
  assert.equal(orb.y, 180);
  const g = getGates().find((x) => x.id === gate.id);
  assert.equal(g.requireAbility, 'reactionJump');
  // Engine still owns corridor merge — editor did not invent join slabs.
  assert.equal(r7.solids.some((s) => s.kind === 'corridorJoin'), false);

  const snap = { rooms: getRooms(), pickups: getPickups(), gates: getGates() };
  const hitPlat = hitTestEditor(snap.rooms, snap.pickups, snap.gates, 3408, 208);
  assert.equal(hitPlat?.type, 'solid');
  assert.equal(hitPlat?.solid?.id, extra.id);
  const hitOrb = hitTestEditor(snap.rooms, snap.pickups, snap.gates, 3400, 180);
  assert.equal(hitOrb?.type, 'pickup');

  applyWorldRectToSelection(hitPlat, { x: 3376, y: 216, w: 96, h: 16 }, snap.rooms, snap.pickups);
  const moved = snap.rooms.find((r) => r.id === 'R7').solids.find((s) => s.id === extra.id);
  assert.deepEqual({ x: moved.x, y: moved.y }, { x: 176, y: 216 });

  const afterDel = deleteSelection(hitOrb, snap.rooms, snap.pickups, snap.gates);
  assert.equal(afterDel.pickups.some((p) => p.id === pickup.id), false);
  resetDesignToDefaults();
  assert.equal(getRooms().some((r) => r.id === 'R7'), false);
  assert.equal(getRooms().length, 7);
});

section('empty solids arrays are preserved; missing solids still fallback', () => {
  const dump = buildExportPayload();
  const r0 = dump.sections.rooms.find((r) => r.id === 'R0');
  r0.solids = [];
  applyDesignConfig(dump);
  const kept = getRooms().find((r) => r.id === 'R0');
  assert.ok(Array.isArray(kept.solids), 'explicit empty solids must stay an array');
  assert.equal(kept.solids.length, 0);
  const exported = buildExportPayload().sections.rooms.find((r) => r.id === 'R0');
  assert.deepEqual(exported.solids, []);
  assert.ok(!('pickups' in exported));
  assert.ok(!('gates' in exported));
  const rects = listWorldSolidRects(getRooms(), getGates());
  const r0Floor = rects.some((r) => r.tag === 'floor' && r.x < 640 && r.y === 328);
  assert.equal(r0Floor, false, 'solids:[] must not fall back to hardcoded R0 floor');
  assert.equal(countRoomSourceSolids(getRooms()).R0, 0);

  applyDesignConfig({
    schemaVersion: 3,
    logicalW: 640,
    logicalH: 360,
    sections: { rooms: ROOMS.map((r) => ({ ...r })) },
  });
  assert.equal(getRooms().find((r) => r.id === 'R0').solids, undefined);
  const fallbackRects = listWorldSolidRects(getRooms(), getGates());
  assert.equal(
    fallbackRects.some((r) => r.tag === 'floor' && r.x < 640 && r.y === 328),
    true,
    'omitted solids still use the v3 hardcode'
  );
  resetDesignToDefaults();
});

section('gapGateId without a world-bearing gate is warned and stripped', () => {
  const dump = buildExportPayload();
  const r1 = dump.sections.rooms.find((r) => r.id === 'R1');
  const floor = r1.solids.find((s) => s.id === 'R1_floorA') || r1.solids.find((s) => s.kind === 'floor');
  floor.gapGateId = 'gate_R1_to_R3';
  const r2 = dump.sections.rooms.find((r) => r.id === 'R2');
  r2.solids.push({
    id: 'R2_orphanGap',
    kind: 'floor',
    space: 'local',
    x: 0,
    y: 0,
    w: 8,
    h: 8,
    gapGateId: 'no_such_gate',
  });
  const warns = [];
  const origWarn = console.warn;
  console.warn = (msg) => warns.push(String(msg));
  try {
    applyDesignConfig(dump);
  } finally {
    console.warn = origWarn;
  }
  const afterR1 = getRooms().find((r) => r.id === 'R1');
  const afterFloor = afterR1.solids.find((s) => s.id === floor.id);
  assert.equal(afterFloor.gapGateId, undefined, 'floorGap gate_R1_to_R3 must not keep gapGateId');
  const pit = getGates().find((g) => g.id === 'gate_R1_to_R3');
  assert.equal(pit.world, undefined, 'must not invent world on gate_R1_to_R3');
  const orphan = getRooms().find((r) => r.id === 'R2').solids.find((s) => s.id === 'R2_orphanGap');
  assert.ok(orphan, 'unknown-kind/orphan rect is kept');
  assert.equal(orphan.gapGateId, undefined);
  assert.ok(warns.some((e) => e.includes('gate_R1_to_R3') && e.includes('no world')));
  assert.ok(warns.some((e) => e.includes('no_such_gate')));
  const ceil = getRooms().find((r) => r.id === 'R2').solids.find((s) => s.id === 'R2_ceil');
  assert.equal(ceil.gapGateId, 'gate_R2_to_R4', 'world-bearing gapGateId stays');
  const stripped = stripInvalidGapGateIds(getRooms(), getGates());
  assert.equal(stripped.changed, false, 'strip is idempotent after import');
  resetDesignToDefaults();
});

section('editor geometry commit does not clobber feel keys', () => {
  applyFeel({ moveSpeed: 199, coyoteMs: 120 });
  const before = getFeel();
  assert.equal(before.moveSpeed, 199);
  assert.equal(before.coyoteMs, 120);
  const rooms = getRooms();
  rooms.find((r) => r.id === 'R0').intent = 'editor-geometry-only';
  const dump = commitLayout({ rooms, pickups: getPickups(), gates: getGates() });
  const after = getFeel();
  assert.deepEqual(after, before);
  assert.deepEqual(Object.keys(dump.sections.feel), Object.keys(before));
  assert.equal(dump.sections.feel.moveSpeed, 199);
  assert.equal(dump.sections.feel.coyoteMs, 120);
  assert.equal(dump.sections.feel.gravityY, 1960);
  assert.equal(dump.sections.feel.jumpVelocity, -550);
  resetDesignToDefaults();
});

section('export → applyDesignConfig round-trip keeps geometry + feel + ability chain', () => {
  applyFeel({ moveSpeed: 205, floatNudge: 64 });
  const first = buildExportPayload();
  assert.equal(first.schemaVersion, 4);
  assert.equal(first.layoutRevision, 5);
  applyDesignConfig(JSON.parse(JSON.stringify(first)));
  const second = buildExportPayload();
  const stripTime = (p) => {
    const { exportedAt, ...rest } = p;
    return rest;
  };
  assert.deepEqual(stripTime(second).sections.rooms, stripTime(first).sections.rooms);
  assert.deepEqual(stripTime(second).sections.pickups, stripTime(first).sections.pickups);
  assert.deepEqual(stripTime(second).sections.gates, stripTime(first).sections.gates);
  assert.deepEqual(stripTime(second).sections.feel, stripTime(first).sections.feel);
  assert.equal(second.sections.feel.moveSpeed, 205);
  assert.equal(second.schemaVersion, 4);
  for (const room of second.sections.rooms) {
    assert.ok(Array.isArray(room.solids), `${room.id} must export solids`);
    assert.equal(room.pickups, undefined);
    assert.equal(room.gates, undefined);
  }
  assert.ok(Array.isArray(second.sections.pickups));
  assert.ok(Array.isArray(second.sections.gates));
  assert.ok(second.sections.pickups.some((p) => p.id === 'reactionJumpOrb' && p.roomId === 'R5'));
  assert.ok(second.sections.gates.some((g) => g.id === 'gate_R5_mustJump' && g.world?.x === 2120));
  resetDesignToDefaults();
});

section('nested room pickups/gates are dropped; sections stay top-level', () => {
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
          solids: [],
          pickups: [{ id: 'nestedOrb', roomId: 'R0', x: 10, y: 10 }],
          gates: [{ id: 'nestedGate', fromRoomId: 'R0', toRoomId: 'R0' }],
        },
      ],
      pickups: [{ id: 'gravityOrb', ability: 'gravityFall', roomId: 'R0', x: 256, y: 136 }],
      gates: [{ id: 'gate_R0_loop', fromRoomId: 'R0', toRoomId: 'R0', kind: 'passage' }],
    },
  });
  const room = getRooms().find((r) => r.id === 'R0');
  assert.deepEqual(room.solids, []);
  assert.equal(room.pickups, undefined);
  assert.equal(room.gates, undefined);
  const dump = buildExportPayload();
  assert.equal(
    dump.sections.rooms.some((r) => r.pickups || r.gates),
    false,
    'export must not nest pickups/gates into rooms'
  );
  assert.ok(dump.sections.pickups.some((p) => p.id === 'gravityOrb'));
  assert.equal(dump.sections.pickups.some((p) => p.id === 'nestedOrb'), false);
  assert.ok(dump.sections.gates.some((g) => g.id === 'gate_R0_loop'));
  resetDesignToDefaults();
});

section('room rename retargets pickup.roomId and gate endpoints', () => {
  const rooms = getRooms();
  const pickups = getPickups();
  const gates = getGates();
  const extra = makeRoom({ x: 3200, y: 0, w: 640, h: 360 }, rooms, { autoWalls: true });
  rooms.push(extra);
  const orb = makePickup(3400, 180, 'gravityFall', rooms, pickups);
  pickups.push(orb);
  const gate = makeGate(
    { x: 3184, y: 200, w: 32, h: 80 },
    rooms,
    gates,
    { kind: 'corridorJoin', fromRoomId: 'R6', toRoomId: extra.id, requireAbility: 'gravityFall' }
  );
  gates.push(gate);
  renameRoomId(rooms, pickups, gates, extra.id, 'RHub');
  assert.equal(rooms.find((r) => r.id === 'RHub')?.id, 'RHub');
  assert.equal(pickups.find((p) => p.id === orb.id).roomId, 'RHub');
  assert.equal(gates.find((g) => g.id === gate.id).toRoomId, 'RHub');
  assert.equal(gates.find((g) => g.id === gate.id).fromRoomId, 'R6');
  const dump = commitLayout({ rooms, pickups, gates });
  assert.equal(dump.sections.rooms.some((r) => r.id === 'RHub'), true);
  assert.equal(dump.sections.pickups.find((p) => p.id === orb.id).roomId, 'RHub');
  assert.equal(dump.sections.gates.find((g) => g.id === gate.id).toRoomId, 'RHub');
  assert.deepEqual(validateDesignGraph(dump.sections), []);
  resetDesignToDefaults();
});

console.log('\nAll schema v4 contract checks passed.');
