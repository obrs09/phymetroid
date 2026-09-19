/** Global Phaser from CDN UMD script tag in docs/index.html */
const Phaser = window.Phaser;
if (!Phaser) {
  throw new Error('Phaser global missing — check CDN script in docs/index.html');
}
export default Phaser;
