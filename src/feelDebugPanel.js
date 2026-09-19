import Phaser from 'phaser';
import { GAME_W, GAME_H, UI_FONT_LG, UI_FONT_MD, UI_FONT_SM, px } from './rooms.js';
import { addHudText } from './hudText.js';
import {
  FEEL_FIELDS,
  downloadDesignJson,
  formatFeelValue,
  getFeel,
  nudgeFeel,
  resetDesignToDefaults,
} from './designConfig.js';

const ROW_H = px(10);
const FIELD_TOP = px(40);

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

    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(600).setVisible(false);

    const panel = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W - px(8), GAME_H - px(8), 0x0a0a12, 0.94);
    panel.setStrokeStyle(2, 0xb2ff59, 1);
    this.root.add(panel);

    this.titleText = addHudText(scene, px(8), px(6), 'FEEL DEBUG  (F1 / `)', {
      fontSize: UI_FONT_LG,
      color: '#b2ff59',
    });
    this.root.add(this.titleText);

    this.statusText = addHudText(scene, px(8), px(16), '', {
      fontSize: UI_FONT_SM,
      color: '#c5e1a5',
    });
    this.root.add(this.statusText);

    this.highlight = scene.add.rectangle(GAME_W / 2, 0, GAME_W - px(16), ROW_H, 0x33691e, 0.85);
    this.root.add(this.highlight);

    this.rows = FEEL_FIELDS.map((field, i) => {
      const y = FIELD_TOP + i * ROW_H;
      const label = addHudText(scene, px(10), y, '', {
        fontSize: UI_FONT_MD,
        color: '#dcedc8',
      }).setInteractive({ useHandCursor: true });
      label.on('pointerdown', () => {
        this.selectedIndex = i;
        this.refreshFields();
      });
      this.root.add(label);

      const minus = addHudText(scene, px(268), y, '-', {
        fontSize: UI_FONT_MD,
        color: '#ffcc80',
      }).setInteractive({ useHandCursor: true });
      minus.on('pointerdown', (pointer) => this.adjust(-1, this.shiftDown(pointer?.event)));
      this.root.add(minus);

      const plus = addHudText(scene, px(284), y, '+', {
        fontSize: UI_FONT_MD,
        color: '#ffcc80',
      }).setInteractive({ useHandCursor: true });
      plus.on('pointerdown', (pointer) => this.adjust(1, this.shiftDown(pointer?.event)));
      this.root.add(plus);

      return { field, label, minus, plus };
    });

    this.helpText = addHudText(scene, px(8), px(132), '', {
      fontSize: UI_FONT_SM,
      color: '#78909c',
    });
    this.root.add(this.helpText);

    this.toastText = addHudText(scene, GAME_W / 2, px(170), '', {
      fontSize: UI_FONT_SM,
      color: '#ffe082',
    }).setOrigin(0.5, 1);
    this.root.add(this.toastText);

    this.shiftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    // Event-based keys (not JustDown polling) so overlay select/adjust
    // cannot be eaten by GameScene jump-edge consumption.
    scene.input.keyboard.on('keydown', (event) => this.onKeyDown(event));

    this.refreshFields();
    this.refreshHelp();
  }

  shiftDown(event) {
    return Boolean(event?.shiftKey || this.shiftKey?.isDown);
  }

  /**
   * @param {KeyboardEvent} event
   */
  onKeyDown(event) {
    if (!this.visible || !event) return;
    const ev = event.originalEvent || event;
    const key = ev.key;
    const code = ev.code;
    const shift = this.shiftDown(ev);

    if (key === 'ArrowUp' || code === 'ArrowUp') {
      this.moveSelect(-1);
      return;
    }
    if (key === 'ArrowDown' || code === 'ArrowDown') {
      this.moveSelect(1);
      return;
    }
    if (
      key === 'ArrowLeft' ||
      code === 'ArrowLeft' ||
      key === '[' ||
      code === 'BracketLeft' ||
      key === '-' ||
      key === '_' ||
      code === 'Minus' ||
      code === 'NumpadSubtract'
    ) {
      this.adjust(-1, shift);
      return;
    }
    if (
      key === 'ArrowRight' ||
      code === 'ArrowRight' ||
      key === ']' ||
      code === 'BracketRight' ||
      key === '=' ||
      key === '+' ||
      code === 'Equal' ||
      code === 'NumpadAdd'
    ) {
      this.adjust(1, shift);
      return;
    }
    if (key === 'e' || key === 'E' || code === 'KeyE') {
      this.exportDump();
      return;
    }
    if (key === 'r' || key === 'R' || code === 'KeyR') {
      this.resetDefaults();
    }
  }

  setVisible(visible) {
    this.visible = visible;
    this.root.setVisible(visible);
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
    this.highlight.y = FIELD_TOP + this.selectedIndex * ROW_H + px(4);
    this.rows.forEach((row, i) => {
      const selected = i === this.selectedIndex;
      const marker = selected ? '>' : ' ';
      const value = formatFeelValue(row.field.key, feel[row.field.key]);
      row.label.setText(`${marker} ${row.field.label.padEnd(12)} ${value.padStart(6)}`);
      row.label.setColor(selected ? '#f0f4c3' : '#9ccc65');
    });
  }

  /**
   * @param {{ room?: string, gravityOn?: boolean, gravityDown?: string, grounded?: boolean, coyote?: number, x?: number, y?: number, hp?: number, maxHp?: number, phase?: string, deaths?: number }} info
   */
  refreshStatus(info) {
    const room = info.room ?? '?';
    const grav = info.gravityOn ? 'ON' : 'OFF';
    const down = String(info.gravityDown ?? 'down').toUpperCase();
    const gnd = info.grounded ? 'Y' : 'N';
    const coy = info.coyote ?? 0;
    const x = Math.round(info.x ?? 0);
    const y = Math.round(info.y ?? 0);
    const hp = info.hp ?? '?';
    const maxHp = info.maxHp ?? '?';
    const phase = info.phase ?? '?';
    const deaths = info.deaths ?? 0;
    this.statusText.setText(
      `room ${room}  grav ${grav}/${down}  gnd ${gnd}  coy ${coy}  hp ${hp}/${maxHp}\n` +
        `pos ${x},${y}  phase ${phase}  deaths ${deaths}  physics PAUSED`
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

  update() {
    // Status / toast refresh from GameScene; keys are handled on keydown.
  }
}
