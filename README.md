# phymetroid

2D pixel Metroidvania prototype (Phaser 3 Arcade). Desktop web only.

## Play in browser

Enable GitHub Pages: Settings → Pages → Deploy from branch → `main` / `/` (root).

Then open: https://obrs09.github.io/phymetroid/

`index.html` loads Phaser from jsDelivr and `src/game.js`. No build required for Pages.

A Vite + npm setup is also in the repo (`npm install && npm run dev`) for later local work. Prefer the static `index.html` until we unify the two trees.

### Controls

1. You start floating. Use A/D to drift to the yellow orb.
2. Touch it → GRAVITY ON, you fall.
3. A/D walk, W / Space / Up jump (must be grounded).
4. Walk off a room edge → camera snaps to the next room.
5. R1 floor has a hole down to R3.
6. F1 or backtick: debug overlay.
