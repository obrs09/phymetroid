#!/usr/bin/env node
/**
 * Keep docs/src game logic in sync with src/ for GitHub Pages.
 * Pages can only serve under docs/, so we copy + rewrite Phaser imports
 * to the UMD shim (docs/src/phaser-shim.js).
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const docsSrc = join(root, 'docs', 'src');

mkdirSync(join(docsSrc, 'scenes'), { recursive: true });

function copyAndPatch(rel, fromPhaser, toPhaser) {
  const from = join(src, rel);
  const to = join(docsSrc, rel);
  let text = readFileSync(from, 'utf8');
  text = text.replaceAll(fromPhaser, toPhaser);
  writeFileSync(to, text);
  console.log('synced', rel);
}

copyAndPatch('rooms.js', '', ''); // identical
copyAndPatch('scaleZoom.js', '', '');
copyAndPatch('designConfig.js', '', '');
copyAndPatch('player.js', "import Phaser from 'phaser';", "import Phaser from './phaser-shim.js';");
copyAndPatch('feelDebugPanel.js', "import Phaser from 'phaser';", "import Phaser from './phaser-shim.js';");
copyAndPatch(
  'scenes/GameScene.js',
  "import Phaser from 'phaser';",
  "import Phaser from '../phaser-shim.js';"
);

// docs main: same boot as src/main.js but Phaser from shim
let main = readFileSync(join(src, 'main.js'), 'utf8');
main = main.replace("import Phaser from 'phaser';", "import Phaser from './phaser-shim.js';");
writeFileSync(join(docsSrc, 'main.js'), main);
console.log('synced main.js (shim import)');

if (!existsSync(join(docsSrc, 'phaser-shim.js'))) {
  writeFileSync(
    join(docsSrc, 'phaser-shim.js'),
    `/** Global Phaser from CDN UMD script tag in docs/index.html */\nconst Phaser = window.Phaser;\nif (!Phaser) {\n  throw new Error('Phaser global missing — check CDN script in docs/index.html');\n}\nexport default Phaser;\n`
  );
  console.log('wrote phaser-shim.js');
}

// ensure .nojekyll
writeFileSync(join(root, 'docs', '.nojekyll'), '');
console.log('docs sync done');
