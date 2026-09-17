import Phaser from 'phaser';
import { ROOMS, GAME_W, GAME_H, getWorldBounds, findRoomAt } from '../rooms.js';
import {
  createPlayer,
  MOVE_SPEED,
  JUMP_VELOCITY,
  GRAVITY_Y,
  PLAYER_W,
  PLAYER_H,
} from '../player.js';

/**
 * First-room Metroidvania prototype:
 * float → gravity pickup → walk/jump → room-snapping camera.
 *
 * Future tilemap stub: replace buildSolids() Graphics/static bodies
 * with a Phaser Tilemap loaded from Tiled JSON per room or world layer.
 */

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.gravityOn = false;
    this.currentRoomId = null;
    this.debugVisible = false;
  }

  create() {
    const world = getWorldBounds();
    this.physics.world.setBounds(world.x, world.y, world.w, world.h);
    this.physics.world.gravity.y = 0;

    this.drawRoomBackgrounds();
    this.solids = this.physics.add.staticGroup();
    this.buildSolids();

    // Start floating in R0, near the gravity pickup
    this.player = createPlayer(this, 100, 72);

    this.pickup = this.createPickup(128, 68);

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.overlap(
      this.player,
      this.pickup,
      this.onPickup,
      null,
      this
    );

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
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
      .text(GAME_W / 2, GAME_H - 12, 'NUDGE TO YELLOW: GRAVITY', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#90a4ae',
        resolution: 1,
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(100);

    // Initial room camera snap
    const startRoom = findRoomAt(this.player.x, this.player.y) || ROOMS[0];
    this.snapCameraToRoom(startRoom, true);

    this.input.keyboard.on('keydown-F1', () => this.toggleDebug());
    this.input.keyboard.on('keydown-BACKTICK', () => this.toggleDebug());
  }

  drawRoomBackgrounds() {
    const colors = [0x16213e, 0x1a2744, 0x1f2f4d, 0x142038];
    ROOMS.forEach((room, i) => {
      const g = this.add.graphics();
      g.fillStyle(colors[i % colors.length], 1);
      g.fillRect(room.x, room.y, room.w, room.h);
      // Subtle room border
      g.lineStyle(1, 0x3d5a80, 0.6);
      g.strokeRect(room.x + 0.5, room.y + 0.5, room.w - 1, room.h - 1);
      // Room label (world space)
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

    // --- R0: spawn room — floor with gap toward R1, floating platform ---
    const r0 = ROOMS[0];
    addRect(r0.x, r0.y + r0.h - floorH, r0.w, floorH, 0x4e342e); // floor
    addRect(r0.x, r0.y, wallW, r0.h, 0x3e2723); // left wall
    addRect(r0.x, r0.y, r0.w, wallW, 0x3e2723); // ceiling
    // Platform under / near pickup
    addRect(r0.x + 100, r0.y + 100, 48, platH, 0x6d4c41);
    // Step block for jump clearance demo
    addRect(r0.x + 200, r0.y + r0.h - floorH - 24, 24, 24, 0x795548);

    // --- R1: hub — open left/right/down ---
    const r1 = ROOMS[1];
    addRect(r1.x, r1.y + r1.h - floorH, 80, floorH, 0x4e342e);
    addRect(r1.x + 120, r1.y + r1.h - floorH, 80, floorH, 0x4e342e);
    addRect(r1.x + 240, r1.y + r1.h - floorH, 80, floorH, 0x4e342e);
    // Gap in floor center leads to R3 below — leave open between platforms
    addRect(r1.x, r1.y, r1.w, wallW, 0x3e2723); // ceiling
    addRect(r1.x + 40, r1.y + 90, 40, platH, 0x6d4c41);
    addRect(r1.x + 180, r1.y + 70, 56, platH, 0x6d4c41);

    // --- R2: end room right ---
    const r2 = ROOMS[2];
    addRect(r2.x, r2.y + r2.h - floorH, r2.w, floorH, 0x4e342e);
    addRect(r2.x + r2.w - wallW, r2.y, wallW, r2.h, 0x3e2723); // right wall
    addRect(r2.x, r2.y, r2.w, wallW, 0x3e2723); // ceiling
    addRect(r2.x + 60, r2.y + 110, 40, platH, 0x6d4c41);
    addRect(r2.x + 160, r2.y + 80, 40, platH, 0x6d4c41);
    addRect(r2.x + 240, r2.y + r2.h - floorH - 32, 32, 32, 0x795548);

    // --- R3: lower room under R1 ---
    const r3 = ROOMS[3];
    addRect(r3.x, r3.y + r3.h - floorH, r3.w, floorH, 0x4e342e);
    addRect(r3.x, r3.y, wallW, r3.h, 0x3e2723); // left
    addRect(r3.x + r3.w - wallW, r3.y, wallW, r3.h, 0x3e2723); // right
    addRect(r3.x + 80, r3.y + 80, 48, platH, 0x6d4c41);
    addRect(r3.x + 180, r3.y + 100, 48, platH, 0x6d4c41);
    // Partial ceiling so player can drop in from R1 (open center top)
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
    // Gentle idle bob via tween
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

  onPickup(player, pickup) {
    if (!pickup.active) return;
    pickup.destroy();
    this.gravityOn = true;
    this.physics.world.gravity.y = GRAVITY_Y;
    this.player.body.setAllowGravity(true);

    this.statusText.setText('GRAVITY ON');
    this.statusText.setVisible(true);
    this.time.delayedCall(2000, () => {
      this.statusText.setVisible(false);
    });
    this.hintText.setText('A/D MOVE  W/SPACE JUMP  F1 DEBUG');
  }

  toggleDebug() {
    this.debugVisible = !this.debugVisible;
    this.debugText.setVisible(this.debugVisible);
  }

  snapCameraToRoom(room, instant = false) {
    if (!room) return;
    this.currentRoomId = room.id;
    const cam = this.cameras.main;
    cam.setBounds(room.x, room.y, room.w, room.h);
    if (instant) {
      cam.setScroll(room.x, room.y);
    } else {
      // Short pan then snap feel; Metroidvania prefers snap
      cam.pan(room.x + room.w / 2, room.y + room.h / 2, 180, 'Linear', true);
    }
  }

  update() {
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;

    // Full walk/jump only after gravity; before that, gentle air nudge only
    if (this.gravityOn) {
      let vx = 0;
      if (this.cursors.left.isDown || this.keys.a.isDown) vx = -MOVE_SPEED;
      else if (this.cursors.right.isDown || this.keys.d.isDown) vx = MOVE_SPEED;
      this.player.setVelocityX(vx);

      const jumpPressed =
        Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
        Phaser.Input.Keyboard.JustDown(this.keys.w) ||
        Phaser.Input.Keyboard.JustDown(this.keys.space);

      if (jumpPressed && grounded) {
        this.player.setVelocityY(JUMP_VELOCITY);
      }
    } else {
      // Ability gate: no walk/jump — slight nudge so the nearby pickup is reachable
      let vx = 0;
      if (this.cursors.left.isDown || this.keys.a.isDown) vx = -28;
      else if (this.cursors.right.isDown || this.keys.d.isDown) vx = 28;
      this.player.setVelocityX(vx);
      const baseY = this._floatBaseY ?? (this._floatBaseY = this.player.y);
      const bob = Math.sin(this.time.now / 400) * 3;
      this.player.setVelocityY((baseY + bob - this.player.y) * 4);
    }

    // Room camera: snap when player center enters a new room
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
          `pos: ${Math.round(this.player.x)},${Math.round(this.player.y)}`,
        ].join('\n')
      );
    }
  }
}
