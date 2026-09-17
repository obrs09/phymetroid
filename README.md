# Metroidvania Phaser Prototype / 银河战士式 Phaser 原型

Phaser 3 + Vite indie prototype: floating start → gravity pickup → walk/jump → room-snapping camera.

Phaser 3 + Vite 独立游戏原型：漂浮开场 → 重力拾取 → 行走跳跃 → 房间相机切换。

## How to play / 操作

| Key / 按键 | Action / 作用 |
|---|---|
| A / D or ← → | Move left/right **after** gravity / 重力开启后左右移动 |
| W / Space / ↑ | Jump when grounded **after** gravity / 重力开启且着地后跳跃 |
| F1 or `` ` `` (backtick) | Toggle debug overlay / 开关调试信息 |

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

Dev server: **http://localhost:5173/** (Vite default; `host: true` so LAN works).

开发服务器：**http://localhost:5173/**（Vite 默认端口；已开启 `host: true`）。

```bash
npm run build    # output in dist/
npm run preview  # preview production build
```

## GitHub Pages / GitHub Pages 部署

Production build is committed under `/docs` (copied from `npm run build` → `dist/`).
`vite.config.js` uses `base: './'` for relative asset paths.

生产构建已提交到仓库的 `/docs`（由 `npm run build` 的 `dist/` 复制而来）。
`vite.config.js` 使用 `base: './'`，相对资源路径可用。

**Enable Pages / 开启步骤**

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **`main`** / folder: **`/docs`** → Save
4. Site URL (after a minute): `https://obrs09.github.io/phymetroid/`

When you change the game later: `npm run build && rm -rf docs && mkdir docs && cp -a dist/. docs/` then commit.

之后改游戏时：重新 build，再把 `dist/` 复制进 `docs/` 后提交。

## Tech / 技术

- Phaser **3.80+**, Arcade Physics (AABB)
- Logical resolution **320×180**, `Scale.FIT` + `autoCenter` + `pixelArt` / `roundPixels`
- Rooms data: `src/rooms.js` — grow the map there
- Placeholders: generated rectangle/circle textures (no external art required)

## Project layout / 目录

```
src/main.js
src/scenes/GameScene.js
src/rooms.js
src/player.js
assets/
```

Future tilemap: see stub comments in `GameScene.js` / `rooms.js`.
