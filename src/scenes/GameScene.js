import Phaser from 'phaser';
import { GAME_W, GAME_H, getWorldBounds, findRoomAt, findRoomById, UI_FONT_LG, UI_FONT_MD, UI_FONT_SM, px } from '../rooms.js';
import { applyPlayerFeelLimits, createPlayer } from '../player.js';
import {
  applyFeel,
  getFeel,
  getGates,
  getPickups,
  getRooms,
  subscribeDesign,
  subscribeLayout,
} from '../designConfig.js';
import { isTypingInEditorField } from '../levelEditor.js';
import { FeelDebugPanel } from '../feelDebugPanel.js';
import { GravityDownFlash } from '../gravityFlash.js';
import { addHudText, refreshHudTextResolution } from '../hudText.js';
import { describeMapContents } from '../mapContents.js';
import { RunHud } from '../runHud.js';
import { buildWorldSolids, corridorOpenEdges, listWorldSolidRects } from '../worldSolids.js';
import {
  applyGravityVectorToWorld,
  composeVelocity,
  isSupportedOnDown,
  isTouchingWall,
  rotateDown,
  splitVelocity,
  tagFixed,
  wallJumpWalkSign,
} from '../gravity.js';
import {
  ABILITY,
  addItem,
  advancePhaseOnAbility,
  canChangeGravityDirection,
  damage,
  getAbilityGrants,
  getGravityDown,
  getHp,
  getMaxHp,
  getPhase,
  getRunState,
  hasAbility,
  hasVisitedRoom,
  heal,
  isDead,
  markRoomVisited,
  respawn,
  setPhase,
  snapGravityDownToDefault,
  toggleAbility,
  trySetGravityDown,
  unlockAbility,
} from '../runState.js';

const WALL_SLIDE_FALL_FACTOR = 0.4;

const PICKUP_COLORS = {
  gravityOrb: { fill: 0xffeb3b, stroke: 0xfff59d },
  surfaceWalkOrb: { fill: 0x80deea, stroke: 0xe0f7fa },
  reactionJumpOrb: { fill: 0xff8a65, stroke: 0xffccbc },
  gravityFieldOrb: { fill: 0xb39ddb, stroke: 0xe8eaf6 },
};

const FIELD_ROTATE_DEG = 45;
const FIELD_ROTATE_FINE_DEG = 15;
const FIELD_MAG_STEP = 40;

function parseHexColor(hex, fallback) {
  if (typeof hex !== 'string') return fallback;
  const m = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return fallback;
  return Number.parseInt(m, 16);
}

