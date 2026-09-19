import Phaser from '../phaser-shim.js';
import { ROOMS, GAME_W, GAME_H, getWorldBounds, findRoomAt } from '../rooms.js';
import {
  createPlayer,
  MOVE_SPEED,
  AIR_CONTROL,
  JUMP_VELOCITY,
  JUMP_CUT_MULTIPLIER,
  GRAVITY_Y,
  COYOTE_MS,
  JUMP_BUFFER_MS,
} from '../player.js';

/**
 * First-room Metroidvania prototype:
 * float → gravity pickup → walk/jump → room-snap camera → M map.
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

    this.player = createPlayer(this, 100, 72);
    this.pickup = this.createPickup(128, 68);

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.overlap(this.player, this.pickup, this.onPickup, null, this);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      m: Phaser.Input.Keyboard.KeyCodes.M,
      f1: Phaser.Input.Keyboard.KeyCodes.F1,
      backtick: Phaser.Input.Keyboard.KeyCodes.BACKTICK,
    });

    this.statusText = this.add
      .text(GAME_W / 2, 28, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffe082',
        resolution: 1,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.debugText = this.add
      .text(4, 4, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#b2ff59',
        backgroundColor: '#000000aa',
        padding: { x: 3, y: 2 },
        resolution: 1,
      })
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    this.hintText = this.add
      .text(GAME_W / 2, GAME_H - 12, 'NUDGE TO YELLOW: GRAVITY  |  M MAP', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#90a4ae',
        resolution: 1,
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(100);

    this.buildMapOverlay();

    const startRoom = findRoomAt(this.player.x, this.player.y) || ROOMS[0];
    this.markVisited(startRoom);
    this.snapCameraToRoom(startRoom, true);

    this.input.keyboard.on('keydown-F1', () => this.toggleDebug());
    this.input.keyboard.on('keydown-BACKTICK', () => this.toggleDebug());
    this.input.keyboard.on('keydown-M', () => this.toggleMap());
  }

  drawRoomBackgrounds() {
    const colors = [0x16213e, 0x1a2744, 0x1f2f4d, 0x142038];
    ROOMS.forEach((room, i) => {
      const g = this.add.graphics();
      g.fillStyle(colors[i % colors.length], 1);
      g.fillRect(room.x, room.y, room.w, room.h);
      g.lineStyle(1, 0x3d5a80, 0.6);
      g.strokeRect(room.x + 0.5, room.y + 0.5, room.w - 1, room.h - 1);
      this.add
        .text(room.x + 6, room.y + 6, room.id, {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#546e7a',
          resolution: 1,
        })
        .setDepth(1);
      g.setDepth(0);
    });
  }

  buildMapOverlay() {
    this.mapRoot = this.add.container(0, 0).setScrollFactor(0).setDepth(500).setVisible(false);

    const panel = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 24, 0x0a0a12, 0.92);
    panel.setStrokeStyle(1, 0x90caf9, 1);
    this.mapRoot.add(panel);

    const title = this.add
      .text(GAME_W / 2, 18, 'MAP  (M)', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#e3f2fd',
        resolution: 1,
      })
      .setOrigin(0.5, 0);
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
    const boxW = GAME_W - 48;
    const boxH = GAME_H - 56;
    const scale = Math.min(boxW / worldW, boxH / worldH);
    const ox = GAME_W / 2 - (worldW * scale) / 2;
    const oy = 34;

    this.mapRoomGfx = {};
    for (const r of ROOMS) {
      const rx = ox + (r.x - minX) * scale;
      const ry = oy + (r.y - minY) * scale;
      const rw = Math.max(8, r.w * scale - 2);
      const rh = Math.max(8, r.h * scale - 2);
      const rect = this.add.rectangle(rx + rw / 2, ry + rh / 2, rw, rh, 0x263238, 1);
      rect.setStrokeStyle(1, 0x546e7a, 1);
      this.mapRoot.add(rect);
      const label = this.add
        .text(rx + rw / 2, ry + rh / 2, r.id, {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#90a4ae',
          resolution: 1,
        })
        .setOrigin(0.5);
      this.mapRoot.add(label);
      this.mapRoomGfx[r.id] = { rect, label };
    }

    this.mapPlayerDot = this.add.circle(0, 0, 2.5, 0x4fc3f7, 1);
    this.mapRoot.add(this.mapPlayerDot);
    this.mapLayout = { ox, oy, minX, minY, scale };

    const legend = this.add
      .text(GAME_W / 2, GAME_H - 18, 'dark=unseen  blue=visited  bright=here  dot=you', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#78909c',
        resolution: 1,
      })
      .setOrigin(0.5, 1);
    this.mapRoot.add(legend);
  }

  markVisited(room) {
    if (room) this.visitedRooms.add(room.id);
  }

  toggleMap() {
    this.mapVisible = !this.mapVisible;
    this.mapRoot.setVisible(this.mapVisible);
    if (this.mapVisible) {
      this.refreshMapOverlay();
      this.player.setVelocity(0, 0);
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
      gfx.rect.setStrokeStyle(1, current ? 0xffe082 : visited ? 0x90caf9 : 0x424242, 1);
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
        g.lineStyle(1, 0x8d6e63, 1);
        g.strokeRect(0, 0, w, h);
        g.generateTexture(key, w, h);
        g.destroy();
      }
      const s = this.solids.create(x + w / 2, y + h / 2, key);
      s.refreshBody();
      s.setDepth(5);
      return s;
    };

    const floorH = 16;
    const wallW = 8;
    const platH = 8;

    const r0 = ROOMS[0];
    addRect(r0.x, r0.y + r0.h - floorH, r0.w, floorH, 0x4e342e);
    addRect(r0.x, r0.y, wallW, r0.h, 0x3e2723);
    addRect(r0.x, r0.y, r0.w, wallW, 0x3e2723);
    addRect(r0.x + 100, r0.y + 100, 48, platH, 0x6d4c41);
    addRect(r0.x + 200, r0.y + r0.h - floorH - 24, 24, 24, 0x795548);

    const r1 = ROOMS[1];
    addRect(r1.x, r1.y + r1.h - floorH, 80, floorH, 0x4e342e);
    addRect(r1.x + 120, r1.y + r1.h - floorH, 80, floorH, 0x4e342e);
    addRect(r1.x + 240, r1.y + r1.h - floorH, 80, floorH, 0x4e342e);
    addRect(r1.x, r1.y, r1.w, wallW, 0x3e2723);
    addRect(r1.x + 40, r1.y + 90, 40, platH, 0x6d4c41);
    addRect(r1.x + 180, r1.y + 70, 56, platH, 0x6d4c41);

    const r2 = ROOMS[2];
    addRect(r2.x, r2.y + r2.h - floorH, r2.w, floorH, 0x4e342e);
    addRect(r2.x + r2.w - wallW, r2.y, wallW, r2.h, 0x3e2723);
    addRect(r2.x, r2.y, r2.w, wallW, 0x3e2723);
    addRect(r2.x + 60, r2.y + 110, 40, platH, 0x6d4c41);
    addRect(r2.x + 160, r2.y + 80, 40, platH, 0x6d4c41);
    addRect(r2.x + 240, r2.y + r2.h - floorH - 32, 32, 32, 0x795548);

    const r3 = ROOMS[3];
    addRect(r3.x, r3.y + r3.h - floorH, r3.w, floorH, 0x4e342e);
    addRect(r3.x, r3.y, wallW, r3.h, 0x3e2723);
    addRect(r3.x + r3.w - wallW, r3.y, wallW, r3.h, 0x3e2723);
    addRect(r3.x + 80, r3.y + 80, 48, platH, 0x6d4c41);
    addRect(r3.x + 180, r3.y + 100, 48, platH, 0x6d4c41);
    addRect(r3.x, r3.y, 100, wallW, 0x3e2723);
    addRect(r3.x + 220, r3.y, 100, wallW, 0x3e2723);
  }

  createPickup(x, y) {
    const key = 'pickup';
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffeb3b, 1);
      g.fillCircle(8, 8, 8);
      g.lineStyle(1, 0xfff59d, 1);
      g.strokeCircle(8, 8, 8);
      g.generateTexture(key, 16, 16);
      g.destroy();
    }
    const p = this.physics.add.sprite(x, y, key);
    p.body.setAllowGravity(false);
    p.body.setImmovable(true);
    p.setDepth(8);
    this.tweens.add({
      targets: p,
      y: y - 4,
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
    this.physics.world.gravity.y = GRAVITY_Y;
    this.player.body.setAllowGravity(true);

    this.statusText.setText('GRAVITY ON');
    this.statusText.setVisible(true);
    this.time.delayedCall(2000, () => this.statusText.setVisible(false));
    this.hintText.setText('A/D MOVE  W/SPACE JUMP  M MAP  F1 DEBUG');
  }

  toggleDebug() {
    this.debugVisible = !this.debugVisible;
    this.debugText.setVisible(this.debugVisible);
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

  tryJump(now) {
    if (now > this.coyoteUntil) return false;
    this.player.setVelocityY(JUMP_VELOCITY);
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.jumpHeld = true;
    return true;
  }

  update(time) {
    if (this.mapVisible) {
      this.refreshMapOverlay();
      this.player.setVelocityX(0);
      return;
    }

    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    const now = time;

    if (grounded) this.coyoteUntil = now + COYOTE_MS;

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
      const speed = grounded ? MOVE_SPEED : MOVE_SPEED * AIR_CONTROL;
      let vx = 0;
      if (left) vx = -speed;
      else if (right) vx = speed;
      this.player.setVelocityX(vx);

      if (jumpPressed) this.jumpBufferUntil = now + JUMP_BUFFER_MS;
      if (now <= this.jumpBufferUntil) this.tryJump(now);

      if (jumpReleased && this.jumpHeld && body.velocity.y < 0) {
        this.player.setVelocityY(body.velocity.y * JUMP_CUT_MULTIPLIER);
        this.jumpHeld = false;
      }
      if (!jumpDown) this.jumpHeld = false;
    } else {
      let vx = 0;
      if (left) vx = -28;
      else if (right) vx = 28;
      this.player.setVelocityX(vx);
      const baseY = this._floatBaseY ?? (this._floatBaseY = this.player.y);
      const bob = Math.sin(this.time.now / 400) * 3;
      this.player.setVelocityY((baseY + bob - this.player.y) * 4);
    }

    const room = findRoomAt(this.player.x, this.player.y);
    if (room && room.id !== this.currentRoomId) {
      this.snapCameraToRoom(room, true);
    }

    if (this.debugVisible) {
      this.debugText.setText(
        [
          `room: ${this.currentRoomId ?? '?'}`,
          `gravity: ${this.gravityOn ? 'ON' : 'OFF'}`,
          `grounded: ${grounded}`,
          `coyote: ${Math.max(0, Math.ceil(this.coyoteUntil - now))}`,
          `pos: ${Math.round(this.player.x)},${Math.round(this.player.y)}`,
        ].join('\n')
      );
    }
  }
}
