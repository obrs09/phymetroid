# Metroidvania Phaser Prototype / 银河战士式 Phaser 原型

Phaser 3 + Vite indie prototype: floating start → gravity pickup → walk/jump → room-snapping camera.

Phaser 3 + Vite 独立游戏原型：漂浮开场 → 重力拾取 → 行走跳跃 → 房间相机切换。

## How to play / 操作

| Key / 按键 | Action / 作用 |
|---|---|
| A / D or ← → | Move left/right **after** gravity / 重力开启后左右移动 |
| W / Space / ↑ | Jump when grounded **after** gravity / 重力开启且着地后跳跃 |
| M | Room map overlay / 房间地图 |
| F | Toggle browser Fullscreen API on the game container (Esc exits). F11 is the browser's own chrome fullscreen and also relayouts. / 游戏容器全屏（Esc 退出）。F11 仍是浏览器全屏，同样会重算缩放。 |
| 9 / 0 | Debug: take 1 damage / heal 1 HP (death stub respawns HP; abilities stay). / 调试：受伤 / 回血（倒下后回满 HP，能力保留） |
| F1 or `` ` `` (backtick) | Toggle feel debugger (pauses physics). If F1 opens browser help, use backtick. / 开关手感调试（暂停物理）。若 F1 被浏览器抢走，用反引号。 |
| ↑ ↓ (debugger open) | Select feel field / 选择手感参数 |
| `[` `]` or `-` `=` or ← → | Adjust selected field; hold **Shift** for a larger step / 调整数值，Shift 大步进 |
| Click row / `+` `-` | Select field or nudge with the mouse / 鼠标选中或加减 |
| E (debugger open) | Export design JSON (download + clipboard) / 导出策划 JSON |
| R (debugger open) | Reset feel values to defaults / 恢复默认手感 |

**Before gravity:** player floats; no walk/jump (only a gentle air nudge with A/D to reach the yellow pickup). Touch pickup → unlocks ability `gravity`, phase `intro` → `exploration`, and `GRAVITY ON`.

**重力开启前：** 角色漂浮，不能正常行走/跳跃（仅可用 A/D 轻微空中挪动去碰黄色拾取物）。触碰后解锁能力 `gravity`，阶段从 `intro` 进入 `exploration`，并显示 `GRAVITY ON`。

The compact HUD (top-left / top-right) always shows **HP hearts (default 3/3)**, current **phase**, ability chips (`[GRAV]` once unlocked; `jump` / `dash` stubs), and an item summary. F1 / M overlays hide it so they do not fight.

左上/右上常驻 HUD：HP 心（默认 3/3）、阶段、能力芯片、物品摘要。F1 / M 打开时隐藏，避免叠在调试层上。

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

Tuned toward Metroid-like weight at **640×360**. Pixel velocities are **2×** the original 320×180 defaults so hang time (`|jumpVelocity| / gravityY`), room-cross time, and platform clearance stay the same after the layout scale. Time / ratio keys are unchanged.

偏银河战士重量，按 640×360 像素速度加倍：悬空时间、过房间时间、平台净空与原先 320×180 手感一致。时间/比例键未改。

| Key | 320×180 (old) | 640×360 (new) |
|---|---|---|
| `moveSpeed` | 110 | **220** |
| `airControl` | 0.85 | 0.85 |
| `jumpVelocity` | -275 | **-550** |
| `jumpCutMultiplier` | 0.45 | 0.45 |
| `gravityY` | 980 | **1960** |
| `maxFallSpeed` | 320 | **640** |
| `coyoteMs` | 90 | 90 |
| `jumpBufferMs` | 100 | 100 |
| `floatNudge` | 28 | **56** |

Arcade check: jump apex `v² / 2g` was ~38.6px (clears the 24px block); now ~77.2px (clears the 48px block). Apex time `v / g` stays ~0.28s.

Pre-640×360 `localStorage` feel dumps (no `logicalW`/`logicalH`) are ignored so old pixel speeds do not load onto the new world. Press **R** in the debugger to reset feel + player/progress **design defaults** (live run HP / unlocked gravity is not wiped).

旧版 localStorage（没有逻辑分辨率标记）会被忽略，避免把 320 速度套到 640 世界上。**R** 只重置策划默认，不会清掉本局已解锁的重力。

Live values live in `src/designConfig.js` (`getFeel()` / `applyFeel(patch)`). Opening the F1 panel lists every feel field; changing a value applies immediately (if gravity is already on, `gravityY` updates `physics.world.gravity.y` and max fall speed). Tweaks persist in `localStorage` under `phymetroid.designConfig` until you press **R** to reset.

手感数值集中在 `src/designConfig.js`。F1 面板可即时改跳/走/重力；重力已开启时改 `gravityY` 会立刻改世界重力。调整会写入 `localStorage`，**R** 清回默认。

## Design JSON / 策划 bot 契约

**E** while the debugger is open downloads `phymetroid-design-YYYYMMDD-HHmmss.json` (also copies to the clipboard when the browser allows). Stable shape for a future 策划 bot:

F1 调试打开时按 **E** 下载该 JSON（并尽量复制到剪贴板）。给未来策划 bot 的稳定结构：

```json
{
  "schemaVersion": 2,
  "game": "phymetroid",
  "exportedAt": "2026-09-19T10:30:00.000Z",
  "sections": {
    "feel": {
      "moveSpeed": 220,
      "airControl": 0.85,
      "jumpVelocity": -550,
      "jumpCutMultiplier": 0.45,
      "gravityY": 1960,
      "maxFallSpeed": 640,
      "coyoteMs": 90,
      "jumpBufferMs": 100,
      "floatNudge": 56
    },
    "player": {
      "maxHp": 3,
      "startingHp": 3,
      "startingAbilities": [],
      "startingItems": {}
    },
    "progress": {
      "defaultPhase": "intro",
      "phaseAfterGravity": "exploration",
      "phaseLabels": {
        "intro": "INTRO",
        "exploration": "EXPLORE",
        "boss": "BOSS"
      }
    }
  }
}
```

**Compatibility / 兼容：** `schemaVersion` 2. A v1 `{ sections: { feel } }` dump still applies; `player` / `progress` are merged only when present. v1 importers that only read `sections.feel` can ignore the new keys.

v1 只有 `feel` 的 JSON 仍可导入；新字段缺省则保持当前值。只读 `feel` 的旧导入器可安全忽略 `player` / `progress`。

Keys are **camelCase**. Feel mapping: `moveSpeed` walk speed, `airControl` airborne fraction of walk speed, `jumpVelocity` upward impulse (negative = up), `jumpCutMultiplier` early-release keep ratio, `gravityY` Arcade gravity after pickup, `maxFallSpeed` max vy, `coyoteMs` / `jumpBufferMs` jump forgiveness, `floatNudge` pre-gravity A/D nudge.

`sections.player` is **design defaults** (max hearts, starting kit), not live HP. `sections.progress` is phase labels / default phase. Live run state (current HP, unlocked abilities, visited rooms, flags, deaths) is `src/runState.js` — `window.__PHYMETROID_GET_RUN__()`.

`sections.player` 是策划默认（最大心数、开局能力/物品），不是本局 HP。本局状态在 `src/runState.js`。

**Import (minimal, no file picker):**

- Boot: if `localStorage['phymetroid.designConfig']` is valid JSON, it is applied.
- Console / bot: `window.__PHYMETROID_APPLY_DESIGN__(objOrJsonString)` or `applyDesignConfig(obj)` from `src/designConfig.js`.
- `window.__PHYMETROID_GET_DESIGN__()` returns the current export payload.
- `window.__PHYMETROID_GET_RUN__()` returns the live run snapshot (hp, abilities, items, phase, flags, visitedRooms, deaths).
- `window.__PHYMETROID_TOGGLE_FULLSCREEN__()` toggles the Fullscreen API.

导入先保持最小：启动读 localStorage；程序用上面的全局函数。完整文件选择器留给以后的策划 bot。

Applying `{ sections: { player: { startingAbilities: ["gravity"] } } }` unions `gravity` into the live run and turns world gravity on (single source of truth). Changing `maxHp` clamps current HP.

写入 `startingAbilities: ["gravity"]` 会并入本局能力并开重力；改 `maxHp` 会钳制当前 HP。

## Display / 显示

Logical size **640×360** (exact 2× of 320×180, same 16:9). Display is **integer zoom first** (`Scale.NONE` + `computeIntegerZoom` — never Phaser `Scale.FIT` fractional canvas zoom), then a leftover **CSS fill** (`transform: scale` + `image-rendering: pixelated`) so a typical laptop window and browser fullscreen read as full-window without blurring the game bitmap. Thin letterbox remains only when the window aspect is not 16:9. `#game-container` owns the viewport (`html`/`body` 100dvh, no leftover page chrome). **F** requests Fullscreen API on that container; resize / fullscreenchange recomputes zoom + fill.

