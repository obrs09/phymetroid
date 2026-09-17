const W = 320;
const H = 180;
const ROOMS = [
  { id: "R0", x: 0, y: 0, w: W, h: H },
  { id: "R1", x: W, y: 0, w: W, h: H },
  { id: "R2", x: W * 2, y: 0, w: W, h: H },
  { id: "R3", x: W, y: H, w: W, h: H }
];
const WORLD_W = W * 3;
const WORLD_H = H * 2;
function roomAt(x, y) {
  return ROOMS.find(function (r) {
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  }) || ROOMS[0];
}
class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
    this.hasGravity = false;
    this.debugOn = false;
    this.currentRoom = ROOMS[0];
  }
  create() {
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    this.cameras.main.setRoundPixels(true);
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.physics.world.gravity.y = 0;
    this.solids = this.physics.add.staticGroup();
    var self = this;
    function floor(x, y, w, h, color) {
      var r = self.add.rectangle(x + w / 2, y + h / 2, w, h, color || 0x3d5a4c);
      self.physics.add.existing(r, true);
      self.solids.add(r);
      return r;
    }
    floor(0, H - 16, W, 16, 0x2f4f3e);
    floor(W, H - 16, 96, 16, 0x2f4f3e);
    floor(W + 160, H - 16, W - 160, 16, 0x2f4f3e);
    floor(W * 2, H - 16, W, 16, 0x2f4f3e);
    floor(0, 0, 8, H, 0x243028);
    floor(WORLD_W - 8, 0, 8, H, 0x243028);
    floor(0, WORLD_H - 8, WORLD_W, 8, 0x243028);
    floor(80, 120, 48, 8, 0x5c7a62);
    floor(W + 40, 100, 56, 8, 0x5c7a62);
    floor(W + 200, 80, 40, 8, 0x5c7a62);
    floor(W * 2 + 60, 110, 64, 8, 0x5c7a62);
    floor(W + 20, H + 80, 80, 8, 0x5c7a62);
    floor(W + 140, WORLD_H - 16, 160, 16, 0x2f4f3e);
    this.player = this.add.rectangle(48, 64, 12, 16, 0x7ec8e3);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false);
    this.player.body.setMaxVelocity(140, 280);
    this.physics.add.collider(this.player, this.solids);
    this.pickup = this.add.circle(140, 72, 6, 0xffd166);
    this.physics.add.existing(this.pickup, true);
    this.physics.add.overlap(this.player, this.pickup, function () { self.grantGravity(); });
    this.hint = this.add.text(8, 8, "FLOATING - touch the yellow orb", { fontFamily: "monospace", fontSize: "8px", color: "#cde3d0" }).setScrollFactor(0);
    this.debugText = this.add.text(8, H - 20, "", { fontFamily: "monospace", fontSize: "8px", color: "#9ae6b4" }).setScrollFactor(0).setVisible(false);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE");
    this.input.keyboard.on("keydown-F1", function () { self.toggleDebug(); });
    this.snapCamera(this.currentRoom, true);
  }
  grantGravity() {
    if (this.hasGravity) return;
    this.hasGravity = true;
    this.pickup.destroy();
    this.physics.world.gravity.y = 720;
    this.player.body.setAllowGravity(true);
    this.hint.setText("GRAVITY ON  A/D move  W/SPACE jump");
  }
  toggleDebug() {
    this.debugOn = !this.debugOn;
    this.debugText.setVisible(this.debugOn);
  }
  snapCamera(room, instant) {
    var cam = this.cameras.main;
    cam.setBounds(room.x, room.y, room.w, room.h);
    if (instant) cam.centerOn(room.x + room.w / 2, room.y + room.h / 2);
    else cam.pan(room.x + room.w / 2, room.y + room.h / 2, 180, "Linear", true);
  }
  update() {
    var body = this.player.body;
    var left = this.cursors.left.isDown || this.keys.A.isDown;
    var right = this.cursors.right.isDown || this.keys.D.isDown;
    var jump = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
    if (!this.hasGravity) {
      body.setVelocityX(0);
      if (left) body.setVelocityX(-40);
      if (right) body.setVelocityX(40);
    } else {
      if (left) body.setVelocityX(-90);
      else if (right) body.setVelocityX(90);
      else body.setVelocityX(0);
      if (jump && body.blocked.down) body.setVelocityY(-210);
    }
    var room = roomAt(this.player.x, this.player.y);
    if (room.id !== this.currentRoom.id) {
      this.currentRoom = room;
      this.snapCamera(room, false);
    }
    if (this.debugOn) {
      this.debugText.setText(room.id + " g:" + (this.hasGravity ? 1 : 0) + " grounded:" + (body.blocked.down ? 1 : 0));
    }
  }
}
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: W,
  height: H,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: "#1a1a2e",
  physics: { default: "arcade", arcade: { gravity: { y: 0 }, fps: 60 } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: GameScene
});
