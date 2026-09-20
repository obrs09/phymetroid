# Metroidvania Phaser Prototype / 银河战士式 Phaser 原型

Phaser 3 + Vite indie prototype: floating start → **gravityFall** (falling body) → cardinal gravity → **surfaceWalk** in R4 → **reactionJump** in R5 → **gravityField** in R6. Camera stays axis-aligned; only the gravity *vector* rotates.

Phaser 3 + Vite 独立游戏原型：漂浮开场 → **gravityFall**（落体）→ 四向重力 → R4 **surfaceWalk** → R5 **reactionJump** → R6 **gravityField**。只转重力矢量，镜头不转。

## How to play / 操作

| Key / 按键 | Action / 作用 |
|---|---|
| A / D or ← → | Walk along current gravity **after surfaceWalk** (tangent to down). No ground walk on gravityFall alone. / 仅 **surfaceWalk** 后沿当前 down 的切向行走。只有 gravityFall 时不能走。 |
| W / Space / ↑ | Jump — **requires reactionJump** (R5 orange orb). Uses feel `jumpVelocity` / `jumpCutMultiplier` / `coyoteMs` / `jumpBufferMs`. Wall-jump while sliding. / 跳跃需要 **reactionJump**（R5 橙球）。手感 jump/cut/coyote/buffer 从此生效；滑墙时可墙跳。 |
| Q / E | Rotate gravity. Before **gravityField**: 90° CCW / CW when **grounded** (air-locked). After field: 45° any time (hold **Shift** for 15°). Debugger-open **E** still exports JSON. / 转重力。Field 前着地 90°、空中锁定；Field 后随时 45°（Shift=15°）。调试开着时 E 仍是导出。 |
| I / J / K / L | Set down to **up / left / down / right** (grounded until gravityField; then also in air). / 设为四向。Field 前需着地，之后空中也可。 |
| `[` `]` | After **gravityField**: nudge `gravityY` magnitude (F1 feel key unchanged). / Field 后微调重力大小。 |
| M | Room map overlay / 房间地图 |
| F | Toggle browser Fullscreen API on the game container (Esc exits). F11 is the browser's own chrome fullscreen and also relayouts. / 游戏容器全屏（Esc 退出）。F11 仍是浏览器全屏，同样会重算缩放。 |
| 9 / 0 | Debug: take 1 damage / heal 1 HP (death stub respawns HP; abilities stay). / 调试：受伤 / 回血（倒下后回满 HP，能力保留） |
| F1 or `` ` `` (backtick) | Toggle feel debugger (pauses physics). If F1 opens browser help, use backtick. / 开关手感调试（暂停物理）。若 F1 被浏览器抢走，用反引号。 |
| 1–4 (debugger open) | Toggle grant/revoke `gravityFall` / `surfaceWalk` / `reactionJump` / `gravityField`. / 调试：授予或撤销能力 |
| Shift+1–7 (debugger open) | Warp to R0–R6 (safe spawn, camera snap). / 调试：传送到房间 |
| ↑ ↓ (debugger open) | Select feel field / 选择手感参数 |
| `[` `]` or `-` `=` or ← → | Adjust selected field; hold **Shift** for a larger step / 调整数值，Shift 大步进 |
| Click row / `+` `-` | Select field or nudge with the mouse / 鼠标选中或加减 |
| E (debugger open) | Export design JSON (download + clipboard) / 导出策划 JSON |
| R (debugger open) | Reset feel + layout draft to bundled default / 恢复默认手感与关卡草稿 |
| LEVEL EDIT (debugger open) | Toggle in-game room/wall/pickup/gate editor / 开关关卡编辑 |

**Before gravityFall:** player floats; no walk/jump (only a gentle air nudge with A/D to reach the yellow orb). Touch it → unlocks `gravityFall` (legacy id `gravity` maps on import), snaps down to **down**, phase `intro` → `exploration`, banner `GRAVITY ON`. You are a **falling body**: no walk, jump, wall-slide, ceiling crawl, or fly. Change cardinal down only while supported.

**gravityFall 前：** 角色漂浮，不能走/跳（仅 A/D 轻挪去碰黄色球）。拾取后解锁 `gravityFall`（旧 id `gravity` 导入时映射），down 吸附为下，阶段 `intro` → `exploration`。此时是落体：不能走/跳/滑墙。仅着地时可改四向重力。

**surfaceWalk (teal orb in R4 at 1320, −320):** walk with friction along current down + wall slide. Still no jump. Phase → `frictionLesson`. Return to R2 and walk east into R5.

**surfaceWalk（R4 青色球）：** 沿当前 down 摩擦行走 + 滑墙，仍不能跳。阶段进入 `frictionLesson`。回 R2 右走进入 R5。

**reactionJump (orange orb in R5 at 2000, 220):** jump + wall-jump. Phase → `jumpLesson`. Soft jump gate `gate_R5_mustJump` world `(2120, 328, 160, 32)` — jump the floor gap toward R6; gravity-flipping also works.

**reactionJump（R5 橙球）：** 跳跃 + 墙跳。阶段 `jumpLesson`。地板缺口是跳跃软门。

**gravityField (purple orb in R6 at 2880, 120):** arbitrary down (45° steps, Shift+Q/E = 15°), change in air, `[` `]` tweaks magnitude. Camera still does **not** rotate. Phase stays `exploration` (dump stub).

**gravityField（R6 紫球）：** 任意角 down（45° / Shift 15°），空中可改；`[` `]` 调 g。镜头不转。

The compact HUD (top-left / top-right) always shows **HP hearts (default 3/3)**, current **phase**, ability chips (`[FALL]` / `[WALK]` / `[JUMP]` / `[FIELD]` when unlocked), current **DOWN** (cardinal `↓↑←→` or a diagonal + degrees after gravityField), and an item summary. Changing down **flashes a screen-space down-arrow** for ~0.55s — camera stays unrotated. F1 / M overlays hide the compact HUD so they do not fight.

左上/右上常驻 HUD：HP 心、阶段、能力芯片（FALL / WALK / JUMP / FIELD）、当前 DOWN（小箭头或角度）、物品摘要。改重力方向时屏幕中央会闪一下 down 箭头（约 0.55s），镜头不转。F1 / M 打开时隐藏常驻 HUD。

Explore R0 → R1 → R2 (horizontal; the room joins at x=640 and x=1280 are an open corridor — floor/ceiling slabs are merged so I-mode does not ghost-block on the seam), legacy **R3 under R1** at (640, 360), friction room **R4 above R2** at (1280, −360), jump room **R5** at (1920, 0), and field room **R6** at (2560, 0) on the Y=0 corridor. M-map includes negative Y and, for **visited** rooms, pickup icons (G gravity / W walk / J jump / F field), gate marks (R2↑R4, R2→R5, R5 jump-gap, R5→R6, R1↓R3), and a short role hint. Unexplored rooms stay dim and spoiler-free. Camera room-snaps (never rotates) into R4 through ceiling gate `gate_R2_to_R4` at (1520, 0, 80×16) — flip down to **up** while standing under the hole.

房间：R0→R1→R2 是打通的横走廊。旧 R3 在 R1 下方 (640, 360)。**R4** 在 R2 正上方 (1280, −360)，**R5** (1920, 0) 教跳，**R6** (2560, 0) 教任意角场。已访问房间的 M 地图会标出拾取、门和房间角色；未探索房间保持暗、不剧透。镜头不转。

**Success path:** R0 float → yellow orb → gravityFall → reach R2 via cardinal gravity (fall right, catch the **short** stub on the right edge of the ceiling gate — not a mid-room wall) → set down = up → fall into R4 → teal orb → surfaceWalk → return to R2 → walk east into R5 → orange orb `(2000, 220)` → reactionJump → jump the floor gap `(2120, 328, 160×32)` → R6 purple orb `(2880, 120)` → gravityField.

**成功路径：** R0 漂浮 → 黄球 → gravityFall → 四向重力到 R2（向右落、在门洞右侧短立柱着地）→ down=up 落入 R4 → 青球 → surfaceWalk → 回 R2 右走入 R5 → 橙球 (2000,220) → 跳过地板缺口 → R6 紫球 (2880,120) → gravityField。

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

## Level editor / 关卡编辑（F1）

Open the feel debugger (**F1** / `` ` ``), then click **LEVEL EDIT: OFF** (top-right of the panel) to turn the in-game editor on.

