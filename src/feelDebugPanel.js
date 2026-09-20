import Phaser from 'phaser';
import { GAME_W, GAME_H, UI_FONT_LG, UI_FONT_MD, UI_FONT_SM, px } from './rooms.js';
import { addHudText } from './hudText.js';
import {
  ABILITY_UNLOCK_ORDER,
  FEEL_FIELDS,
  downloadDesignJson,
  formatFeelValue,
  getFeel,
  nudgeFeel,
  resetDesignToDefaults,
} from './designConfig.js';
import { isTypingInEditorField } from './levelEditor.js';
import { LevelEditor } from './levelEditorView.js';
import { hasAbility } from './runState.js';

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
    this.editorOn = false;
    this.selectedIndex = 0;
    this.toastUntil = 0;
    this.toastMsg = '';
    this.levelEditor = new LevelEditor(scene);

    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(600).setVisible(false);

    this.panel = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W - px(8), GAME_H - px(8), 0x0a0a12, 0.94);
    this.panel.setStrokeStyle(2, 0xb2ff59, 1);
    this.root.add(this.panel);

    this.titleText = addHudText(scene, px(8), px(6), 'FEEL DEBUG  (F1 / `)', {
      fontSize: UI_FONT_LG,
      color: '#b2ff59',
    });
    this.root.add(this.titleText);

    this.editorToggle = addHudText(scene, GAME_W - px(8), px(6), 'LEVEL EDIT: OFF', {
      fontSize: UI_FONT_MD,
      color: '#80cbc4',
    })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.editorToggle.on('pointerdown', () => this.setEditorOn(!this.editorOn));
    this.root.add(this.editorToggle);

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

    this.cheatText = addHudText(scene, px(8), px(128), '', {
      fontSize: UI_FONT_SM,
      color: '#ffe082',
    }).setInteractive({ useHandCursor: true });
    this.cheatText.on('pointerdown', (pointer) => this.onCheatClick(pointer));
    this.root.add(this.cheatText);

    this.helpText = addHudText(scene, px(8), px(148), '', {
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

  get editorActive() {
    return this.visible && this.editorOn;
  }

  /**
   * @param {KeyboardEvent} event
   */
  onKeyDown(event) {
    if (!this.visible || !event) return;
    if (isTypingInEditorField()) return;
    const ev = event.originalEvent || event;
    const key = ev.key;
    const code = ev.code;
    const shift = this.shiftDown(ev);

    if (this.editorOn) {
      if (key === 'Tab' || code === 'Tab') {
        ev.preventDefault?.();
        this.levelEditor.cycleTool(shift ? -1 : 1);
        return;
      }
      if (key === 'g' || key === 'G' || code === 'KeyG') {
        this.levelEditor.cycleGrid();
        return;
      }
      if (key === 'Delete' || key === 'Backspace' || code === 'Delete' || code === 'Backspace') {
        this.levelEditor.deleteSelected();
        return;
      }
    }

    if (!this.editorOn && (key === 'ArrowUp' || code === 'ArrowUp')) {
      this.moveSelect(-1);
      return;
    }
    if (!this.editorOn && (key === 'ArrowDown' || code === 'ArrowDown')) {
      this.moveSelect(1);
      return;
    }
    if (
      !this.editorOn &&
      (key === 'ArrowLeft' ||
        code === 'ArrowLeft' ||
        key === '[' ||
        code === 'BracketLeft' ||
        key === '-' ||
        key === '_' ||
        code === 'Minus' ||
        code === 'NumpadSubtract')
    ) {
      this.adjust(-1, shift);
      return;
    }
    if (
      !this.editorOn &&
      (key === 'ArrowRight' ||
        code === 'ArrowRight' ||
        key === ']' ||
        code === 'BracketRight' ||
        key === '=' ||
        key === '+' ||
        code === 'Equal' ||
        code === 'NumpadAdd')
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
      return;
    }

    const digit = /^Digit([0-9])$/.exec(code);
    const num = digit ? Number(digit[1]) : NaN;
    if (Number.isFinite(num)) {
      if (shift && num >= 1 && num <= 7) {
        const rooms = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'];
        this.scene.debugWarpRoom?.(rooms[num - 1]);
        this.showToast(`Warp ${rooms[num - 1]}`);
        return;
      }
      if (!shift && num >= 1 && num <= 4) {
        const id = ABILITY_UNLOCK_ORDER[num - 1];
        this.scene.debugToggleAbility?.(id);
        this.refreshCheat();
        this.showToast(`${hasAbility(id) ? 'Grant' : 'Revoke'} ${id}`);
        return;
      }
    }
  }

  setVisible(visible) {
    this.visible = visible;
    this.root.setVisible(visible);
    this.syncEditorChrome();
    if (visible) {
      this.refreshFields();
      this.refreshHelp();
    }
  }

  setEditorOn(on) {
    this.editorOn = Boolean(on);
    this.syncEditorChrome();
    this.refreshHelp();
    this.showToast(this.editorOn ? 'Level edit ON — walk + place' : 'Level edit OFF');
  }

  syncEditorChrome() {
    const editing = this.editorActive;
    this.levelEditor.setActive(editing);
    this.levelEditor.chromeH = editing ? px(42) : px(8);
    if (this.editorToggle) {
      this.editorToggle.setText(this.editorOn ? 'LEVEL EDIT: ON' : 'LEVEL EDIT: OFF');
      this.editorToggle.setColor(this.editorOn ? '#b2ff59' : '#80cbc4');
    }
    if (editing) {
      this.panel.setSize(GAME_W - px(8), px(40));
      this.panel.setPosition(GAME_W / 2, px(24));
      this.panel.setFillStyle(0x0a0a12, 0.82);
      this.highlight.setVisible(false);
      this.rows.forEach((row) => {
        row.label.setVisible(false);
        row.minus.setVisible(false);
        row.plus.setVisible(false);
      });
      this.cheatText.setY(px(28));
      this.helpText.setY(px(38));
      this.helpText.setVisible(false);
    } else {
      this.panel.setSize(GAME_W - px(8), GAME_H - px(8));
      this.panel.setPosition(GAME_W / 2, GAME_H / 2);
      this.panel.setFillStyle(0x0a0a12, 0.94);
      this.highlight.setVisible(true);
      this.rows.forEach((row) => {
        row.label.setVisible(true);
        row.minus.setVisible(true);
        row.plus.setVisible(true);
      });
      this.cheatText.setY(px(128));
      this.helpText.setY(px(148));
      this.helpText.setVisible(true);
    }
    if (!this.visible) this.levelEditor.setActive(false);
    this.scene.onEditorModeChange?.(this.editorActive);
  }

  showToast(msg, ms = 2200) {
    this.toastMsg = msg;
    this.toastUntil = this.scene.time.now + ms;
    this.toastText.setText(msg);
  }

  refreshHelp() {
    this.refreshCheat();
    this.helpText.setText(
      this.editorOn
        ? [
            'LEVEL EDIT  Tab tool  G grid  click-drag place  Del erase',
            '1-4 abilities  Shift+1-7 warp  E feel JSON  R reset dump',
            'Copy/Download level JSON in the bottom strip   F1/` close',
          ].join('\n')
        : [
            '1-4 toggle FALL/WALK/JUMP/FIELD   Shift+1-7 warp R0-R6',
            'UP/DOWN select   [ ] -/= arrows adjust   Shift=big',
            'E export JSON    R reset feel    F1/` close    M map',
          ].join('\n')
    );
  }

  refreshCheat() {
    const chips = ABILITY_UNLOCK_ORDER.map((id, i) => {
      const tag = ['FALL', 'WALK', 'JUMP', 'FIELD'][i] || id.slice(0, 4).toUpperCase();
      return hasAbility(id) ? `[${tag}]` : tag.toLowerCase();
    }).join(' ');
    this.cheatText?.setText(`CHEAT  ${chips}   warp R0-R6 (Shift+1-7 or click)`);
  }

  onCheatClick(pointer) {
    const x = pointer?.worldX ?? pointer?.x ?? 0;
    // Left half of the cheat line toggles abilities by x band; right half cycles rooms.
    if (x < 280) {
      const slot = Math.min(3, Math.max(0, Math.floor((x - 50) / 50)));
      const id = ABILITY_UNLOCK_ORDER[slot];
      if (id) {
        this.scene.debugToggleAbility?.(id);
        this.refreshCheat();
        this.showToast(`${hasAbility(id) ? 'Grant' : 'Revoke'} ${id}`);
      }
      return;
    }
    const rooms = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'];
    const slot = Math.min(6, Math.max(0, Math.floor((x - 280) / 36)));
    this.scene.debugWarpRoom?.(rooms[slot]);
    this.showToast(`Warp ${rooms[slot]}`);
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
    const phys = this.editorOn ? 'LIVE (edit)' : 'PAUSED';
    this.statusText.setText(
      `room ${room}  grav ${grav}/${down}  gnd ${gnd}  coy ${coy}  hp ${hp}/${maxHp}\n` +
        `pos ${x},${y}  phase ${phase}  deaths ${deaths}  physics ${phys}`
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
    if (this.editorOn) this.levelEditor.resetDefaults();
    else resetDesignToDefaults();
    this.refreshFields();
    this.showToast('Reset to bundled default');
  }

  update() {
    // Status / toast refresh from GameScene; keys are handled on keydown.
  }
}
