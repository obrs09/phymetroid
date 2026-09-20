/**
 * Phaser + HTML mount for the F1 level editor.
 * Pure schema helpers live in levelEditor.js so Node schema tests stay Phaser-free.
 */

import {
  ABILITY_ID,
  LAYOUT_REVISION,
  SCHEMA_VERSION,
  copyDesignJson,
  downloadDesignJson,
  getGates,
  getPickups,
  getRooms,
  resetDesignToDefaults,
} from './designConfig.js';
import { addHudText } from './hudText.js';
import {
  DEFAULT_ROOM,
  EDITOR_GRID_SIZES,
  EDITOR_TOOLS,
  GATE_KIND_OPTIONS,
  HANDLE_SIZE,
  MIN_ROOM,
  MIN_SOLID,
  PICKUP_TYPE_OPTIONS,
  SOLID_KIND_OPTIONS,
  applyWorldRectToSelection,
  commitLayout,
  deleteSelection,
  handleAtPoint,
  hitTestEditor,
  makeGate,
  makePickup,
  makeRoom,
  makeSolidLocal,
  normalizeRect,
  renameRoomId,
  resizeRect,
  selectionWorldRect,
  snapPoint,
  snapToGrid,
  worldToLocal,
} from './levelEditor.js';
import { findRoomAt, GAME_H, GAME_W, UI_FONT_SM, px } from './rooms.js';
import { solidToWorldRect } from './worldSolids.js';

