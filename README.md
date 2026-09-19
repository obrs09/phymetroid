# Metroidvania Phaser Prototype / 银河战士式 Phaser 原型

Phaser 3 + Vite indie prototype: floating start → gravity pickup → walk/jump → room-snapping camera.

Phaser 3 + Vite 独立游戏原型：漂浮开场 → 重力拾取 → 行走跳跃 → 房间相机切换。

## How to play / 操作

| Key / 按键 | Action / 作用 |
|---|---|
| A / D or ← → | Move left/right **after** gravity / 重力开启后左右移动 |
| W / Space / ↑ | Jump when grounded **after** gravity / 重力开启且着地后跳跃 |
| M | Room map overlay / 房间地图 |
| F1 or `` ` `` (backtick) | Toggle feel debugger (pauses physics) / 开关手感调试（暂停物理） |
| ↑ ↓ (debugger open) | Select feel field / 选择手感参数 |
| `[` `]` or `-` `=` or ← → | Adjust selected field; hold **Shift** for a larger step / 调整数值，Shift 大步进 |
| Click row / `+` `-` | Select field or nudge with the mouse / 鼠标选中或加减 |
| E (debugger open) | Export design JSON (download + clipboard) / 导出策划 JSON |
| R (debugger open) | Reset feel values to defaults / 恢复默认手感 |

**Before gravity:** player floats; no walk/jump (only a gentle air nudge with A/D to reach the yellow pickup). Touch pickup → `GRAVITY ON`.

**重力开启前：** 角色漂浮，不能正常行走/跳跃（仅可用 A/D 轻微空中挪动去碰黄色拾取物）。触碰后显示 `GRAVITY ON`。

Explore rooms R0 → R1 → R2 (horizontal) and R3 (below R1). Camera snaps to the current room.

探索房间 R0 → R1 → R2（横向）以及 R3（R1 下方）。相机按房间吸附切换。

## Run locally / 本地运行

```bash
cd /home/box/games/metroidvania-phaser
npm install
npm run dev
```

Dev server: **http://localhost:5173/**

```bash
npm run build    # output in dist/
npm run preview  # preview production build
```

## GitHub Pages / GitHub Pages 部署

`/docs` is set up for Pages using **CDN Phaser** + `docs/src/` modules (import map). This avoids committing the ~1.5MB Vite bundle through the API connector.

`/docs` 使用 **CDN Phaser** + `docs/src/` 模块（import map），避免通过 API 连接器提交约 1.5MB 的 Vite 打包文件。

**Enable Pages / 开启步骤**

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **`main`** / folder: **`/docs`** → Save
4. Site URL (after a minute): https://obrs09.github.io/phymetroid/

Optional later: replace with `npm run build` output under `docs/` once you can `git push` a large `docs/assets/*.js`.

可选：本地 `git push` 可用后，再用 `npm run build` 产物覆盖 `docs/`。


## Feel / 手感

Tuned toward Metroid-like weight: gravity `980`, jump `-275`, move `110`, coyote `90ms`, jump buffer `100ms`, early jump release cuts upward speed (`0.45`). Pre-gravity A/D nudge is `28`.

偏银河战士重量：更重下落、可变跳跃高度、土狼时间与跳跃缓冲。重力拾取前可用 A/D 轻微挪动（默认 28）。

Live values live in `src/designConfig.js` (`getFeel()` / `applyFeel(patch)`). Opening the F1 panel lists every feel field; changing a value applies immediately (if gravity is already on, `gravityY` updates `physics.world.gravity.y` and max fall speed). Tweaks persist in `localStorage` under `phymetroid.designConfig` until you press **R** to reset.

手感数值集中在 `src/designConfig.js`。F1 面板可即时改跳/走/重力；重力已开启时改 `gravityY` 会立刻改世界重力。调整会写入 `localStorage`，**R** 清回默认。

## Design JSON / 策划 bot 契约

**E** while the debugger is open downloads `phymetroid-design-YYYYMMDD-HHmmss.json` (also copies to the clipboard when the browser allows). Stable shape for a future 策划 bot:

F1 调试打开时按 **E** 下载该 JSON（并尽量复制到剪贴板）。给未来策划 bot 的稳定结构：

```json
{
  "schemaVersion": 1,
  "game": "phymetroid",
  "exportedAt": "2026-09-19T04:30:00.000Z",
  "sections": {
    "feel": {
      "moveSpeed": 110,
      "airControl": 0.85,
      "jumpVelocity": -275,
      "jumpCutMultiplier": 0.45,
      "gravityY": 980,
      "maxFallSpeed": 320,
      "coyoteMs": 90,
      "jumpBufferMs": 100,
      "floatNudge": 28
    }
  }
}
```

Keys are **camelCase**. Mapping: `moveSpeed` walk speed, `airControl` airborne fraction of walk speed, `jumpVelocity` upward impulse (negative = up), `jumpCutMultiplier` early-release keep ratio, `gravityY` Arcade gravity after pickup, `maxFallSpeed` max vy, `coyoteMs` / `jumpBufferMs` jump forgiveness, `floatNudge` pre-gravity A/D nudge. Later sections (`rooms`, `pickups`, …) can sit next to `feel`.

键名一律 camelCase。日后 bot 还可在 `sections` 里加 `rooms` / `pickups` 等。

**Import (minimal, no file picker):**

- Boot: if `localStorage['phymetroid.designConfig']` is valid JSON, it is applied.
- Console / bot: `window.__PHYMETROID_APPLY_DESIGN__(objOrJsonString)` or `applyDesignConfig(obj)` from `src/designConfig.js`.
- `window.__PHYMETROID_GET_DESIGN__()` returns the current export payload.

导入先保持最小：启动读 localStorage；程序用上面的全局函数。完整文件选择器留给以后的策划 bot。

## Display / 显示

Logical size **320×180**, scaled with **integer zoom** (`Scale.NONE` + `computeIntegerZoom`) so pixel art stays sharp. Letterboxing appears when the window is not an exact multiple.

逻辑分辨率 **320×180**，使用**整数倍缩放**，避免 FIT 非整数放大导致发糊。

## Docs sync / Pages 源同步

GitHub Pages serves `docs/` only. After changing game logic under `src/`:

```bash
npm run docs:sync
```

This copies shared modules into `docs/src/` and rewrites Phaser imports to the UMD shim.

改 `src/` 后请运行 `npm run docs:sync`，再提交，以免 Pages 与本地 Vite 逻辑分叉。

## Tech / 技术

- Phaser **3.80+**, Arcade Physics (AABB)
- Logical resolution **320×180**, `Scale.FIT` + `autoCenter` + `pixelArt` / `roundPixels`
- Rooms data: `src/rooms.js`

## Project layout / 目录

```
src/main.js
src/scenes/GameScene.js
src/rooms.js
src/player.js
src/designConfig.js    # live feel + export/import
src/feelDebugPanel.js  # F1 debugger UI
docs/                  # GitHub Pages root (CDN + docs/src)
```
