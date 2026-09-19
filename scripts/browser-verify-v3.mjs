#!/usr/bin/env node
/**
 * Headless Chrome walkthrough of the schema v3 success path.
 * Requires Vite at http://127.0.0.1:5173/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  console.error('Installing puppeteer-core…');
  const { execSync } = require('node:child_process');
  execSync('npm install --no-save puppeteer-core', { stdio: 'inherit' });
  puppeteer = require('puppeteer-core');
}

const BASE = process.env.PHY_URL || 'http://127.0.0.1:5173/';
const OUT = process.env.PHY_SHOTS || '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok: Boolean(ok), extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`);
}

const headed = process.env.PHY_HEADED === '1';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: headed ? false : 'new',
  env: { ...process.env, DISPLAY: process.env.DISPLAY || ':1' },
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,900', '--window-position=40,40'],
});

const page = await browser.newPage();
page.setDefaultTimeout(20000);
page.on('pageerror', (err) => console.warn('pageerror', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.warn('console', msg.text());
});

await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__PHYMETROID_DEBUG__ && window.__PHYMETROID_GET_RUN__, {
  timeout: 15000,
});
await page.waitForFunction(() => {
  const c = document.querySelector('#game-container canvas');
  return c && c.width > 0;
});
await new Promise((r) => setTimeout(r, 400));
await page.click('#game-container canvas');

await page.screenshot({ path: `${OUT}/v3_01_boot_r0.png` });

const boot = await page.evaluate(() => ({
  schema: window.__PHYMETROID_GET_DESIGN__().schemaVersion,
  run: window.__PHYMETROID_GET_RUN__(),
  logical: {
    w: window.__PHYMETROID_GET_DESIGN__().logicalW,
    h: window.__PHYMETROID_GET_DESIGN__().logicalH,
  },
  rooms: window.__PHYMETROID_GET_DESIGN__().sections.rooms.map((r) => ({
    id: r.id,
    x: r.x,
    y: r.y,
  })),
  orb: window.__PHYMETROID_GET_DESIGN__().sections.pickups.find((p) => p.id === 'surfaceWalkOrb'),
  cam: window.__PHYMETROID_DEBUG__.camRotation(),
}));

check('schemaVersion 3', boot.schema === 3, String(boot.schema));
check('logical 640x360', boot.logical.w === 640 && boot.logical.h === 360, JSON.stringify(boot.logical));
check('R3 under R1', boot.rooms.find((r) => r.id === 'R3')?.y === 360);
check('R4 above R2', boot.rooms.find((r) => r.id === 'R4')?.x === 1280 && boot.rooms.find((r) => r.id === 'R4')?.y === -360);
check('surfaceWalkOrb coords', boot.orb?.x === 1320 && boot.orb?.y === -320, JSON.stringify(boot.orb));
check('camera rotation 0 at boot', boot.cam === 0, String(boot.cam));
check('start no abilities', boot.run.abilities.length === 0);

// Float into yellow orb
await page.evaluate(() => window.__PHYMETROID_DEBUG__.warp(240, 136));
await new Promise((r) => setTimeout(r, 250));
for (let i = 0; i < 8; i++) {
  await page.keyboard.down('KeyD');
  await new Promise((r) => setTimeout(r, 80));
  await page.keyboard.up('KeyD');
  await new Promise((r) => setTimeout(r, 40));
}
await new Promise((r) => setTimeout(r, 400));

let run = await page.evaluate(() => window.__PHYMETROID_GET_RUN__());
if (!run.abilities.includes('gravityFall')) {
  // Overlap may have missed — sit on the orb.
  await page.evaluate(() => window.__PHYMETROID_DEBUG__.warp(256, 136));
  await new Promise((r) => setTimeout(r, 400));
  run = await page.evaluate(() => window.__PHYMETROID_GET_RUN__());
}
check('picked gravityFall (not gravity)', run.abilities.includes('gravityFall') && !run.abilities.includes('gravity'), JSON.stringify(run.abilities));
check('phase exploration', run.phase === 'exploration', run.phase);
check('item gravityOrb', run.items.gravityOrb === 1, JSON.stringify(run.items));
const flashPickup = await page.evaluate(() => window.__PHYMETROID_DEBUG__.flash());
check('flash down on gravityFall pickup', flashPickup?.axis === 'down' && flashPickup.visible, JSON.stringify(flashPickup));

await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `${OUT}/v3_02_gravity_fall.png` });

// Land, prove no walk: record x, hold D, x should stay ~same once grounded
await page.evaluate(() => {
  window.__PHYMETROID_DEBUG__.warp(200, 300);
});
await new Promise((r) => setTimeout(r, 700));
const beforeWalk = await page.evaluate(() => window.__PHYMETROID_DEBUG__.pos());
await page.keyboard.down('KeyD');
await new Promise((r) => setTimeout(r, 500));
await page.keyboard.up('KeyD');
const afterWalk = await page.evaluate(() => window.__PHYMETROID_DEBUG__.pos());
check(
  'I-mode cannot walk',
  Math.abs(afterWalk.x - beforeWalk.x) < 8,
  `x ${beforeWalk.x.toFixed(1)} → ${afterWalk.x.toFixed(1)}`
);

// Jump should do nothing
const beforeJump = await page.evaluate(() => window.__PHYMETROID_DEBUG__.pos());
await page.keyboard.press('Space');
await page.keyboard.press('KeyW');
await new Promise((r) => setTimeout(r, 200));
const afterJump = await page.evaluate(() => window.__PHYMETROID_DEBUG__.pos());
check(
  'I-mode cannot jump',
  afterJump.y >= beforeJump.y - 4,
  `y ${beforeJump.y.toFixed(1)} → ${afterJump.y.toFixed(1)}`
);

// Gravity right from floor (debug setDown — same path as L when grounded)
const setRight = await page.evaluate(() => window.__PHYMETROID_DEBUG__.setDown('right'));
check('setDown(right) from floor', setRight.down === 'right', JSON.stringify(setRight));
await new Promise((r) => setTimeout(r, 900));
const rightFall = await page.evaluate(() => ({
  run: window.__PHYMETROID_GET_RUN__(),
  pos: window.__PHYMETROID_DEBUG__.pos(),
  cam: window.__PHYMETROID_DEBUG__.camRotation(),
}));
check('gravity vector is right', rightFall.run.gravityDown === 'right', rightFall.run.gravityDown);
check('fell toward R1/R2 (x increased)', rightFall.pos.x > 280, JSON.stringify(rightFall.pos));
check('camera still 0 while falling sideways', rightFall.cam === 0, String(rightFall.cam));
const flashRight = await page.evaluate(() => window.__PHYMETROID_DEBUG__.flash());
check('gravity flash after setDown(right)', flashRight?.axis === 'right' && flashRight.visible, JSON.stringify(flashRight));
await page.screenshot({ path: `${OUT}/v3_03_gravity_right.png` });

// R0 floor → R1 join must not ghost-block I-mode
await page.evaluate(() => {
  window.__PHYMETROID_DEBUG__.warp(560, 312);
  window.__PHYMETROID_DEBUG__.setDown('down');
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => window.__PHYMETROID_DEBUG__.setDown('right'));
await new Promise((r) => setTimeout(r, 1000));
const crossedR0R1 = await page.evaluate(() => window.__PHYMETROID_DEBUG__.pos());
check(
  'I-mode crosses R0|R1 join (x>640)',
  crossedR0R1.x > 640 && (crossedR0R1.room === 'R1' || crossedR0R1.room === 'R2'),
  JSON.stringify(crossedR0R1)
);

// R1 floor → R2 join (the reported wall at x≈1280)
await page.evaluate(() => {
  window.__PHYMETROID_DEBUG__.warp(1200, 312);
  window.__PHYMETROID_DEBUG__.setDown('down');
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => window.__PHYMETROID_DEBUG__.setDown('right'));
await new Promise((r) => setTimeout(r, 1000));
const crossedR1R2 = await page.evaluate(() => ({
  pos: window.__PHYMETROID_DEBUG__.pos(),
  solids: window.__PHYMETROID_DEBUG__.solidsNear(1280, 4),
}));
check(
  'I-mode crosses R1|R2 join (x>1280)',
  crossedR1R2.pos.x > 1280 && crossedR1R2.pos.room === 'R2',
  JSON.stringify(crossedR1R2.pos)
);
check(
  'no tall solid seals x=1280',
  !crossedR1R2.solids.some((s) => s.h > 80 && s.y < 40 && s.y + s.h > 300),
  JSON.stringify(crossedR1R2.solids)
);
await page.screenshot({ path: `${OUT}/v3_03b_crossed_r1_r2.png` });

// Doorframe catch: stand near R2 right, fall left into the frame
await page.evaluate(() => {
  window.__PHYMETROID_DEBUG__.warp(1700, 300);
  window.__PHYMETROID_DEBUG__.setDown('down');
});
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => window.__PHYMETROID_DEBUG__.setDown('left'));
await new Promise((r) => setTimeout(r, 900));
const onFrame = await page.evaluate(() => window.__PHYMETROID_DEBUG__.pos());
check(
  'leftward fall caught on R2 doorframe',
  onFrame.room === 'R2' && onFrame.x > 1500 && onFrame.x < 1600,
  JSON.stringify(onFrame)
);
await page.screenshot({ path: `${OUT}/v3_04_r2_doorframe.png` });

await page.evaluate(() => {
  window.__PHYMETROID_DEBUG__.warp(1560, 300);
  window.__PHYMETROID_DEBUG__.setDown('down');
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => window.__PHYMETROID_DEBUG__.setDown('up'));
await new Promise((r) => setTimeout(r, 1100));
const r4 = await page.evaluate(() => ({
  run: window.__PHYMETROID_GET_RUN__(),
  pos: window.__PHYMETROID_DEBUG__.pos(),
  cam: window.__PHYMETROID_DEBUG__.camRotation(),
}));
check('setDown(up) from under gate', r4.run.gravityDown === 'up', r4.run.gravityDown);
check('entered R4 (neg Y)', r4.pos.room === 'R4' && r4.pos.y < 0, JSON.stringify(r4.pos));
check('camera not rotated in R4', r4.cam === 0, String(r4.cam));
await page.screenshot({ path: `${OUT}/v3_05_entered_r4.png` });

// Collect teal orb
await page.evaluate(() => window.__PHYMETROID_DEBUG__.warp(1320, -320));
await new Promise((r) => setTimeout(r, 500));
run = await page.evaluate(() => window.__PHYMETROID_GET_RUN__());
check('picked surfaceWalk', run.abilities.includes('surfaceWalk'), JSON.stringify(run.abilities));
check('phase frictionLesson', run.phase === 'frictionLesson', run.phase);
check('item frictionBoots', run.items.frictionBoots === 1, JSON.stringify(run.items));
check('no reactionJump pickup', !run.abilities.includes('reactionJump'));
await page.screenshot({ path: `${OUT}/v3_06_surface_walk_orb.png` });

// Walk on R4 floor, away from the ceiling hole
await page.evaluate(() => {
  window.__PHYMETROID_DEBUG__.setDown('down');
  window.__PHYMETROID_DEBUG__.warp(1400, -80);
});
await new Promise((r) => setTimeout(r, 700));
const walk0 = await page.evaluate(() => window.__PHYMETROID_DEBUG__.pos());
await page.keyboard.down('KeyA');
await new Promise((r) => setTimeout(r, 400));
await page.keyboard.up('KeyA');
const walk1 = await page.evaluate(() => window.__PHYMETROID_DEBUG__.pos());
check('II-mode can walk', Math.abs(walk1.x - walk0.x) > 20, `x ${walk0.x.toFixed(1)} → ${walk1.x.toFixed(1)}`);

const j0 = await page.evaluate(() => window.__PHYMETROID_DEBUG__.pos());
await page.keyboard.press('Space');
await page.keyboard.press('KeyW');
await new Promise((r) => setTimeout(r, 250));
const j1 = await page.evaluate(() => window.__PHYMETROID_DEBUG__.pos());
check('II-mode cannot jump (needs reactionJump)', j1.y >= j0.y - 6, `y ${j0.y.toFixed(1)} → ${j1.y.toFixed(1)}`);
await page.screenshot({ path: `${OUT}/v3_07_walk_no_jump.png` });

// Map overlay
await page.evaluate(() => window.__PHYMETROID_DEBUG__.toggleMap());
await new Promise((r) => setTimeout(r, 300));
const mapInfo = await page.evaluate(() => window.__PHYMETROID_DEBUG__.mapContents());
check('map R0 shows gravity orb', mapInfo?.R0?.pickups?.some((p) => p.id === 'gravityOrb'));
check('map R4 shows walk orb once visited', mapInfo?.R4?.pickups?.some((p) => p.id === 'surfaceWalkOrb'));
check('map R2 shows gate to R4', mapInfo?.R2?.gates?.some((g) => g.dest === 'R4'));
check('map R3 stays spoiler-free if unvisited', !mapInfo?.R3?.visited && (mapInfo?.R3?.pickups?.length ?? 0) === 0);
check('map keeps R4 role hint', mapInfo?.R4?.role === 'fric');
await page.screenshot({ path: `${OUT}/v3_08_map_r4.png` });
await page.evaluate(() => window.__PHYMETROID_DEBUG__.toggleMap());

// Feel debugger + v3 export payload
await page.evaluate(() => window.__PHYMETROID_DEBUG__.toggleFeel());
await new Promise((r) => setTimeout(r, 300));
const feelDump = await page.evaluate(() => {
  const d = window.__PHYMETROID_GET_DESIGN__();
  return {
    schemaVersion: d.schemaVersion,
    feelKeys: Object.keys(d.sections.feel),
    rotateCamera: d.sections.gravity.rotateCamera,
    gravityId: Boolean(d.sections.abilities.gravity),
    gravityFall: Boolean(d.sections.abilities.gravityFall),
  };
});
check('E-export shape is v3 (GET_DESIGN)', feelDump.schemaVersion === 3);
check('feel keys unchanged', feelDump.feelKeys.join(',') === 'moveSpeed,airControl,jumpVelocity,jumpCutMultiplier,gravityY,maxFallSpeed,coyoteMs,jumpBufferMs,floatNudge');
check('rotateCamera false in export', feelDump.rotateCamera === false);
check('export uses gravityFall not gravity', feelDump.gravityFall && !feelDump.gravityId);
await page.screenshot({ path: `${OUT}/v3_09_feel_debug.png` });

// v2 import mapping
const v2 = await page.evaluate(() => {
  window.__PHYMETROID_APPLY_DESIGN__({
    schemaVersion: 2,
    logicalW: 640,
    logicalH: 360,
    sections: { player: { startingAbilities: ['gravity'] } },
  });
  return window.__PHYMETROID_GET_DESIGN__().sections.player.startingAbilities;
});
check('v2 startingAbilities gravity maps to gravityFall', v2.includes('gravityFall') && !v2.includes('gravity'), JSON.stringify(v2));

const failed = results.filter((r) => !r.ok);
writeFileSync(
  `${OUT}/v3_browser_verify.json`,
  JSON.stringify({ failed: failed.length, results }, null, 2)
);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
