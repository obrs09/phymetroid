# Metroidvania Phaser Prototype / 银河战士式 Phaser 原型

Phaser 3 + Vite indie prototype: floating start → **gravityFall** (falling body) → cardinal gravity vector → **surfaceWalk** in R4. Camera stays axis-aligned; only the gravity *vector* rotates.

Phaser 3 + Vite 独立游戏原型：漂浮开场 → **gravityFall**（落体）→ 四向重力矢量 → R4 **surfaceWalk**。只转重力矢量，镜头不转。

## How to play / 操作

| Key / 按键 | Action / 作用 |
|---|---|
| A / D or ← → | Walk along current gravity **after surfaceWalk** (tangent to down). No ground walk on gravityFall alone. / 仅 **surfaceWalk** 后沿当前 down 的切向行走。只有 gravityFall 时不能走。 |
| W / Space / ↑ | Jump — **requires reactionJump** (stub this iteration; no pickup). / 跳跃需要 **reactionJump**（本迭代仅数据桩，无拾取）。 |
| Q / E | Rotate gravity down 90° CCW / CW when **grounded** (air-locked after gravityFall). Debugger-open **E** still exports JSON. / 着地时逆/顺时针转 90°。空中锁定。调试开着时 E 仍是导出。 |
| I / J / K / L | Set down to **up / left / down / right** when grounded. / 着地时把 down 设为 上/左/下/右。 |
| M | Room map overlay / 房间地图 |
| F | Toggle browser Fullscreen API on the game container (Esc exits). F11 is the browser's own chrome fullscreen and also relayouts. / 游戏容器全屏（Esc 退出）。F11 仍是浏览器全屏，同样会重算缩放。 |
| 9 / 0 | Debug: take 1 damage / heal 1 HP (death stub respawns HP; abilities stay). / 调试：受伤 / 回血（倒下后回满 HP，能力保留） |
| F1 or `` ` `` (backtick) | Toggle feel debugger (pauses physics). If F1 opens browser help, use backtick. / 开关手感调试（暂停物理）。若 F1 被浏览器抢走，用反引号。 |
| ↑ ↓ (debugger open) | Select feel field / 选择手感参数 |
| `[` `]` or `-` `=` or ← → | Adjust selected field; hold **Shift** for a larger step / 调整数值，Shift 大步进 |
| Click row / `+` `-` | Select field or nudge with the mouse / 鼠标选中或加减 |
| E (debugger open) | Export design JSON (download + clipboard) / 导出策划 JSON |
| R (debugger open) | Reset feel values to defaults / 恢复默认手感 |

**Before gravityFall:** player floats; no walk/jump (only a gentle air nudge with A/D to reach the yellow orb). Touch it → unlocks `gravityFall` (legacy id `gravity` maps on import), snaps down to **down**, phase `intro` → `exploration`, banner `GRAVITY ON`. You are a **falling body**: no walk, jump, wall-slide, ceiling crawl, or fly. Change cardinal down only while supported.

**gravityFall 前：** 角色漂浮，不能走/跳（仅 A/D 轻挪去碰黄色球）。拾取后解锁 `gravityFall`（旧 id `gravity` 导入时映射），down 吸附为下，阶段 `intro` → `exploration`。此时是落体：不能走/跳/滑墙。仅着地时可改四向重力。

**surfaceWalk (teal orb in R4 at 1320, −320):** walk with friction along current down + wall slide. Still no jump. Phase → `frictionLesson`. `reactionJump` / `gravityField` exist in design data only (no pickups this iteration).

**surfaceWalk（R4 青色球）：** 沿当前 down 摩擦行走 + 滑墙，仍不能跳。阶段进入 `frictionLesson`。`reactionJump` / `gravityField` 仅数据桩。

The compact HUD (top-left / top-right) always shows **HP hearts (default 3/3)**, current **phase**, ability chips (`[FALL]` / `[WALK]` / jump / field stubs), current **DOWN** axis after gravityFall (tiny `↓↑←→` glyph), and an item summary. Changing down (Q/E, IJKL, or the gravityFall snap) **flashes a screen-space down-arrow** for ~0.55s — camera stays unrotated. F1 / M overlays hide the compact HUD so they do not fight.

左上/右上常驻 HUD：HP 心、阶段、能力芯片（FALL / WALK / jump / field）、当前 DOWN（小箭头）、物品摘要。改重力方向时屏幕中央会闪一下 down 箭头（约 0.55s），镜头不转。F1 / M 打开时隐藏常驻 HUD。

Explore R0 → R1 → R2 (horizontal; the room joins at x=640 and x=1280 are an open corridor — floor/ceiling slabs are merged so I-mode does not ghost-block on the seam), legacy **R3 under R1** at (640, 360), and new friction room **R4 above R2** at (1280, −360). M-map includes negative Y and, for **visited** rooms, pickup icons (G gravity / W walk), gate marks (R2↑R4, R1↓R3), and a short role hint. Unexplored rooms stay dim and spoiler-free. Camera room-snaps (never rotates) into R4 through ceiling gate `gate_R2_to_R4` at (1520, 0, 80×16) — flip down to **up** while standing under the hole.

房间：R0→R1→R2 是打通的横走廊（房间接缝处地板/天花板并成一块，避免 Arcade 把缝当成墙）。旧 R3 仍在 R1 下方 (640, 360)，新摩擦房 **R4 在 R2 正上方** (1280, −360)。已访问房间的 M 地图会标出拾取、门和房间角色；未探索房间保持暗、不剧透。R2 把 down 翻成 up，从天花板门落入 R4。镜头不转。

**Success path:** R0 float → yellow orb → gravityFall → reach R2 via cardinal gravity (fall right, catch the pillar under the gate, flip down) → set down = up → fall into R4 → teal orb → surfaceWalk → walk/slide.

**成功路径：** R0 漂浮 → 黄球 → gravityFall → 四向重力到 R2（向右落、在门下立柱着地、再翻 down）→ down=up 落入 R4 → 青球 → surfaceWalk → 走/滑。

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

Live values live in `src/designConfig.js` (`getFeel()` / `applyFeel(patch)`). Opening the F1 panel lists every feel field (**keys unchanged**); changing a value applies immediately. After gravityFall, `gravityY` is the **vector magnitude** applied as Arcade `world.gravity` on the current down axis (camera is not rotated). Tweaks persist in `localStorage` under `phymetroid.designConfig` until you press **R** to reset.

手感数值集中在 `src/designConfig.js`。F1 手感键未改。重力开启后 `gravityY` 是矢量大小，沿当前 down 写入 Arcade 世界重力，镜头不转。调整写入 `localStorage`，**R** 清回默认。

## Design JSON / 策划 bot 契约

**E** while the debugger is open downloads `phymetroid-design-YYYYMMDD-HHmmss.json` (also copies to the clipboard when the browser allows). Stable shape for a future 策划 bot:

F1 调试打开时按 **E** 下载该 JSON（并尽量复制到剪贴板）。给未来策划 bot 的稳定结构：

```json
{
  "schemaVersion": 4,
  "game": "phymetroid",
  "logicalW": 640,
  "logicalH": 360,
  "worldScale": 2,
  "sections": {
    "feel": { "moveSpeed": 220, "gravityY": 1960 },
    "gravity": { "rotateVectorOnly": true, "rotateCamera": false, "defaultDown": "down" },
    "abilities": { "gravityFall": { "tier": "I" }, "surfaceWalk": { "tier": "II" } },
    "player": { "maxHp": 3, "startingAbilities": [], "abilityUnlockOrder": ["gravityFall", "surfaceWalk", "reactionJump", "gravityField"] },
    "progress": { "abilityPhases": { "gravityFall": "exploration", "surfaceWalk": "frictionLesson" }, "pathIntent": {} },
    "rooms": [{
      "id": "R4", "x": 1280, "y": -360, "w": 640, "h": 360,
      "solids": [{ "id": "R4_floor", "kind": "floor", "space": "local", "x": 0, "y": 328, "w": 640, "h": 32, "gapGateId": "gate_R2_to_R4" }]
    }],
    "pickups": [{ "id": "surfaceWalkOrb", "ability": "surfaceWalk", "roomId": "R4", "x": 1320, "y": -320 }],
    "gates": [{ "id": "gate_R2_to_R4", "fromRoomId": "R2", "toRoomId": "R4", "world": { "x": 1520, "y": 0, "w": 80, "h": 16 } }]
  }
}
```

**Compatibility / 兼容：** `schemaVersion` 4. v1 `{ sections: { feel } }`, v2 player/progress, and v3 rooms-without-solids dumps still apply; missing sections keep current values. If `rooms[i].solids` is empty, the engine falls back to the v3 hardcoded layout in `worldSolids.js`. Pixel feel numbers are already 640×360 (WORLD_SCALE×2) — **do not re-scale**. Legacy `"gravity"` in `startingAbilities` / unlock lists maps to `"gravityFall"`. Feel debugger keys are unchanged. Older importers that only read `sections.feel` can ignore the new keys.

Default Pages boot embeds `src/design/default-v4.json` (no manual paste). Solids default to `space: "local"` (world = room origin + xy). `space: "world"` is used as-is (R2 doorframe). `gapGateId` cuts a hole only when that gate has a `world` rect (`gate_R2_to_R4`). `gate_R1_to_R3` has no world — R1→R3 openings are the pits between `R1_floorA/B/C`. Shared R0|R1|R2 corridor walls stay omitted; the engine still merges abutting corridor slabs and skips join-seal ghost walls.

v1 / v2 仍可导入；手感像素值已是 640×360，不要再乘 2。旧能力 id `gravity` 会映射成 `gravityFall`。

Keys are **camelCase**. Feel mapping: `moveSpeed` walk speed, `airControl` airborne fraction of walk speed, `jumpVelocity` upward impulse (negative = up), `jumpCutMultiplier` early-release keep ratio, `gravityY` Arcade gravity after pickup, `maxFallSpeed` max vy, `coyoteMs` / `jumpBufferMs` jump forgiveness, `floatNudge` pre-gravity A/D nudge.

`sections.player` is **design defaults** (max hearts, starting kit), not live HP. `sections.progress` is phase labels / default phase. Live run state (current HP, unlocked abilities, visited rooms, flags, deaths) is `src/runState.js` — `window.__PHYMETROID_GET_RUN__()`.

`sections.player` 是策划默认（最大心数、开局能力/物品），不是本局 HP。本局状态在 `src/runState.js`。

**Import (minimal, no file picker):**

- Boot: if `localStorage['phymetroid.designConfig']` is valid JSON, it is applied.
- Console / bot: `window.__PHYMETROID_APPLY_DESIGN__(objOrJsonString)` or `applyDesignConfig(obj)` from `src/designConfig.js`.
- `window.__PHYMETROID_GET_DESIGN__()` returns the current export payload.
- `window.__PHYMETROID_GET_RUN__()` returns the live run snapshot (hp, abilities, items, phase, flags, visitedRooms, deaths, gravityDown).
- `window.__PHYMETROID_DEBUG__` — `{ pos, warp, setDown, camRotation, toggleFeel, toggleMap }` for console / bot checks. `camRotation()` stays `0`.
- `window.__PHYMETROID_TOGGLE_FULLSCREEN__()` toggles the Fullscreen API.

导入先保持最小：启动读 localStorage；程序用上面的全局函数。完整文件选择器留给以后的策划 bot。

Applying `{ sections: { player: { startingAbilities: ["gravity"] } } }` maps to `gravityFall`, unions it into the live run, and turns the gravity **vector** on (default down). `startingAbilities: ["gravityFall"]` is the v3 spelling. Changing `maxHp` clamps current HP.

写入旧 id `"gravity"` 或 `"gravityFall"` 都会并入本局并打开重力矢量；改 `maxHp` 会钳制当前 HP。

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
- Live run state: `src/runState.js` (HP, abilities, gravity down, items, phase, flags)
- Gravity vector: `src/gravity.js` (cardinal snap, Arcade accel, no camera rotate)
- Rooms data: `src/rooms.js` (`WORLD_SCALE` / `px()`; R4 at y = −360)

## Project layout / 目录

```
src/main.js
src/scenes/GameScene.js
src/rooms.js
src/gravity.js         # gravity vector (not camera)
src/worldSolids.js     # data-driven solids (v4) + v3 hardcode fallback + open R0–R2 corridor
src/design/default-v4.json  # baked schemaVersion 4 dump
src/mapContents.js     # M-map pickup / gate / role descriptors
src/gravityFlash.js    # screen-space down-arrow flash on gravity change
src/player.js
src/runState.js        # live HP / abilities / gravity down / items / phase
src/runHud.js          # compact always-on run HUD
src/viewport.js        # integer zoom + CSS fill + F fullscreen
src/scaleZoom.js       # computeIntegerZoom / leftover CSS fill
src/designConfig.js    # feel + player/progress design + export/import
src/feelDebugPanel.js  # F1 debugger UI
src/hudText.js         # sharper HUD / debugger / map labels
docs/                  # GitHub Pages root (CDN + docs/src)
```