逻辑分辨率 **640×360**。先取能放下的最大整数倍，再用 CSS 像素化拉伸吃掉剩余边距，避免 Phaser FIT 把画布做成分数缩放发糊。非 16:9 窗口仍会有细黑边。**F** 全屏后会重算。

HUD / debugger / map labels use Courier New monospace at 14–20px (2× the old 7–10px), rasterized at `resolution` ≥ 2 with a linear texture filter (`src/hudText.js`) so glyph AA is not nearest-neighbor magnified by `pixelArt`. Sprites stay NEAREST.

## Docs sync / Pages 源同步

GitHub Pages serves `docs/` only. After changing game logic under `src/`:

```bash
npm run docs:sync
```

This copies shared modules into `docs/src/` and rewrites Phaser imports to the UMD shim.

改 `src/` 后请运行 `npm run docs:sync`，再提交，以免 Pages 与本地 Vite 逻辑分叉。

## Tech / 技术

- Phaser **3.80+**, Arcade Physics (AABB)
- Logical resolution **640×360**, `Scale.NONE` + integer zoom + leftover CSS fill + `pixelArt` / `roundPixels`
- Live run state: `src/runState.js` (HP 3/3 hearts, abilities, items, phase, flags)
- Rooms data: `src/rooms.js` (`WORLD_SCALE` / `px()` map the original 320×180 layout)

## Project layout / 目录

```
src/main.js
src/scenes/GameScene.js
src/rooms.js
src/player.js
src/runState.js        # live HP / abilities / items / phase / flags
src/runHud.js          # compact always-on run HUD
src/viewport.js        # integer zoom + CSS fill + F fullscreen
src/scaleZoom.js       # computeIntegerZoom / leftover CSS fill
src/designConfig.js    # feel + player/progress design + export/import
src/feelDebugPanel.js  # F1 debugger UI
src/hudText.js         # sharper HUD / debugger / map labels
docs/                  # GitHub Pages root (CDN + docs/src)
```