/**
 * Metroidvania prototype:
 * float → gravityFall → cardinal gravity to R2 → flip up into R4
 * → surfaceWalk → R5 reactionJump → R6 gravityField.
 * Camera room-snaps; gravity vector only (never rotates).
 *
 * Gravity rotates the accel vector only. Camera stays axis-aligned.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.currentRoomId = null;
    this.debugVisible = false;
    this.mapVisible = false;
    this.roomLayer = [];
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.jumpHeld = false;
  }

  rooms() {
    return getRooms();
  }

  create() {
    const rooms = this.rooms();
    const world = getWorldBounds(rooms);
    this.physics.world.setBounds(world.x, world.y, world.w, world.h);
    this.physics.world.gravity.x = 0;
    this.physics.world.gravity.y = 0;

    this.drawRoomBackgrounds();
    this.solids = this.physics.add.staticGroup();
    buildWorldSolids(this, this.solids, rooms, getGates());

    this.player = createPlayer(this, px(100), px(72));
    this.player.setData('fixed', false);

    this.pickupGroup = this.physics.add.group();
    this.spawnPickups();

    this.bindPlayerPhysics();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.F1]);
    this.keys = this.input.keyboard.addKeys({
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      m: Phaser.Input.Keyboard.KeyCodes.M,
      f1: Phaser.Input.Keyboard.KeyCodes.F1,
      backtick: Phaser.Input.Keyboard.KeyCodes.BACKTICK,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      i: Phaser.Input.Keyboard.KeyCodes.I,
      j: Phaser.Input.Keyboard.KeyCodes.J,
      k: Phaser.Input.Keyboard.KeyCodes.K,
      l: Phaser.Input.Keyboard.KeyCodes.L,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      bracketLeft: Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET,
      bracketRight: Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET,
    });

    this.statusText = addHudText(this, GAME_W / 2, px(28), '', {
      fontSize: UI_FONT_LG,
      color: '#ffe082',
    })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.hintText = addHudText(
      this,
      GAME_W / 2,
      GAME_H - px(12),
      this.hintLine(),
      {
        fontSize: UI_FONT_MD,
        color: '#90a4ae',
      }
    )
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(100);

    this.buildMapOverlay();
    this.gravityFlash = new GravityDownFlash(this);
    // Cursors must exist before the panel reuses them for ↑↓←→.
    this.debugPanel = new FeelDebugPanel(this);
    this.runHud = new RunHud(this);
    this._unsubDesign = subscribeDesign(() => this.applyLiveFeel());
    this._unsubLayout = subscribeLayout(() => this.rebuildWorldFromDesign());
    this.applyLiveFeel();
    this.syncGravityFromState();

    const startRoom = findRoomAt(this.player.x, this.player.y, rooms) || rooms[0];
    this.markVisited(startRoom);
    this.snapCameraToRoom(startRoom, true);

    this.input.keyboard.on('keydown-F1', (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      this.toggleDebug();
    });
    this.input.keyboard.on('keydown-BACKTICK', () => this.toggleDebug());
    this.input.keyboard.on('keydown-M', () => {
      if (isTypingInEditorField()) return;
      this.toggleMap();
    });
    this.input.keyboard.on('keydown-NINE', () => {
      if (isTypingInEditorField()) return;
      this.debugDamage(1);
    });
    this.input.keyboard.on('keydown-ZERO', () => {
      if (isTypingInEditorField()) return;
      heal(1);
    });

    refreshHudTextResolution(this.scale.zoom);

    if (typeof window !== 'undefined') {
      window.__PHYMETROID_DEBUG__ = {
        pos: () => ({
          x: this.player.x,
          y: this.player.y,
          room: this.currentRoomId,
          down: getGravityDown(),
        }),
        camRotation: () => this.cameras.main.rotation,
        warp: (x, y) => {
          this.player.setPosition(x, y);
          this.player.setVelocity(0, 0);
          const room = findRoomAt(x, y, this.rooms());
          if (room) this.snapCameraToRoom(room, true);
          return window.__PHYMETROID_DEBUG__.pos();
        },
        setDown: (axis, supported = true) => {
          const result = trySetGravityDown(axis, supported);
          this.syncGravityFromState();
          if (result.changed) this.flashGravityDown(result.down);
          return { ...result, ...window.__PHYMETROID_DEBUG__.pos() };
        },
        toggleFeel: () => this.toggleDebug(),
        toggleMap: () => this.toggleMap(),
        toggleLevelEdit: () => this.debugPanel?.setEditorOn(!this.debugPanel.editorOn),
        editor: () => this.debugPanel?.levelEditor?.getState?.() ?? null,
        editorView: () => this.debugPanel?.levelEditor?.view?.getState?.() ?? null,
        editorUndo: () => this.debugPanel?.levelEditor?.undo?.() ?? false,
        editorRedo: () => this.debugPanel?.levelEditor?.redo?.() ?? false,
        editorCommit: (next) => this.debugPanel?.levelEditor?.commit?.(next),
        editorSetZoom: (z) => this.debugPanel?.levelEditor?.view?.setUserZoom?.(z),
        editorFit: () => this.debugPanel?.levelEditor?.view?.fitCurrentRoom?.(),
        editorOneToOne: () => this.debugPanel?.levelEditor?.view?.resetOneToOne?.(),
        toggleAbility: (id) => this.debugToggleAbility(id),
        warpRoom: (id) => this.debugWarpRoom(id),
        flash: () => this.gravityFlash?.getState() ?? null,
        mapContents: () => this.describeVisibleMapContents(),
        solidsNear: (x, pad = 8) => this.solidsNear(x, pad),
        pickups: () =>
          (this.pickupGroup?.getChildren() || []).map((p) => {
            const spec = p.getData?.('pickup');
            return {
              id: spec?.id,
              x: p.x,
              y: p.y,
              active: p.active,
              hasBody: Boolean(p.body),
            };
          }),
      };
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._unsubDesign?.();
      this._unsubLayout?.();
      this.debugPanel?.levelEditor?.destroy?.();
      if (typeof window !== 'undefined' && window.__PHYMETROID_DEBUG__) {
        delete window.__PHYMETROID_DEBUG__;
      }
    });
  }

  hintLine() {
    const grants = getAbilityGrants();
    if (!grants.hasGravity) {
      return 'NUDGE TO YELLOW: GRAVITY FALL  |  M MAP  |  F1 FEEL  |  F FULL';
    }
    const field = grants.gravityDirections === 'arbitrary';
    const grav = field
      ? 'Q/E 45°  SHIFT+Q/E 15°  IJKL  [ ] MAG  (air ok)'
      : 'Q/E ROT  IJKL SET DOWN';
    if (grants.canJump) return `A/D WALK  W/SPACE JUMP  ${grav}  M  F1`;
    if (grants.canWalk) return `A/D WALK/SLIDE  ${grav}  M MAP  F1 FEEL`;
    return `FALL BODY  ${grav}  (no walk/jump)  M MAP  F1`;
  }

  gravityOn() {
    return getAbilityGrants().hasGravity;
  }

  syncGravityFromState() {
    const feel = getFeel();
    const grants = getAbilityGrants();
    applyGravityVectorToWorld(this.physics.world, feel.gravityY, getGravityDown(), {
      enabled: grants.hasGravity,
    });
    if (this.player) {
      applyPlayerFeelLimits(this.player, feel);
      if (grants.hasGravity) this.player.body?.setAllowGravity(true);
      else this.player.body?.setAllowGravity(false);
    }
    this.hintText?.setText(this.hintLine());
  }

  applyLiveFeel() {
    const feel = getFeel();
    applyPlayerFeelLimits(this.player, feel);
    this.syncGravityFromState();
    this.debugPanel?.refreshFields();
    this.hintText?.setText(this.hintLine());
  }

  syncOverlayHud() {
    this.runHud?.setVisible(!this.debugVisible && !this.mapVisible);
  }

  debugDamage(n) {
    damage(n);
    if (!isDead()) return;
    this.statusText.setText('DOWN');
    this.statusText.setVisible(true);
    this.player.setVelocity(0, 0);
    this.time.delayedCall(700, () => {
      respawn();
      this.statusText.setVisible(false);
    });
  }

  bindPlayerPhysics() {
    this.solidCollider?.destroy();
    this.pickupOverlap?.destroy();
    this.solidCollider = this.physics.add.collider(this.player, this.solids);
    this.pickupOverlap = this.physics.add.overlap(this.player, this.pickupGroup, this.onPickup, null, this);
  }

  destroyRoomBackgrounds() {
    for (const obj of this.roomLayer || []) {
      obj?.destroy?.();
    }
    this.roomLayer = [];
  }

  rebuildWorldFromDesign() {
    if (!this.solids || !this.player) return;
    const rooms = this.rooms();
    const world = getWorldBounds(rooms);
    this.physics.world.setBounds(world.x, world.y, world.w, world.h);
    this.destroyRoomBackgrounds();
    this.drawRoomBackgrounds();
    this.solids.clear(true, true);
    buildWorldSolids(this, this.solids, rooms, getGates());
    if (this.pickupGroup) {
      for (const child of [...this.pickupGroup.getChildren()]) {
        this.tweens.killTweensOf(child);
      }
      this.pickupGroup.clear(true, true);
      this.pickupGroup.destroy(true);
    }
    this.pickupGroup = this.physics.add.group();
    this.spawnPickups();
    this.bindPlayerPhysics();
    const mapWasOn = this.mapVisible;
    if (this.mapRoot) {
      this.mapRoot.destroy(true);
      this.mapRoot = null;
      this.mapRoomGfx = {};
    }
    this.buildMapOverlay();
    this.mapRoot.setVisible(mapWasOn);
    const here = findRoomAt(this.player.x, this.player.y, rooms) || findRoomById(this.currentRoomId, rooms);
    if (this.debugPanel?.editorActive) {
      if (here) {
        this.currentRoomId = here.id;
        this.markVisited(here);
      }
    } else if (here) this.snapCameraToRoom(here, true);
    else if (rooms[0]) this.snapCameraToRoom(rooms[0], true);
    this.debugPanel?.levelEditor?.drawOverlay?.();
  }

  onEditorModeChange(active) {
    if (active) {
      if (this.physics.world.isPaused) this.physics.world.resume();
      return;
    }
    if (this.debugVisible && !this.physics.world.isPaused) {
      this.player.setVelocity(0, 0);
      this.physics.world.pause();
    }
    const room = findRoomAt(this.player.x, this.player.y, this.rooms()) || findRoomById(this.currentRoomId, this.rooms());
    if (room) this.snapCameraToRoom(room, true);
  }

  drawRoomBackgrounds() {
    if (!this.roomLayer) this.roomLayer = [];
    const colors = {
      R0: 0x16213e,
      R1: 0x1a2744,
      R2: 0x1f2f4d,
      R3: 0x142038,
      R4: 0x14302a,
      R5: 0x2a2414,
      R6: 0x241428,
    };
    const rooms = this.rooms();
    for (const room of rooms) {
      const g = this.add.graphics();
      g.fillStyle(colors[room.id] ?? 0x16213e, 1);
      g.fillRect(room.x, room.y, room.w, room.h);
      const open = corridorOpenEdges(room, rooms);
      const x = room.x + 1;
      const y = room.y + 1;
      const w = room.w - 2;
      const h = room.h - 2;
      g.lineStyle(2, 0x3d5a80, 0.6);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w, y);
      if (!open.right) {
        g.lineTo(x + w, y + h);
      } else {
        g.moveTo(x + w, y + h);
      }
      g.lineTo(x, y + h);
      if (!open.left) {
        g.lineTo(x, y);
      }
      g.strokePath();
      const label = addHudText(this, room.x + px(6), room.y + px(6), room.id, {
        fontSize: UI_FONT_MD,
        color: '#546e7a',
      }).setDepth(1);
      g.setDepth(0);
      this.roomLayer.push(g, label);
    }
    for (const gate of getGates()) {
      if (!gate.world) continue;
      const hole = this.add.graphics();
      hole.fillStyle(0x050508, 1);
      hole.fillRect(gate.world.x, gate.world.y - 1, gate.world.w, gate.world.h + 2);
      hole.setDepth(2);
      this.roomLayer.push(hole);
    }
  }

  buildMapOverlay() {
    this.mapRoot = this.add.container(0, 0).setScrollFactor(0).setDepth(500).setVisible(false);

    const panel = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W - px(24), GAME_H - px(24), 0x0a0a12, 0.92);
    panel.setStrokeStyle(2, 0x90caf9, 1);
    this.mapRoot.add(panel);

    const title = addHudText(this, GAME_W / 2, px(18), 'MAP  (M)', {
      fontSize: UI_FONT_LG,
      color: '#e3f2fd',
    }).setOrigin(0.5, 0);
    this.mapRoot.add(title);

    const rooms = this.rooms();
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
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const boxW = GAME_W - px(48);
    const boxH = GAME_H - px(56);
    const scale = Math.min(boxW / worldW, boxH / worldH);
    const ox = GAME_W / 2 - (worldW * scale) / 2;
    const oy = px(34);

    this.mapRoomGfx = {};
    for (const r of rooms) {
      const rx = ox + (r.x - minX) * scale;
      const ry = oy + (r.y - minY) * scale;
      const rw = Math.max(px(8), r.w * scale - 2);
      const rh = Math.max(px(8), r.h * scale - 2);
      const rect = this.add.rectangle(rx + rw / 2, ry + rh / 2, rw, rh, 0x263238, 1);
      rect.setStrokeStyle(2, 0x546e7a, 1);
      this.mapRoot.add(rect);
      const label = addHudText(this, rx + rw / 2, ry + px(3), r.id, {
        fontSize: UI_FONT_MD,
        color: '#90a4ae',
      }).setOrigin(0.5, 0);
      this.mapRoot.add(label);
      const role = addHudText(this, rx + rw / 2, ry + px(14), '', {
        fontSize: UI_FONT_SM,
        color: '#90a4ae',
      }).setOrigin(0.5, 0).setVisible(false);
      this.mapRoot.add(role);

      const marks = [];
      const contents = describeMapContents(rooms, {
        visitedIds: new Set([r.id]),
        pickups: getPickups(),
        gates: getGates(),
      })[r.id];
      for (const p of contents.pickups) {
        const mx = ox + (p.x - minX) * scale;
        const my = oy + (p.y - minY) * scale;
        const dot = this.add.circle(mx, my, px(2.5), p.color, 1);
        dot.setStrokeStyle(1, 0xfffde7, 0.9);
        this.mapRoot.add(dot);
        const tag = addHudText(this, mx + px(5), my - px(4), p.tag, {
          fontSize: UI_FONT_SM,
          color: '#fff9c4',
        }).setOrigin(0, 0);
        this.mapRoot.add(tag);
        marks.push(dot, tag);
      }
      for (const gate of contents.gates) {
        const gx = ox + (gate.x - minX) * scale;
        const gy = oy + (gate.y - minY) * scale;
          let notchX = gx;
        let notchY = gy;
        let destX = gx;
        let destY = gy;
        if (gate.edge === 'bottom') {
          notchY += -px(2);
          destY += -px(8);
        } else if (gate.edge === 'left') {
          notchX += px(2);
          destX += px(10);
        } else if (gate.edge === 'right') {
          notchX += -px(2);
          destX += -px(10);
        } else {
          notchY += px(2);
          destY += px(8);
        }
        const notch = this.add.rectangle(notchX, notchY, px(10), px(4), 0xffe082, 1);
        this.mapRoot.add(notch);
        const dest = addHudText(this, destX, destY, gate.dest, {
          fontSize: UI_FONT_SM,
          color: '#ffe082',
        }).setOrigin(0.5, 0.5);
        this.mapRoot.add(dest);
        marks.push(notch, dest);
      }
      for (const mark of marks) mark.setVisible(false);

      this.mapRoomGfx[r.id] = { rect, label, role, marks };
    }

    this.mapPlayerDot = this.add.circle(0, 0, px(2.5), 0x4fc3f7, 1);
    this.mapRoot.add(this.mapPlayerDot);
    this.mapLayout = { ox, oy, minX, minY, scale };

    const legend = addHudText(
      this,
      GAME_W / 2,
      GAME_H - px(18),
      'dark=unseen  G/W/J/F=orbs  gold=gate  visited shows contents',
      {
        fontSize: UI_FONT_SM,
        color: '#78909c',
      }
    ).setOrigin(0.5, 1);
    this.mapRoot.add(legend);
  }

  markVisited(room) {
    if (room) markRoomVisited(room.id);
  }

  closeMap() {
    if (!this.mapVisible) return;
    this.mapVisible = false;
    this.mapRoot.setVisible(false);
    this.syncOverlayHud();
  }

  closeDebug() {
    if (!this.debugVisible) return;
    this.debugVisible = false;
    this.debugPanel.setVisible(false);
    if (this.physics.world.isPaused) this.physics.world.resume();
    this.syncOverlayHud();
  }

  toggleMap() {
    if (!this.mapVisible) this.closeDebug();
    this.mapVisible = !this.mapVisible;
    this.mapRoot.setVisible(this.mapVisible);
    if (this.mapVisible) {
      this.refreshMapOverlay();
      this.player.setVelocity(0, 0);
    }
    this.syncOverlayHud();
  }

  toggleDebug() {
    if (!this.debugVisible) this.closeMap();
    this.debugVisible = !this.debugVisible;
    this.debugPanel.setVisible(this.debugVisible);
    if (this.debugVisible) {
      this.player.setVelocity(0, 0);
      if (!this.debugPanel.editorActive) this.physics.world.pause();
      this.debugPanel.refreshFields();
      this.debugPanel.refreshCheat?.();
    } else if (this.physics.world.isPaused) {
      this.physics.world.resume();
    }
    this.syncOverlayHud();
  }

  debugToggleAbility(id) {
    const had = hasAbility(id);
    toggleAbility(id);
    if (!had && hasAbility(id)) {
      advancePhaseOnAbility(id);
      if (id === ABILITY.GRAVITY_FALL || id === 'gravityFall') {
        snapGravityDownToDefault();
        this.flashGravityDown(getGravityDown());
      }
    }
    this.syncGravityFromState();
    return { id, has: hasAbility(id), ...getRunState() };
  }

  debugWarpRoom(id) {
    const room = findRoomById(id, this.rooms());
    if (!room) return null;
    const SAFE = {
      R0: { x: 200, y: 300 },
      R1: { x: 960, y: 300 },
      R2: { x: 1400, y: 300 },
      R3: { x: 960, y: 650 },
      R4: { x: 1400, y: -80 },
      R5: { x: 2080, y: 300 },
      R6: { x: 2700, y: 300 },
    };
    const pos = SAFE[room.id] || { x: room.x + room.w * 0.35, y: room.y + room.h - 60 };
    this.player.setPosition(pos.x, pos.y);
    this.player.setVelocity(0, 0);
    if (this.debugPanel?.editorActive) {
      this.currentRoomId = room.id;
      this.markVisited(room);
      this.debugPanel.levelEditor?.view?.fitRect?.(room);
    } else {
      this.snapCameraToRoom(room, true);
    }
    return { room: room.id, x: pos.x, y: pos.y };
  }

  refreshMapOverlay() {
    if (!this.mapVisible) return;
    const { ox, oy, minX, minY, scale } = this.mapLayout;
    for (const r of this.rooms()) {
      const gfx = this.mapRoomGfx[r.id];
      if (!gfx) continue;
      const visited = hasVisitedRoom(r.id);
      const current = r.id === this.currentRoomId;
      let fill = 0x212121;
      if (visited) fill = 0x1a237e;
      if (current) fill = 0x1565c0;
      gfx.rect.setFillStyle(fill, 1);
      gfx.rect.setStrokeStyle(2, current ? 0xffe082 : visited ? 0x90caf9 : 0x424242, 1);
      gfx.label.setColor(visited || current ? '#e3f2fd' : '#616161');
      const show = visited || current;
      const roleHint = show ? describeMapContents([r], {
        visitedIds: new Set([r.id]),
        pickups: [],
        gates: [],
      })[r.id].role : null;
      gfx.role?.setText(roleHint ? roleHint : '');
      gfx.role?.setColor(current ? '#ffe082' : '#90a4ae');
      gfx.role?.setVisible(Boolean(show && roleHint));
      for (const mark of gfx.marks || []) mark.setVisible(show);
    }
    this.mapPlayerDot.setPosition(
      ox + (this.player.x - minX) * scale,
      oy + (this.player.y - minY) * scale
    );
  }

  spawnPickups() {
    for (const spec of getPickups()) {
      if (spec.ability && hasAbility(spec.ability)) continue;
      const sprite = this.createPickup(spec);
      this.pickupGroup.add(sprite);
    }
  }

  createPickup(spec) {
    const preset = PICKUP_COLORS[spec.id] || { fill: 0xffeb3b, stroke: 0xfff59d };
    const colors = {
      fill: parseHexColor(spec.color, preset.fill),
      stroke: preset.stroke,
    };
    const key = `pickup_${spec.id}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const r = px(8);
      g.fillStyle(colors.fill, 1);
      g.fillCircle(r, r, r);
      g.lineStyle(2, colors.stroke, 1);
      g.strokeCircle(r, r, r);
      g.generateTexture(key, r * 2, r * 2);
      g.destroy();
    }
    const p = this.physics.add.sprite(spec.x, spec.y, key);
    p.body.setAllowGravity(false);
    p.body.setImmovable(true);
    p.setDepth(8);
    tagFixed(p);
    p.setData('pickup', spec);
    this.tweens.add({
      targets: p,
      y: spec.y - px(4),
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return p;
  }

  onPickup(_player, pickup) {
    if (!pickup.active) return;
    const spec = pickup.getData('pickup');
    if (!spec) {
      pickup.destroy();
      return;
    }
    const needs = spec.requires || [];
    if (needs.some((id) => !hasAbility(id))) return;
    pickup.destroy();

    const ability = spec.onCollect?.unlockAbility || spec.ability;
    if (ability) {
      unlockAbility(ability);
      if (ability === ABILITY.GRAVITY_FALL) {
        snapGravityDownToDefault();
        this.flashGravityDown(getGravityDown());
      }
    }
    const items = spec.onCollect?.addItem;
    if (items) {
      for (const [id, count] of Object.entries(items)) addItem(id, count);
    }
    if (spec.onCollect?.advancePhase) setPhase(spec.onCollect.advancePhase);
    else if (ability) advancePhaseOnAbility(ability);

    this.syncGravityFromState();

    const banner = spec.onCollect?.statusBanner || (ability ? String(ability).toUpperCase() : 'GOT');
    this.statusText.setText(banner);
    this.statusText.setVisible(true);
    this.time.delayedCall(2000, () => this.statusText.setVisible(false));
    this.hintText.setText(this.hintLine());
  }

  snapCameraToRoom(room, instant = false) {
    if (!room) return;
    this.currentRoomId = room.id;
    this.markVisited(room);
    const cam = this.cameras.main;
    // Vector-only gravity: never rotate the camera.
    cam.setRotation(0);
    cam.setZoom(1);
    cam.setBounds(room.x, room.y, room.w, room.h);
    if (instant) cam.setScroll(room.x, room.y);
    else cam.pan(room.x + room.w / 2, room.y + room.h / 2, 180, 'Linear', true);
  }

  tryJump(now, feel, down) {
    const grants = getAbilityGrants();
    if (!grants.canJump) return false;
    const grounded = now <= this.coyoteUntil;
    const wallSign =
      grants.canWallJump && !grounded ? wallJumpWalkSign(this.player.body, down) : 0;
    if (!grounded && wallSign === 0) return false;
    const parts = splitVelocity(this.player.body.velocity.x, this.player.body.velocity.y, down);
    const walk = wallSign !== 0 ? wallSign * feel.moveSpeed : parts.walk;
    const next = composeVelocity(down, walk, feel.jumpVelocity);
    this.player.setVelocity(next.x, next.y);
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.jumpHeld = true;
    return true;
  }

  handleGravityInput(supported) {
    if (this.debugVisible) return;
    if (!canChangeGravityDirection(supported)) {
      Phaser.Input.Keyboard.JustDown(this.keys.q);
      Phaser.Input.Keyboard.JustDown(this.keys.e);
      Phaser.Input.Keyboard.JustDown(this.keys.i);
      Phaser.Input.Keyboard.JustDown(this.keys.j);
      Phaser.Input.Keyboard.JustDown(this.keys.k);
      Phaser.Input.Keyboard.JustDown(this.keys.l);
      return;
    }

    const down = getGravityDown();
    const grants = getAbilityGrants();
    const field = grants.gravityDirections === 'arbitrary';
    const shift = Boolean(this.keys.shift?.isDown);
    const step = field ? (shift ? FIELD_ROTATE_FINE_DEG : FIELD_ROTATE_DEG) : 90;
    let next = null;
    if (Phaser.Input.Keyboard.JustDown(this.keys.q)) next = rotateDown(down, -1, step);
    else if (Phaser.Input.Keyboard.JustDown(this.keys.e)) next = rotateDown(down, 1, step);
    else if (Phaser.Input.Keyboard.JustDown(this.keys.i)) next = 'up';
    else if (Phaser.Input.Keyboard.JustDown(this.keys.k)) next = 'down';
    else if (Phaser.Input.Keyboard.JustDown(this.keys.j)) next = 'left';
    else if (Phaser.Input.Keyboard.JustDown(this.keys.l)) next = 'right';

    if (field && grants.adjustableMagnitude) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.bracketLeft)) {
        applyFeel({ gravityY: getFeel().gravityY - FIELD_MAG_STEP });
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.bracketRight)) {
        applyFeel({ gravityY: getFeel().gravityY + FIELD_MAG_STEP });
      }
    }

    if (!next) return;
    const result = trySetGravityDown(next, supported);
    if (result.changed) {
      this.syncGravityFromState();
      this.flashGravityDown(result.down);
    }
  }

  flashGravityDown(axis) {
    this.gravityFlash?.show(axis);
  }

  describeVisibleMapContents() {
    return describeMapContents(this.rooms(), {
      visitedIds: this.rooms().map((r) => r.id).filter((id) => hasVisitedRoom(id)),
      pickups: getPickups(),
      gates: getGates(),
    });
  }

  solidsNear(x, pad = 8) {
    const listed = listWorldSolidRects(this.rooms(), getGates()).filter(
      (r) => r.x <= x + pad && r.x + r.w >= x - pad
    );
    return listed.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h, tag: r.tag }));
  }

  update(time) {
    const body = this.player.body;
    const down = getGravityDown();
    const grants = getAbilityGrants();
    const grounded = isSupportedOnDown(body, down);
    const now = time;
    const feel = getFeel();

    const consumeJumpEdges = (includeUp = true) => {
      // Do not consume Up while the debugger uses it to select fields.
      if (includeUp) Phaser.Input.Keyboard.JustDown(this.cursors.up);
      Phaser.Input.Keyboard.JustDown(this.keys.w);
      Phaser.Input.Keyboard.JustDown(this.keys.space);
    };

    if (this.debugVisible) {
      this.debugPanel.update(time);
      this.debugPanel.levelEditor?.update?.(time);
      this.debugPanel.refreshStatus({
        room: this.currentRoomId,
        gravityOn: this.gravityOn(),
        gravityDown: down,
        grounded,
        coyote: Math.max(0, Math.ceil(this.coyoteUntil - now)),
        x: this.player.x,
        y: this.player.y,
        hp: getHp(),
        maxHp: getMaxHp(),
        phase: getPhase(),
        deaths: getRunState().deaths,
      });
      if (!this.debugPanel.editorActive) {
        consumeJumpEdges(false);
        return;
      }
      if (isTypingInEditorField()) {
        consumeJumpEdges();
        this.player.setVelocity(0, 0);
        return;
      }
      // Level edit: keep walking / jump so new geometry can be playtested.
      // Space is reserved for pan — do not treat it as jump.
      Phaser.Input.Keyboard.JustDown(this.keys.space);
      Phaser.Input.Keyboard.JustUp(this.keys.space);
    }

    if (this.mapVisible) {
      consumeJumpEdges();
      this.refreshMapOverlay();
      this.player.setVelocity(0, 0);
      return;
    }

    if (grounded) this.coyoteUntil = now + feel.coyoteMs;
    this.handleGravityInput(grounded);

    const editing = Boolean(this.debugPanel?.editorActive);
    const left = this.cursors.left.isDown || this.keys.a.isDown;
    const right = this.cursors.right.isDown || this.keys.d.isDown;
    const jumpDown =
      this.cursors.up.isDown || this.keys.w.isDown || (!editing && this.keys.space.isDown);
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.w) ||
      (!editing && Phaser.Input.Keyboard.JustDown(this.keys.space));
    const jumpReleased =
      Phaser.Input.Keyboard.JustUp(this.cursors.up) ||
      Phaser.Input.Keyboard.JustUp(this.keys.w) ||
      (!editing && Phaser.Input.Keyboard.JustUp(this.keys.space));

    if (grants.hasGravity) {
      const parts = splitVelocity(body.velocity.x, body.velocity.y, down);
      let walk = parts.walk;
      let along = parts.alongGravity;

      if (grants.canWalk) {
        const speed = grounded ? feel.moveSpeed : feel.moveSpeed * feel.airControl;
        if (left && !right) walk = -speed;
        else if (right && !left) walk = speed;
        else if (grants.hasFriction && grounded) walk = 0;
      } else {
        // I: falling body — no walk / jump / wall-slide.
        walk = grounded ? 0 : walk;
      }

      if (grants.canWallSlide && !grounded && isTouchingWall(body, down)) {
        const slideMax = feel.maxFallSpeed * WALL_SLIDE_FALL_FACTOR;
        if (along > slideMax) along = slideMax;
      }

      const next = composeVelocity(down, walk, along);
      this.player.setVelocity(next.x, next.y);

      if (grants.canJump) {
        if (jumpPressed) this.jumpBufferUntil = now + feel.jumpBufferMs;
        if (now <= this.jumpBufferUntil) this.tryJump(now, feel, down);

        if (jumpReleased && this.jumpHeld && along < 0) {
          const cut = composeVelocity(down, walk, along * feel.jumpCutMultiplier);
          this.player.setVelocity(cut.x, cut.y);
          this.jumpHeld = false;
        }
        if (!jumpDown) this.jumpHeld = false;
      } else {
        consumeJumpEdges();
      }
    } else {
      let vx = 0;
      if (left) vx = -feel.floatNudge;
      else if (right) vx = feel.floatNudge;
      this.player.setVelocityX(vx);
      const baseY = this._floatBaseY ?? (this._floatBaseY = this.player.y);
      const bob = Math.sin(this.time.now / 400) * px(3);
      this.player.setVelocityY((baseY + bob - this.player.y) * 4);
    }

    const room = findRoomAt(this.player.x, this.player.y, this.rooms());
    if (room && room.id !== this.currentRoomId) {
      if (this.debugPanel?.editorActive) {
        this.currentRoomId = room.id;
        this.markVisited(room);
      } else {
        this.snapCameraToRoom(room, true);
      }
    }
  }
}
