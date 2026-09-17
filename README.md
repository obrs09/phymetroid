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
docs/          # GitHub Pages root (CDN + docs/src)
```
