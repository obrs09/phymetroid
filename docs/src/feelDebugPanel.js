import Phaser from './phaser-shim.js';
import { GAME_W, GAME_H } from './rooms.js';
import {
  FEEL_FIELDS,
  downloadDesignJson,
  formatFeelValue,
  getFeel,
  nudgeFeel,
  resetDesignToDefaults,
} from './designConfig.js';

const ROW_H = 10;
const FIELD_TOP = 40;

/**
 * Keyboard-first F1 feel debugger. Physics should be paused by the scene
 * while this panel is visible.
 */
export class FeelDebugPanel {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.selectedIndex = 0;
    this.toastUntil = 0;
    this.toastMsg = '';
    this._holdDir = 0;
    this._holdNext = 0;
    this._holdArmed = false;

    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(600).setVisible(false);

    const panel = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W - 8, GAME_H - 8, 0x0a0a12, 0.94);
    panel.setStrokeStyle(1, 0xb2ff59, 1);
    this.root.add(panel);

    this.titleText = scene.add
      .text(8, 6, 'FEEL DEBUG  (F1 / `)', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#b2ff59',
        resolution: 1,
      });
    this.root.add(this.titleText);

    this.statusText = scene.add
      .text(8, 16, '', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#c5e1a5',
        resolution: 1,
      });
    this.root.add(this.statusText);

    this.highlight = scene.add.rectangle(GAME_W / 2, 0, GAME_W - 16, ROW_H, 0x33691e, 0.85);
    this.root.add(this.highlight);

    this.rows = FEEL_FIELDS.map((field, i) => {
      const y = FIELD_TOP + i * ROW_H;
      const label = scene.add
        .text(10, y, '', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#dcedc8',
          resolution: 1,
        })
        .setInteractive({ useHandCursor: true });
      label.on('pointerdown', () => {
        this.selectedIndex = i;
        this.refreshFields();
      });
      this.root.add(label);

      const minus = scene.add
        .text(268, y, '-', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#ffcc80',
          resolution: 1,
        })
        .setInteractive({ useHandCursor: true });
      minus.on('pointerdown', () => this.adjust(-1, this.shiftDown()));
      this.root.add(minus);

      const plus = scene.add
        .text(284, y, '+', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#ffcc80',
          resolution: 1,
        })
        .setInteractive({ useHandCursor: true });
      plus.on('pointerdown', () => this.adjust(1, this.shiftDown()));
      this.root.add(plus);

      return { field, label, minus, plus };
    });

    this.helpText = scene.add
      .text(8, 132, '', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#78909c',
        resolution: 1,
      });
    this.root.add(this.helpText);

    this.toastText = scene.add
      .text(GAME_W / 2, 170, '', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#ffe082',
        resolution: 1,
      })
      .setOrigin(0.5, 1);
    this.root.add(this.toastText);

    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      openBracket: Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET,
      closeBracket: Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET,
      minus: Phaser.Input.Keyboard.KeyCodes.MINUS,
      equals: Phaser.Input.Keyboard.KeyCodes.EQUALS,
      numAdd: Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD,
      numSub: Phaser.Input.Keyboard.KeyCodes.NUMPAD_SUBTRACT,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      r: Phaser.Input.Keyboard.KeyCodes.R,
    });

    scene.input.keyboard.on('keydown-E', () => {
      if (this.visible) this.exportDump();
    });
    scene.input.keyboard.on('keydown-R', () => {
      if (this.visible) this.resetDefaults();
    });

    this.refreshFields();
    this.refreshHelp();
  }

  shiftDown() {
    return this.keys.shift.isDown;
  }

  setVisible(visible) {
    this.visible = visible;
    this.root.setVisible(visible);
    this._holdDir = 0;
    this._holdArmed = false;
    if (visible) {
      this.refreshFields();
      this.refreshHelp();
    }
  }

  showToast(msg, ms = 2200) {
    this.toastMsg = msg;
    this.toastUntil = this.scene.time.now + ms;
    this.toastText.setText(msg);
  }

  refreshHelp() {
    this.helpText.setText(
      [
        'UP/DOWN select   [ ]  -/=  LEFT/RIGHT adjust   Shift=big',
        'E export JSON    R reset defaults    F1/` close    M map',
      ].join('\n')
    );
  }

  refreshFields() {
    const feel = getFeel();
    this.highlight.y = FIELD_TOP + this.selectedIndex * ROW_H + 4;
    this.rows.forEach((row, i) => {
      const selected = i === this.selectedIndex;
      const marker = selected ? '>' : ' ';
      const value = formatFeelValue(row.field.key, feel[row.field.key]);
      row.label.setText(`${marker} ${row.field.label.padEnd(12)} ${value.padStart(6)}`);
      row.label.setColor(selected ? '#f0f4c3' : '#9ccc65');
    });
  }

  /**
   * @param {{ room?: string, gravityOn?: boolean, grounded?: boolean, coyote?: number, x?: number, y?: number }} info
   */
  refreshStatus(info) {
    const room = info.room ?? '?';
    const grav = info.gravityOn ? 'ON' : 'OFF';
    const gnd = info.grounded ? 'Y' : 'N';
    const coy = info.coyote ?? 0;
    const x = Math.round(info.x ?? 0);
    const y = Math.round(info.y ?? 0);
    this.statusText.setText(
      `room ${room}  grav ${grav}  gnd ${gnd}  coy ${coy}\n` +
        `pos ${x},${y}  physics PAUSED`
    );
    if (this.scene.time.now >= this.toastUntil) this.toastText.setText('');
  }

  moveSelect(delta) {
    const n = FEEL_FIELDS.length;
    this.selectedIndex = (this.selectedIndex + delta + n) % n;
    this.refreshFields();
  }

  adjust(direction, shift) {
    const field = FEEL_FIELDS[this.selectedIndex];
    if (!field) return;
    nudgeFeel(field.key, direction, shift);
    this.refreshFields();
  }

  async exportDump() {
    try {
      const { filename, copied } = await downloadDesignJson();
      this.showToast(copied ? `Exported ${filename}` : `Exported ${filename}  (copy failed)`);
    } catch (err) {
      console.warn('design export failed', err);
      this.showToast('Export failed');
    }
  }

  resetDefaults() {
    resetDesignToDefaults();
    this.refreshFields();
    this.showToast('Reset to defaults');
  }

  decHeld() {
    const k = this.keys;
    return k.left.isDown || k.openBracket.isDown || k.minus.isDown || k.numSub.isDown;
  }

  incHeld() {
    const k = this.keys;
    return k.right.isDown || k.closeBracket.isDown || k.equals.isDown || k.numAdd.isDown;
  }

  /**
   * @param {number} time
   */
  update(time) {
    if (!this.visible) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.up)) this.moveSelect(-1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.down)) this.moveSelect(1);

    let dir = 0;
    if (this.decHeld() && !this.incHeld()) dir = -1;
    else if (this.incHeld() && !this.decHeld()) dir = 1;

    if (dir === 0) {
      this._holdDir = 0;
      this._holdArmed = false;
      return;
    }

    const shift = this.shiftDown();
    if (dir !== this._holdDir) {
      this._holdDir = dir;
      this._holdArmed = true;
      this._holdNext = time + 340;
      this.adjust(dir, shift);
      return;
    }

    if (this._holdArmed && time >= this._holdNext) {
      this.adjust(dir, shift);
      this._holdNext = time + 70;
    }
  }
}