function optionList(values, selected) {
  return values
    .map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`)
    .join('');
}

/**
 * Phaser + HTML editor mounted from the F1 feel panel.
 */
export class LevelEditor {
  /**
   * @param {import('phaser').Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.tool = 'select';
    this.grid = 16;
    this.autoWalls = true;
    this.selection = null;
    this.drag = null;
    this.pickupType = ABILITY_ID.GRAVITY_FALL;
    this.solidKind = 'wall';
    this.gateKind = 'corridorJoin';
    this.gateRequires = '';
    this.chromeH = px(40);

    this.overlay = scene.add.graphics().setDepth(18);
    this.hud = addHudText(scene, px(8), px(46), '', {
      fontSize: UI_FONT_SM,
      color: '#c5e1a5',
    })
      .setScrollFactor(0)
      .setDepth(590)
      .setVisible(false);

    this.dom = this.mountDom();
    this.boundDown = (p) => this.onPointerDown(p);
    this.boundMove = (p) => this.onPointerMove(p);
    this.boundUp = (p) => this.onPointerUp(p);
    scene.input.on('pointerdown', this.boundDown);
    scene.input.on('pointermove', this.boundMove);
    scene.input.on('pointerup', this.boundUp);
  }

  mountDom() {
    if (typeof document === 'undefined') return null;
    const existing = document.getElementById('phy-level-editor');
    existing?.remove();
    const el = document.createElement('div');
    el.id = 'phy-level-editor';
    el.style.cssText = [
      'display:none',
      'position:absolute',
      'left:8px',
      'right:8px',
      'bottom:8px',
      'z-index:30',
      'max-height:38%',
      'overflow:auto',
      'padding:6px 8px',
      'background:rgba(10,10,18,0.92)',
      'border:1px solid #b2ff59',
      'color:#dcedc8',
      'font:12px/1.35 "Courier New", Courier, monospace',
      'pointer-events:auto',
    ].join(';');
    el.innerHTML = `
      <div class="phy-ed-tools" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px"></div>
      <div class="phy-ed-row" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px">
        <label>grid <select data-ed="grid">${optionList(EDITOR_GRID_SIZES, 16)}</select></label>
        <label>kind <select data-ed="solidKind">${optionList(SOLID_KIND_OPTIONS, 'wall')}</select></label>
        <label>orb <select data-ed="pickupType">${optionList(PICKUP_TYPE_OPTIONS, ABILITY_ID.GRAVITY_FALL)}</select></label>
        <label>gate <select data-ed="gateKind">${optionList(GATE_KIND_OPTIONS, 'corridorJoin')}</select></label>
        <label>req <select data-ed="gateRequires"><option value="">(none)</option>${optionList(PICKUP_TYPE_OPTIONS, '')}</select></label>
        <label><input type="checkbox" data-ed="autoWalls" checked /> auto walls</label>
      </div>
      <div class="phy-ed-insp" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px">
        <label>id <input data-ed="id" size="14" /></label>
        <label>x <input data-ed="x" size="5" /></label>
        <label>y <input data-ed="y" size="5" /></label>
        <label>w <input data-ed="w" size="4" /></label>
        <label>h <input data-ed="h" size="4" /></label>
        <label>gapGate <input data-ed="gapGateId" size="14" /></label>
        <label>from <input data-ed="fromRoomId" size="4" /></label>
        <label>to <input data-ed="toRoomId" size="4" /></label>
      </div>
      <div class="phy-ed-actions" style="display:flex;flex-wrap:wrap;gap:4px">
        <button type="button" data-act="apply">Apply fields</button>
        <button type="button" data-act="copy">Copy level JSON</button>
        <button type="button" data-act="download">Download level JSON</button>
        <button type="button" data-act="reset">Reset to bundled default</button>
        <button type="button" data-act="warp">Warp to selection</button>
      </div>
    `;
    const parent = document.getElementById('game-container') || document.body;
    parent.appendChild(el);
    this.bindDom(el);
    return el;
  }

  bindDom(el) {
    const tools = el.querySelector('.phy-ed-tools');
    for (const tool of EDITOR_TOOLS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.tool = tool;
      btn.textContent = tool.toUpperCase();
      btn.style.cssText = 'cursor:pointer;font:11px Courier New,monospace;';
      btn.addEventListener('click', () => this.setTool(tool));
      tools.appendChild(btn);
    }
    el.querySelector('[data-ed="grid"]').addEventListener('change', (e) => {
      this.grid = Number(e.target.value) || 16;
      this.refreshHud();
    });
    el.querySelector('[data-ed="solidKind"]').addEventListener('change', (e) => {
      this.solidKind = e.target.value;
    });
    el.querySelector('[data-ed="pickupType"]').addEventListener('change', (e) => {
      this.pickupType = e.target.value;
    });
    el.querySelector('[data-ed="gateKind"]').addEventListener('change', (e) => {
      this.gateKind = e.target.value;
    });
    el.querySelector('[data-ed="gateRequires"]').addEventListener('change', (e) => {
      this.gateRequires = e.target.value;
    });
    el.querySelector('[data-ed="autoWalls"]').addEventListener('change', (e) => {
      this.autoWalls = e.target.checked;
    });
    el.querySelector('[data-act="apply"]').addEventListener('click', () => this.applyFields());
    el.querySelector('[data-act="copy"]').addEventListener('click', () => this.copyJson());
    el.querySelector('[data-act="download"]').addEventListener('click', () => this.downloadJson());
    el.querySelector('[data-act="reset"]').addEventListener('click', () => this.resetDefaults());
    el.querySelector('[data-act="warp"]').addEventListener('click', () => this.warpToSelection());
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('keydown', (e) => e.stopPropagation());
  }

  setActive(on) {
    this.active = Boolean(on);
    this.hud.setVisible(this.active);
    if (this.dom) this.dom.style.display = this.active ? 'block' : 'none';
    if (!this.active) {
      this.drag = null;
      this.overlay.clear();
    } else {
      this.refreshDom();
      this.refreshHud();
      this.drawOverlay();
    }
  }

  setTool(tool) {
    if (!EDITOR_TOOLS.includes(tool)) return;
    this.tool = tool;
    this.refreshDom();
    this.refreshHud();
    this.scene.debugPanel?.showToast?.(`Tool ${tool}`);
  }

  cycleTool(dir = 1) {
    const i = EDITOR_TOOLS.indexOf(this.tool);
    this.setTool(EDITOR_TOOLS[(i + dir + EDITOR_TOOLS.length) % EDITOR_TOOLS.length]);
  }

  cycleGrid() {
    const i = EDITOR_GRID_SIZES.indexOf(this.grid);
    this.grid = EDITOR_GRID_SIZES[(i + 1) % EDITOR_GRID_SIZES.length];
    if (this.dom) this.dom.querySelector('[data-ed="grid"]').value = String(this.grid);
    this.refreshHud();
  }

  getState() {
    return {
      active: this.active,
      tool: this.tool,
      grid: this.grid,
      selection: this.selection
        ? {
            type: this.selection.type,
            id:
              this.selection.room?.id ||
              this.selection.pickup?.id ||
              this.selection.gate?.id ||
              this.selection.solid?.id,
            solidId: this.selection.solid?.id,
          }
        : null,
      layoutRevision: LAYOUT_REVISION,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  worldPoint(pointer) {
    const cam = this.scene.cameras.main;
    const pt = cam.getWorldPoint(pointer.x, pointer.y);
    return { x: pt.x, y: pt.y };
  }

  pointerBlocked(pointer) {
    const ev = pointer?.event;
    const t = ev?.target;
    if (t && this.dom && this.dom.contains(t)) return true;
    if (t && t.tagName && t.tagName !== 'CANVAS') return true;
    if (pointer.y < this.chromeH) return true;
    return false;
  }

  currentRooms() {
    return getRooms();
  }

  activeRoom(worldX, worldY) {
    if (this.selection?.type === 'room') {
      return this.currentRooms().find((r) => r.id === this.selection.room.id) || null;
    }
    if (this.selection?.type === 'solid') {
      return this.currentRooms().find((r) => r.id === this.selection.room.id) || null;
    }
    return (
      findRoomAt(worldX, worldY, this.currentRooms()) ||
      this.currentRooms().find((r) => r.id === this.scene.currentRoomId) ||
      this.currentRooms()[0] ||
      null
    );
  }

  onPointerDown(pointer) {
    if (!this.active || this.pointerBlocked(pointer)) return;
    if (pointer.button !== 0) return;
    const { x, y } = this.worldPoint(pointer);
    const snapped = snapPoint(x, y, this.grid);
    const rooms = this.currentRooms();
    const pickups = getPickups();
    const gates = getGates();

    if (this.tool === 'select') {
      const rect = selectionWorldRect(this.selection, rooms);
      const handle = handleAtPoint(rect, x, y);
      if (this.selection && handle && this.selection.type !== 'pickup') {
        this.drag = { mode: 'resize', handle, start: { x, y }, orig: { ...rect } };
        return;
      }
      this.selection = hitTestEditor(rooms, pickups, gates, x, y);
      if (this.selection) {
        const now = selectionWorldRect(this.selection, rooms);
        this.drag = { mode: 'move', start: { x, y }, orig: now ? { ...now } : null };
      }
      this.refreshDom();
      this.drawOverlay();
      return;
    }

    if (this.tool === 'delete') {
      const hit = hitTestEditor(rooms, pickups, gates, x, y);
      if (hit) {
        const next = deleteSelection(hit, rooms, pickups, gates);
        this.selection = null;
        commitLayout(next);
        this.scene.debugPanel?.showToast?.(`Deleted ${hit.type}`);
        this.refreshDom();
      }
      return;
    }

    if (this.tool === 'pickup') {
      const pickup = makePickup(snapped.x, snapped.y, this.pickupType, rooms, pickups);
      pickups.push(pickup);
      commitLayout({ rooms, pickups, gates });
      this.selection = { type: 'pickup', pickup, room: rooms.find((r) => r.id === pickup.roomId) };
      this.scene.debugPanel?.showToast?.(`Pickup ${pickup.id}`);
      this.refreshDom();
      return;
    }

    if (this.tool === 'room' || this.tool === 'wall' || this.tool === 'gate') {
      this.drag = { mode: 'create', tool: this.tool, x0: snapped.x, y0: snapped.y, x1: snapped.x, y1: snapped.y };
    }
  }

  onPointerMove(pointer) {
    if (!this.active || !this.drag) return;
    const { x, y } = this.worldPoint(pointer);
    if (this.drag.mode === 'create') {
      const p = snapPoint(x, y, this.grid);
      this.drag.x1 = p.x;
      this.drag.y1 = p.y;
    } else if (this.drag.mode === 'move' && this.drag.orig) {
      const dx = snapToGrid(x - this.drag.start.x, this.grid);
      const dy = snapToGrid(y - this.drag.start.y, this.grid);
      this.drag.preview = {
        x: this.drag.orig.x + dx,
        y: this.drag.orig.y + dy,
        w: this.drag.orig.w,
        h: this.drag.orig.h,
      };
    } else if (this.drag.mode === 'resize' && this.drag.orig) {
      const min = this.selection?.type === 'room' ? MIN_ROOM : MIN_SOLID;
      this.drag.preview = resizeRect(this.drag.orig, this.drag.handle, x, y, this.grid, min);
    }
    this.drawOverlay();
    this.refreshHud();
  }

  onPointerUp() {
    if (!this.active || !this.drag) return;
    const drag = this.drag;
    this.drag = null;
    const rooms = this.currentRooms();
    const pickups = getPickups();
    const gates = getGates();

    if (drag.mode === 'create') {
      const min = drag.tool === 'room' ? MIN_ROOM : MIN_SOLID;
      let rect = normalizeRect(drag.x0, drag.y0, drag.x1, drag.y1, this.grid, min);
      if (drag.tool === 'room' && rect.w <= min && rect.h <= min) {
        rect = { x: rect.x, y: rect.y, w: DEFAULT_ROOM.w, h: DEFAULT_ROOM.h };
      }
      if (drag.tool === 'room') {
        const room = makeRoom(rect, rooms, { autoWalls: this.autoWalls });
        rooms.push(room);
        commitLayout({ rooms, pickups, gates });
        this.selection = { type: 'room', room };
        this.scene.debugWarpRoom?.(room.id);
        this.scene.debugPanel?.showToast?.(`Room ${room.id}`);
      } else if (drag.tool === 'wall') {
        const host = this.activeRoom(rect.x + rect.w / 2, rect.y + rect.h / 2);
        if (!host) {
          this.scene.debugPanel?.showToast?.('No room for wall');
        } else {
          const room = rooms.find((r) => r.id === host.id);
          room.solids = room.solids ? [...room.solids] : [];
          const solid = makeSolidLocal(room, rect, { kind: this.solidKind });
          room.solids.push(solid);
          commitLayout({ rooms, pickups, gates });
          this.selection = { type: 'solid', room, solid };
          this.scene.debugPanel?.showToast?.(`Solid ${solid.id}`);
        }
      } else if (drag.tool === 'gate') {
        const gate = makeGate(rect, rooms, gates, {
          kind: this.gateKind,
          requireAbility: this.gateRequires,
        });
        gates.push(gate);
        commitLayout({ rooms, pickups, gates });
        this.selection = { type: 'gate', gate, room: rooms.find((r) => r.id === gate.fromRoomId) };
        this.scene.debugPanel?.showToast?.(`Gate ${gate.id}`);
      }
      this.refreshDom();
      this.drawOverlay();
      return;
    }

    if ((drag.mode === 'move' || drag.mode === 'resize') && drag.preview && this.selection) {
      applyWorldRectToSelection(this.selection, drag.preview, rooms, pickups);
      commitLayout({ rooms, pickups, gates });
      this.refreshDom();
    }
    this.drawOverlay();
  }

  applyFields() {
    if (!this.selection || !this.dom) return;
    const val = (key) => this.dom.querySelector(`[data-ed="${key}"]`)?.value ?? '';
    const num = (key, fallback) => {
      const n = Number(val(key));
      return Number.isFinite(n) ? n : fallback;
    };
    const rooms = this.currentRooms();
    const pickups = getPickups();
    const gates = getGates();
    const sel = this.selection;

    if (sel.type === 'room') {
      const room = rooms.find((r) => r.id === sel.room.id);
      if (!room) return;
      const nextId = val('id').trim() || room.id;
      if (nextId !== room.id) renameRoomId(rooms, pickups, gates, room.id, nextId);
      room.x = num('x', room.x);
      room.y = num('y', room.y);
      room.w = Math.max(MIN_ROOM, num('w', room.w));
      room.h = Math.max(MIN_ROOM, num('h', room.h));
      this.selection = { type: 'room', room };
    } else if (sel.type === 'solid') {
      const room = rooms.find((r) => r.id === sel.room.id);
      const solid = room?.solids?.find((s) => s.id === sel.solid.id);
      if (!solid) return;
      const nextId = val('id').trim();
      if (nextId) solid.id = nextId;
      const world = {
        x: num('x', solidToWorldRect(room, solid).x),
        y: num('y', solidToWorldRect(room, solid).y),
        w: Math.max(MIN_SOLID, num('w', solid.w)),
        h: Math.max(MIN_SOLID, num('h', solid.h)),
      };
      const local = worldToLocal(room, world);
      Object.assign(solid, local);
      solid.kind = this.solidKind || solid.kind;
      const gap = val('gapGateId').trim();
      if (gap) solid.gapGateId = gap;
      else delete solid.gapGateId;
      this.selection = { type: 'solid', room, solid };
    } else if (sel.type === 'pickup') {
      const pickup = pickups.find((p) => p.id === sel.pickup.id);
      if (!pickup) return;
      const nextId = val('id').trim();
      if (nextId) pickup.id = nextId;
      pickup.x = num('x', pickup.x);
      pickup.y = num('y', pickup.y);
      pickup.ability = this.pickupType || pickup.ability;
      const host = findRoomAt(pickup.x, pickup.y, rooms);
      if (host) pickup.roomId = host.id;
      this.selection = { type: 'pickup', pickup, room: host };
    } else if (sel.type === 'gate') {
      const gate = gates.find((g) => g.id === sel.gate.id);
      if (!gate) return;
      const nextId = val('id').trim();
      if (nextId) gate.id = nextId;
      gate.fromRoomId = val('fromRoomId').trim() || gate.fromRoomId;
      gate.toRoomId = val('toRoomId').trim() || gate.toRoomId;
      gate.kind = this.gateKind || gate.kind;
      gate.requireAbility = this.gateRequires || '';
      const wx = num('x', gate.world?.x ?? 0);
      const wy = num('y', gate.world?.y ?? 0);
      const ww = Math.max(MIN_SOLID, num('w', gate.world?.w ?? 16));
      const wh = Math.max(MIN_SOLID, num('h', gate.world?.h ?? 16));
      gate.world = { x: wx, y: wy, w: ww, h: wh };
      this.selection = { type: 'gate', gate, room: rooms.find((r) => r.id === gate.fromRoomId) };
    }
    commitLayout({ rooms, pickups, gates });
    this.scene.debugPanel?.showToast?.('Applied fields');
    this.refreshDom();
    this.drawOverlay();
  }

  async copyJson() {
    try {
      const { copied } = await copyDesignJson();
      this.scene.debugPanel?.showToast?.(copied ? 'Level JSON copied' : 'Copy failed — use Download');
    } catch (err) {
      console.warn('level copy failed', err);
      this.scene.debugPanel?.showToast?.('Copy failed');
    }
  }

  async downloadJson() {
    try {
      const { filename, copied } = await downloadDesignJson();
      this.scene.debugPanel?.showToast?.(
        copied ? `Downloaded ${filename}` : `Downloaded ${filename}  (copy failed)`
      );
    } catch (err) {
      console.warn('level download failed', err);
      this.scene.debugPanel?.showToast?.('Download failed');
    }
  }

  resetDefaults() {
    this.selection = null;
    resetDesignToDefaults();
    this.scene.debugPanel?.showToast?.('Reset to bundled default');
    this.refreshDom();
    this.drawOverlay();
  }

  warpToSelection() {
    const id =
      this.selection?.type === 'room'
        ? this.selection.room.id
        : this.selection?.room?.id || this.selection?.pickup?.roomId || this.selection?.gate?.fromRoomId;
    if (id) this.scene.debugWarpRoom?.(id);
  }

  deleteSelected() {
    if (!this.selection) return;
    const next = deleteSelection(this.selection, getRooms(), getPickups(), getGates());
    this.selection = null;
    commitLayout(next);
    this.scene.debugPanel?.showToast?.('Deleted');
    this.refreshDom();
    this.drawOverlay();
  }

  refreshDom() {
    if (!this.dom) return;
    for (const btn of this.dom.querySelectorAll('[data-tool]')) {
      const on = btn.dataset.tool === this.tool;
      btn.style.background = on ? '#33691e' : '#1b1b24';
      btn.style.color = on ? '#f0f4c3' : '#c5e1a5';
    }
    const rooms = this.currentRooms();
    const rect = selectionWorldRect(this.selection, rooms);
    const set = (key, value) => {
      const el = this.dom.querySelector(`[data-ed="${key}"]`);
      if (el && document.activeElement !== el) el.value = value ?? '';
    };
    set('grid', String(this.grid));
    set('solidKind', this.solidKind);
    set('pickupType', this.pickupType);
    set('gateKind', this.gateKind);
    set('gateRequires', this.gateRequires);
    if (!this.selection) {
      set('id', '');
      set('x', '');
      set('y', '');
      set('w', '');
      set('h', '');
      set('gapGateId', '');
      set('fromRoomId', '');
      set('toRoomId', '');
      return;
    }
    if (this.selection.type === 'room') {
      set('id', this.selection.room.id);
      set('x', String(this.selection.room.x));
      set('y', String(this.selection.room.y));
      set('w', String(this.selection.room.w));
      set('h', String(this.selection.room.h));
    } else if (this.selection.type === 'solid') {
      set('id', this.selection.solid.id || '');
      if (rect) {
        set('x', String(rect.x));
        set('y', String(rect.y));
        set('w', String(rect.w));
        set('h', String(rect.h));
      }
      set('gapGateId', this.selection.solid.gapGateId || '');
      this.solidKind = this.selection.solid.kind || this.solidKind;
      set('solidKind', this.solidKind);
    } else if (this.selection.type === 'pickup') {
      set('id', this.selection.pickup.id);
      set('x', String(this.selection.pickup.x));
      set('y', String(this.selection.pickup.y));
      set('w', '');
      set('h', '');
      this.pickupType = this.selection.pickup.ability || this.pickupType;
      set('pickupType', this.pickupType);
    } else if (this.selection.type === 'gate') {
      set('id', this.selection.gate.id);
      set('fromRoomId', this.selection.gate.fromRoomId || '');
      set('toRoomId', this.selection.gate.toRoomId || '');
      if (rect) {
        set('x', String(rect.x));
        set('y', String(rect.y));
        set('w', String(rect.w));
        set('h', String(rect.h));
      }
      this.gateKind = this.selection.gate.kind || this.gateKind;
      this.gateRequires = this.selection.gate.requireAbility || '';
      set('gateKind', this.gateKind);
      set('gateRequires', this.gateRequires);
    }
  }

  refreshHud() {
    if (!this.active) {
      this.hud.setText('');
      return;
    }
    const pointer = this.scene.input.activePointer;
    let roomId = this.scene.currentRoomId || '?';
    if (pointer) {
      const { x, y } = this.worldPoint(pointer);
      const under = findRoomAt(x, y, this.currentRooms());
      if (under) roomId = under.id;
    }
    const sel = this.selection
      ? `${this.selection.type}:${this.selection.solid?.id || this.selection.pickup?.id || this.selection.gate?.id || this.selection.room?.id}`
      : 'none';
    this.hud.setText(
      `EDIT ${this.tool.toUpperCase()}  grid ${this.grid}  room ${roomId}  sel ${sel}   Tab tool  G grid  Del erase  WASD walk  Shift+1-7 warp`
    );
  }

  drawOverlay() {
    const g = this.overlay;
    g.clear();
    if (!this.active) return;
    const cam = this.scene.cameras.main;
    const rooms = this.currentRooms();
    const view = { x: cam.scrollX, y: cam.scrollY, w: GAME_W, h: GAME_H };
    g.lineStyle(1, 0xb2ff59, 0.12);
    const startX = Math.floor(view.x / this.grid) * this.grid;
    const startY = Math.floor(view.y / this.grid) * this.grid;
    for (let x = startX; x <= view.x + view.w; x += this.grid) g.lineBetween(x, view.y, x, view.y + view.h);
    for (let y = startY; y <= view.y + view.h; y += this.grid) g.lineBetween(view.x, y, view.x + view.w, y);

    for (const room of rooms) {
      g.lineStyle(1, 0x81d4fa, 0.35);
      g.strokeRect(room.x, room.y, room.w, room.h);
    }
    for (const gate of getGates()) {
      if (!gate.world) continue;
      g.lineStyle(2, 0xffe082, 0.7);
      g.strokeRect(gate.world.x, gate.world.y, gate.world.w, gate.world.h);
    }

    const preview =
      this.drag?.mode === 'create'
        ? normalizeRect(this.drag.x0, this.drag.y0, this.drag.x1, this.drag.y1, this.grid)
        : this.drag?.preview || selectionWorldRect(this.selection, rooms);
    if (preview) {
      g.lineStyle(2, 0xb2ff59, 0.95);
      g.strokeRect(preview.x, preview.y, preview.w, preview.h);
      if (this.selection && this.selection.type !== 'pickup') {
        g.fillStyle(0xb2ff59, 0.9);
        const hs = HANDLE_SIZE / 2;
        for (const [hx, hy] of [
          [preview.x, preview.y],
          [preview.x + preview.w, preview.y],
          [preview.x, preview.y + preview.h],
          [preview.x + preview.w, preview.y + preview.h],
        ]) {
          g.fillRect(hx - hs, hy - hs, HANDLE_SIZE, HANDLE_SIZE);
        }
      }
    }
  }

  update() {
    if (!this.active) return;
    this.refreshHud();
    if (!this.drag) this.drawOverlay();
  }

  destroy() {
    this.scene.input.off('pointerdown', this.boundDown);
    this.scene.input.off('pointermove', this.boundMove);
    this.scene.input.off('pointerup', this.boundUp);
    this.overlay.destroy();
    this.hud.destroy();
    this.dom?.remove();
  }
}