打开手感调试后，点面板右上角 **LEVEL EDIT** 即可边玩边摆房间。

1. Editor mode shrinks the F1 overlay so the world stays visible. Physics stays **live** (walk / jump / existing Shift+1–7 warps); gravity rotate (Q/E) stays blocked while the debugger is open.
2. Bottom strip tools: **Select | Room | Wall | Pickup | Gate | Delete**. Click-drag rooms / walls / gates (axis-aligned, snap **8** or **16**, hold **Alt** to place freely). Click to place an ability orb. Select + drag moves; corner handles stay large in screen pixels; **Del** deletes. **Ctrl+Z** / **Cmd+Z** undo, **Ctrl+Y** / **Ctrl+Shift+Z** redo (about 40 edits).
3. Room ids auto-increment (`R7`, `R8`…). Solids are stored **local** to the current room (`space: "local"`), matching `default-v4.json`. Optional `gapGateId` on a wall. Pickups use the same ability strings as the dump (`gravityFall` / `surfaceWalk` / `reactionJump` / `gravityField`) plus the default `requires` / `onCollect` for that orb. Gates use `fromRoomId` / `toRoomId` / `kind` / `requireAbility` / optional `world`.
4. Each finished edit **Apply**s through `applyDesignConfig` (same path as a 策划 dump) and rebuilds solids / pickups / gates immediately. Geometry commits omit `sections.feel` so F1 feel numbers stay untouched. Renaming a room id retargets `pickups.roomId` and gate `fromRoomId`/`toRoomId`. Empty rooms still export `"solids": []`. Drafts persist in `localStorage` key `phymetroid.designConfig`. **Reset to bundled default** (or **R**) clears the draft.
5. **Copy level JSON** / **Download level JSON** dump the **full** schemaVersion 4 contract (rooms + solids + pickups + gates + feel + `layoutRevision`). **E** is still the existing feel/design export — same payload, not broken. Export **sets** `layoutRevision` to the current contract (**5**); it does **not** bump the constant per edit. Only incompatible baked-solid migrations bump that number.

