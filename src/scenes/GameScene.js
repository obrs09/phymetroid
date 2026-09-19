import Phaser from 'phaser';
import { ROOMS, GAME_W, GAME_H, getWorldBounds, findRoomAt, UI_FONT_LG, UI_FONT_MD, UI_FONT_SM, px } from '../rooms.js';
import { applyPlayerFeelLimits, createPlayer } from '../player.js';
import { getFeel, subscribeDesign } from '../designConfig.js';
import { FeelDebugPanel } from '../feelDebugPanel.js';
import { addHudText, refreshHudTextResolution } from '../hudText.js';

/**
 * First-room Metroidvania prototype:
 * float → gravity pickup → walk/jump → room-snap camera → M map → F1 feel debug.
 *
 * Future tilemap stub: replace buildSolids() with Phaser Tilemap / Tiled JSON.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.gravityOn = false;
    this.currentRoomId = null;
    this.debugVisible = false;
    this.mapVisible = false;
    this.visitedRooms = new Set();
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.jumpHeld = false;
  }

  create() {
    const world = getWorldBounds();
    this.physics.world.setBounds(world.x, world.y, world.w, world.h);
    this.physics.world.gravity.y = 0;

    this.drawRoomBackgrounds();
    this.solids = this.physics.add.staticGroup();
    this.buildSolids();

    this.player = createPlayer(this, px(100), px(72));
    this.pickup = this.createPickup(px(128), px(68));

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.overlap(this.player, this.pickup, this.onPickup, null, this);

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
      'NUDGE TO YELLOW: GRAVITY  |  M MAP  |  F1 FEEL',
      {
        fontSize: UI_FONT_MD,
        color: '#90a4ae',
      }
    )
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(100);

    this.buildMapOverlay();
    // Cursors must exist before the panel reuses them for ↑↓←→.
    this.debugPanel = new FeelDebugPanel(this);
    this._unsubDesign = subscribeDesign(() => this.applyLiveFeel());
    this.applyLiveFeel();

    const startRoom = findRoomAt(this.player.x, this.player.y) || ROOMS[0];
    this.markVisited(startRoom);
    this.snapCameraToRoom(startRoom, true);

    this.input.keyboard.on('keydown-F1', (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      this.toggleDebug();
    });
    this.input.keyboard.on('keydown-BACKTICK', () => this.toggleDebug());
    this.input.keyboard.on('keydown-M', () => this.toggleMap());

    refreshHudTextResolution(this.scale.zoom);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._unsubDesign?.();
    });
  }

  applyLiveFeel() {
    const feel = getFeel();
    applyPlayerFeelLimits(this.player, feel);
    if (this.gravityOn) {
      this.physics.world.gravity.y = feel.gravityY;
    }
    this.debugPanel?.refreshFields();
  }

  drawRoomBackgrounds() {
    const colors = [0x16213e, 0x1a2744, 0x1f2f4d, 0x142038];
    ROOMS.forEach((room, i) => {
      const g = this.add.graphics();
      g.fillStyle(colors[i % colors.length], 1);
      g.fillRect(room.x, room.y, room.w, room.h);
      g.lineStyle(2, 0x3d5a80, 0.6);
      g.strokeRect(room.x + 1, room.y + 1, room.w - 2, room.h - 2);
      addHudText(this, room.x + px(6), room.y + px(6), room.id, {
        fontSize: UI_FONT_MD,
        color: '#546e7a',
      }).setDepth(1);
      g.setDepth(0);
    });
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

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of ROOMS) {
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
    for (const r of ROOMS) {
      const rx = ox + (r.x - minX) * scale;
      const ry = oy + (r.y - minY) * scale;
      const rw = Math.max(px(8), r.w * scale - 2);
      const rh = Math.max(px(8), r.h * scale - 2);
      const rect = this.add.rectangle(rx + rw / 2, ry + rh / 2, rw, rh, 0x263238, 1);
      rect.setStrokeStyle(2, 0x546e7a, 1);
      this.mapRoot.add(rect);
      const label = addHudText(this, rx + rw / 2, ry + rh / 2, r.id, {
        fontSize: UI_FONT_MD,
        color: '#90a4ae',
      }).setOrigin(0.5);
      this.mapRoot.add(label);
      this.mapRoomGfx[r.id] = { rect, label };
    }

    this.mapPlayerDot = this.add.circle(0, 0, px(2.5), 0x4fc3f7, 1);
    this.mapRoot.add(this.mapPlayerDot);
    this.mapLayout = { ox, oy, minX, minY, scale };

    const legend = addHudText(
      this,
      GAME_W / 2,
      GAME_H - px(18),
      'dark=unseen  blue=visited  bright=here  dot=you',
      {
        fontSize: UI_FONT_SM,
        color: '#78909c',
      }
    ).setOrigin(0.5, 1);
    this.mapRoot.add(legend);
  }

  markVisited(room) {
    if (room) this.visitedRooms.add(room.id);
  }

  closeMap() {
    if (!this.mapVisible) return;
    this.mapVisible = false;
    this.mapRoot.setVisible(false);
  }

  closeDebug() {
    if (!this.debugVisible) return;
    this.debugVisible = false;
    this.debugPanel.setVisible(false);
    if (this.physics.world.isPaused) this.physics.world.resume();
  }

  toggleMap() {
    if (!this.mapVisible) this.closeDebug();
    this.mapVisible = !this.mapVisible;
    this.mapRoot.setVisible(this.mapVisible);
    if (this.mapVisible) {
      this.refreshMapOverlay();
      this.player.setVelocity(0, 0);
    }
  }

  toggleDebug() {
    if (!this.debugVisible) this.closeMap();
    this.debugVisible = !this.debugVisible;
    this.debugPanel.setVisible(this.debugVisible);
    if (this.debugVisible) {
      this.player.setVelocity(0, 0);
      this.physics.world.pause();
      this.debugPanel.refreshFields();
    } else if (this.physics.world.isPaused) {
      this.physics.world.resume();
    }
  }

  refreshMapOverlay() {
    if (!this.mapVisible) return;
    const { ox, oy, minX, minY, scale } = this.mapLayout;
    for (const r of ROOMS) {
      const gfx = this.mapRoomGfx[r.id];
      const visited = this.visitedRooms.has(r.id);
      const current = r.id === this.currentRoomId;
      let fill = 0x212121;
      if (visited) fill = 0x1a237e;
      if (current) fill = 0x1565c0;
      gfx.rect.setFillStyle(fill, 1);
      gfx.rect.setStrokeStyle(2, current ? 0xffe082 : visited ? 0x90caf9 : 0x424242, 1);
      gfx.label.setColor(visited || current ? '#e3f2fd' : '#616161');
    }
    this.mapPlayerDot.setPosition(
      ox + (this.player.x - minX) * scale,
      oy + (this.player.y - minY) * scale
    );
  }

  /**
   * Build floors, platforms, and walls as static Arcade bodies.
   * Stub for future Tiled tilemap integration.
   */
  buildSolids() {
    const addRect = (x, y, w, h, color = 0x5d4037) => {
      const key = `solid_${x}_${y}_${w}_${h}`;
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(color, 1);
        g.fillRect(0, 0, w, h);
        g.lineStyle(2, 0x8d6e63, 1);
        g.strokeRect(0, 0, w, h);
        g.generateTexture(key, w, h);
        g.destroy();
      }
      const s = this.solids.create(x + w / 2, y + h / 2, key);
      s.refreshBody();
      s.setDepth(5);
      return s;
    };

    const floorH = px(16);
    const wallW = px(8);
    const platH = px(8);

    const r0 = ROOMS[0];
    addRect(r0.x, r0.y + r0.h - floorH, r0.w, floorH, 0x4e342e);
    addRect(r0.x, r0.y, wallW, r0.h, 0x3e2723);
    addRect(r0.x, r0.y, r0.w, wallW, 0x3e2723);
    addRect(r0.x + px(100), r0.y + px(100), px(48), platH, 0x6d4c41);
    addRect(r0.x + px(200), r0.y + r0.h - floorH - px(24), px(24), px(24), 0x795548);

    const r1 = ROOMS[1];
    addRect(r1.x, r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addRect(r1.x + px(120), r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addRect(r1.x + px(240), r1.y + r1.h - floorH, px(80), floorH, 0x4e342e);
    addRect(r1.x, r1.y, r1.w, wallW, 0x3e2723);
    addRect(r1.x + px(40), r1.y + px(90), px(40), platH, 0x6d4c41);
    addRect(r1.x + px(180), r1.y + px(70), px(56), platH, 0x6d4c41);

    const r2 = ROOMS[2];
    addRect(r2.x, r2.y + r2.h - floorH, r2.w, floorH, 0x4e342e);
    addRect(r2.x + r2.w - wallW, r2.y, wallW, r2.h, 0x3e2723);
    addRect(r2.x, r2.y, r2.w, wallW, 0x3e2723);
    addRect(r2.x + px(60), r2.y + px(110), px(40), platH, 0x6d4c41);
    addRect(r2.x + px(160), r2.y + px(80), px(40), platH, 0x6d4c41);
    addRect(r2.x + px(240), r2.y + r2.h - floorH - px(32), px(32), px(32), 0x795548);

    const r3 = ROOMS[3];
    addRect(r3.x, r3.y + r3.h - floorH, r3.w, floorH, 0x4e342e);
    addRect(r3.x, r3.y, wallW, r3.h, 0x3e2723);
    addRect(r3.x + r3.w - wallW, r3.y, wallW, r3.h, 0x3e2723);
    addRect(r3.x + px(80), r3.y + px(80), px(48), platH, 0x6d4c41);
    addRect(r3.x + px(180), r3.y + px(100), px(48), platH, 0x6d4c41);
    addRect(r3.x, r3.y, px(100), wallW, 0x3e2723);
    addRect(r3.x + px(220), r3.y, px(100), wallW, 0x3e2723);
  }

  createPickup(x, y) {
    const key = 'pickup';
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const r = px(8);
      g.fillStyle(0xffeb3b, 1);
      g.fillCircle(r, r, r);
      g.lineStyle(2, 0xfff59d, 1);
      g.strokeCircle(r, r, r);
      g.generateTexture(key, r * 2, r * 2);
      g.destroy();
    }
    const p = this.physics.add.sprite(x, y, key);
    p.body.setAllowGravity(false);
    p.body.setImmovable(true);
    p.setDepth(8);
    this.tweens.add({
      targets: p,
      y: y - px(4),
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return p;
  }

  onPickup(_player, pickup) {
    if (!pickup.active) return;
    pickup.destroy();
    this.gravityOn = true;
    const feel = getFeel();
    this.physics.world.gravity.y = feel.gravityY;
    this.player.body.setAllowGravity(true);
    applyPlayerFeelLimits(this.player, feel);

    this.statusText.setText('GRAVITY ON');
    this.statusText.setVisible(true);
    this.time.delayedCall(2000, () => this.statusText.setVisible(false));
    this.hintText.setText('A/D MOVE  W/SPACE JUMP  M MAP  F1 FEEL');
  }

  snapCameraToRoom(room, instant = false) {
    if (!room) return;
    this.currentRoomId = room.id;
    this.markVisited(room);
    const cam = this.cameras.main;
    cam.setBounds(room.x, room.y, room.w, room.h);
    if (instant) cam.setScroll(room.x, room.y);
    else cam.pan(room.x + room.w / 2, room.y + room.h / 2, 180, 'Linear', true);
  }

  tryJump(now, feel) {
    if (now > this.coyoteUntil) return false;
    this.player.setVelocityY(feel.jumpVelocity);
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.jumpHeld = true;
    return true;
  }

  update(time) {
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
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
      consumeJumpEdges(false);
      this.debugPanel.refreshStatus({
        room: this.currentRoomId,
        gravityOn: this.gravityOn,
        grounded,
        coyote: Math.max(0, Math.ceil(this.coyoteUntil - now)),
        x: this.player.x,
        y: this.player.y,
      });
      return;
    }

    if (this.mapVisible) {
      consumeJumpEdges();
      this.refreshMapOverlay();
      this.player.setVelocityX(0);
      return;
    }

    if (grounded) this.coyoteUntil = now + feel.coyoteMs;

    const left = this.cursors.left.isDown || this.keys.a.isDown;
    const right = this.cursors.right.isDown || this.keys.d.isDown;
    const jumpDown =
      this.cursors.up.isDown || this.keys.w.isDown || this.keys.space.isDown;
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.w) ||
      Phaser.Input.Keyboard.JustDown(this.keys.space);
    const jumpReleased =
      Phaser.Input.Keyboard.JustUp(this.cursors.up) ||
      Phaser.Input.Keyboard.JustUp(this.keys.w) ||
      Phaser.Input.Keyboard.JustUp(this.keys.space);

    if (this.gravityOn) {
      const speed = grounded ? feel.moveSpeed : feel.moveSpeed * feel.airControl;
      let vx = 0;
      if (left) vx = -speed;
      else if (right) vx = speed;
      this.player.setVelocityX(vx);

      if (jumpPressed) this.jumpBufferUntil = now + feel.jumpBufferMs;
      if (now <= this.jumpBufferUntil) this.tryJump(now, feel);

      if (jumpReleased && this.jumpHeld && body.velocity.y < 0) {
        this.player.setVelocityY(body.velocity.y * feel.jumpCutMultiplier);
        this.jumpHeld = false;
      }
      if (!jumpDown) this.jumpHeld = false;
    } else {
      let vx = 0;
      if (left) vx = -feel.floatNudge;
      else if (right) vx = feel.floatNudge;
      this.player.setVelocityX(vx);
      const baseY = this._floatBaseY ?? (this._floatBaseY = this.player.y);
      const bob = Math.sin(this.time.now / 400) * px(3);
      this.player.setVelocityY((baseY + bob - this.player.y) * 4);
    }

    const room = findRoomAt(this.player.x, this.player.y);
    if (room && room.id !== this.currentRoomId) {
      this.snapCameraToRoom(room, true);
    }
  }
}
