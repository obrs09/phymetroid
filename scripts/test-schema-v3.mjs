#!/usr/bin/env node
/**
 * Schema v3 contract checks (no Phaser). Run: npm run test:schema
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
} from '../src/designConfig.js';
import {
  composeVelocity,
  downVector,
  gravityAccel,
  rotateCardinal,
  snapDownToNearestAxis,
  walkTangent,
} from '../src/gravity.js';
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

section('schemaVersion 3 export shape', () => {
  const dump = buildExportPayload();
  assert.equal(dump.schemaVersion, 3);
  assert.equal(SCHEMA_VERSION, 3);
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

section('abilities design not mixed into feel', () => {
  const feelKeys = Object.keys(getFeel());
  assert.ok(!feelKeys.includes('canWalk'));
  assert.ok(!feelKeys.includes('gravityFall'));
  assert.ok(getAbilitiesDesign().gravityFall.tier === 'I');
});

console.log('\nAll schema v3 contract checks passed.');