While Level edit is on the canvas switches to a **high-DPI backing store** (container CSS size × `devicePixelRatio`; Scale Manager zoom `1/dpr`) so walls and handles stay crisp. Editor coordinates stay in the existing **640×360 world**. Wheel zooms toward the cursor (0.5×–4×). Middle-mouse drag or **Space+drag** pans. Double-click middle, **Fit room**, or **Fit all** frames the view; **1:1** is one world pixel per CSS pixel. Leaving the editor restores integer-zoom play scale and the room-snap camera.

LEVEL EDIT 打开时画布按容器 CSS × DPR 提高 backing store（逻辑坐标仍是 640×360）。滚轮对准光标缩放，中键或 **Space+拖拽**平移，**Fit / 1:1** 复位。关掉编辑后恢复整数倍缩放和房间吸附镜头。

Hotkeys while Level edit is on: **Tab** cycle tool, **G** cycle snap 8/16, **Alt** no-snap, wheel zoom, MMB/Space pan, **Ctrl+Z** undo, **Del** erase, **1–4** / **Shift+1–7** cheats still work (ignored while typing in a strip field). Camera never rotates.

Do **not** bake corridor-join slabs as solids — shared R0–R2–R5–R6 walls stay an engine pass.

给数值策划：F1 → LEVEL EDIT → 摆好后 Copy/Download JSON，直接喂现有 designConfig 导入。

## Design JSON / 策划 bot 契约

**E** while the debugger is open downloads `phymetroid-design-YYYYMMDD-HHmmss.json` (also copies to the clipboard when the browser allows). Stable shape for a future 策划 bot:

F1 调试打开时按 **E** 下载该 JSON（并尽量复制到剪贴板）。给未来策划 bot 的稳定结构：

