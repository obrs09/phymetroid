/**
 * Always-on compact run HUD: HP hearts, phase, ability chips, item count.
 * Sharp text via hudText.js; depth below map (500) and feel debugger (600).
 */

import { GAME_W, UI_FONT_MD, UI_FONT_SM, px } from './rooms.js';
import { addHudText } from './hudText.js';
import { getProgressDesign, subscribeDesign } from './designConfig.js';
import { axisLabel } from './gravity.js';
import { ABILITY, KNOWN_ABILITIES, getAbilityGrants, getItemTotal, getRunState, subscribeRun } from './runState.js';

const ABILITY_TAG = Object.freeze({
  [ABILITY.GRAVITY_FALL]: 'FALL',
  [ABILITY.SURFACE_WALK]: 'WALK',
  [ABILITY.REACTION_JUMP]: 'JUMP',
  [ABILITY.GRAVITY_FIELD]: 'FIELD',
});

export class RunHud {
  /**
   * @param {import('phaser').Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(200);

    this.hpText = addHudText(scene, px(8), px(6), '', {
      fontSize: UI_FONT_MD,
      color: '#ff8a80',
    });
    this.phaseText = addHudText(scene, px(8), px(18), '', {
      fontSize: UI_FONT_SM,
      color: '#ffe082',
    });
    this.abilityText = addHudText(scene, px(8), px(28), '', {
      fontSize: UI_FONT_SM,
      color: '#80deea',
    });
    this.gravText = addHudText(scene, px(8), px(38), '', {
      fontSize: UI_FONT_SM,
      color: '#b0bec5',
    });
    this.itemText = addHudText(scene, GAME_W - px(6), px(6), '', {
      fontSize: UI_FONT_SM,
      color: '#b0bec5',
    }).setOrigin(1, 0);

    this.root.add([this.hpText, this.phaseText, this.abilityText, this.gravText, this.itemText]);

    this._unsubRun = subscribeRun(() => this.refresh());
    this._unsubDesign = subscribeDesign(() => this.refresh());
    this.refresh();

    scene.events.once('shutdown', () => {
      this._unsubRun?.();
      this._unsubDesign?.();
    });
  }

  setVisible(visible) {
    this.root.setVisible(visible);
  }

  refresh() {
    const snap = getRunState();
    const labels = getProgressDesign().phaseLabels;
    const hearts = Array.from({ length: snap.maxHp }, (_, i) => (i < snap.hp ? '♥' : '♡')).join('');
    this.hpText.setText(`HP ${hearts} ${snap.hp}/${snap.maxHp}`);
    this.phaseText.setText(labels[snap.phase] ?? String(snap.phase).toUpperCase());

    const chips = KNOWN_ABILITIES.map((id) => {
      const tag = ABILITY_TAG[id] ?? String(id).slice(0, 4).toUpperCase();
      return snap.abilities.includes(id) ? `[${tag}]` : tag.toLowerCase();
    }).join(' ');
    this.abilityText.setText(chips);
    const grants = getAbilityGrants();
    this.abilityText.setColor(grants.hasGravity ? '#80deea' : '#78909c');
    this.gravText.setText(grants.hasGravity ? `GRAV ${axisLabel(snap.gravityDown)}` : '');
    this.gravText.setColor('#ce93d8');

    const ids = Object.keys(snap.items);
    const summary = ids.map((id) => `${id}×${snap.items[id]}`).join(' ');
    this.itemText.setText(ids.length ? `ITEMS ${getItemTotal()}  ${summary}` : 'ITEMS 0');
  }
}