```json
{
  "schemaVersion": 4,
    "layoutRevision": 5,
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

**Compatibility / 兼容：** `schemaVersion` 4, `layoutRevision` 5. v1 `{ sections: { feel } }`, v2 player/progress, and v3 rooms-without-solids dumps still apply; missing sections keep current values. If `rooms[i].solids` is **omitted**, the engine falls back to the v3 hardcoded layout in `worldSolids.js`. An explicit empty array (`"solids": []`) is kept on import/export and is a data-driven empty room — never dropped, never replaced by the hardcode. Pixel feel numbers are already 640×360 (WORLD_SCALE×2) — **do not re-scale**. Legacy `"gravity"` in `startingAbilities` / unlock lists maps to `"gravityFall"`. Feel debugger keys are unchanged. Geometry-only editor commits (`commitLayout`) do **not** rewrite `sections.feel`. Unknown `solid.kind` exports as `custom` (rect kept). `gapGateId` is warned and stripped unless it names an existing `gates[].id` that already has `world` (floorGap `gate_R1_to_R3` does not invent a world just to dig). Older importers that only read `sections.feel` can ignore the new keys. A stored v4 dump with the old full-height `R2_doorframe`, R3 ceilings `0–200` / `440–640`, invented R5/R6 at `y=-360`, leftover `gate_R4_to_R5`, or missing R5/R6 rooms/orbs is migrated on boot (`layoutRevision` 5).

Default Pages boot embeds `src/design/default-v4.json` (no manual paste). Solids default to `space: "local"` (world = room origin + xy). `space: "world"` is allowed for cross-room pieces. `R2_doorframe` is a short catch stub at the right edge of `gate_R2_to_R4` (local `(320, 264, 24, 64)` → world `(1600, 264)`), not a full-height wall. A stored or imported **full-height** `R2_doorframe` (the old world `(1496, 16, 24, 312)`) is migrated/stripped on load (`layoutRevision` 5); the engine also refuses to spawn any R2 solid with `h>=200` in x `[1480, 1620]`. `R4_wallR` stays full-height — R5 is **east of R2**, not east of R4. `gapGateId` cuts a hole only when that gate has a `world` rect (`gate_R2_to_R4`); the engine also X-splits any solid that 2D-overlaps a gate opening. `gate_R1_to_R3` has no world — R1→R3 openings are the pits between `R1_floorA/B/C` (`160–240`, `400–480`). R3 ceiling openings match those pits only; the middle under `R1_floorB` is sealed (`R3_ceilB`). R3 left/right/bottom stay sealed — corridor join-X skip applies only on the R0–R2–R5–R6 Y=0 band, so R3's walls at x=640/1280 are not treated as doorway holes. Shared corridor walls stay omitted; the engine still merges abutting corridor slabs and skips join-seal ghost walls.

**New rooms / 新房间（layoutRevision 5 dump）**

| Room | World origin | Role | Pickup (world) |
|---|---|---|---|
| R5 | (1920, 0) | jumpLesson | `reactionJumpOrb` (2000, 220) |
| R6 | (2560, 0) | fieldStub | `gravityFieldOrb` (2880, 120) |

R5 jump soft-gate: `gate_R5_mustJump` world `(2120, 328, 160, 32)` (floor gap). R2→R5: `gate_R2_to_R5` (surfaceWalk). R5→R6: `gate_R5_to_R6` (reactionJump).

v1 / v2 仍可导入；手感像素值已是 640×360，不要再乘 2。旧能力 id `gravity` 会映射成 `gravityFall`。

Keys are **camelCase**. Feel mapping: `moveSpeed` walk speed, `airControl` airborne fraction of walk speed, `jumpVelocity` upward impulse (negative = up), `jumpCutMultiplier` early-release keep ratio, `gravityY` Arcade gravity after pickup, `maxFallSpeed` max vy, `coyoteMs` / `jumpBufferMs` jump forgiveness, `floatNudge` pre-gravity A/D nudge.

`sections.player` is **design defaults** (max hearts, starting kit), not live HP. `sections.progress` is phase labels / default phase. Live run state (current HP, unlocked abilities, visited rooms, flags, deaths) is `src/runState.js` — `window.__PHYMETROID_GET_RUN__()`.

`sections.player` 是策划默认（最大心数、开局能力/物品），不是本局 HP。本局状态在 `src/runState.js`。

**Import (minimal, no file picker):**

- Boot: if `localStorage['phymetroid.designConfig']` is valid JSON, it is applied, then migrated (`layoutRevision` 5) so an old tall `R2_doorframe`, pre-pit R3 ceiling, invented R5/R6 at `y=-360`, or missing R5/R6 dump cannot stick.
- Console / bot: `window.__PHYMETROID_APPLY_DESIGN__(objOrJsonString)` or `applyDesignConfig(obj)` from `src/designConfig.js`.
- `window.__PHYMETROID_GET_DESIGN__()` returns the current export payload.
- `window.__PHYMETROID_GET_RUN__()` returns the live run snapshot (hp, abilities, items, phase, flags, visitedRooms, deaths, gravityDown).
- `window.__PHYMETROID_DEBUG__` — `{ pos, warp, warpRoom, setDown, camRotation, toggleFeel, toggleMap, toggleAbility }` for console / bot checks. `setDown(axis, supported=true)` accepts cardinals or degrees (e.g. `45`). `camRotation()` stays `0`. Keyboard cheats (1–4 / Shift+1–7) only fire while the F1 panel is open.
- `window.__PHYMETROID_TOGGLE_FULLSCREEN__()` toggles the Fullscreen API.

导入先保持最小：启动读 localStorage（`layoutRevision` 5 会补上 R5/R6、把误放在 y=-360 的 R5/R6 挪到 Y=0 走廊，并改掉旧的通高 R2_doorframe / 旧 R3 顶开口）；程序用上面的全局函数。完整文件选择器留给以后的策划 bot。

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
- Rooms data: `src/rooms.js` (`WORLD_SCALE` / `px()`; R4 at y = −360; R5/R6 at y = 0)

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
src/levelEditor.js         # F1 level-edit helpers + undo stack (schema-safe, no Phaser)
src/levelEditorCamera.js   # editor zoom / pan / high-DPI math (Phaser-free)
src/levelEditorView.js     # F1 level-edit overlay + HTML strip + high-DPI view
src/hudText.js         # sharper HUD / debugger / map labels
docs/                  # GitHub Pages root (CDN + docs/src)
```
