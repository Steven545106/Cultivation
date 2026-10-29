import Phaser from "phaser";
import { ensureTowerFxTextures, FX_SOFT } from "./towerFxTextures";

const WIDTH = 1280;
const HEIGHT = 720;
const CENTRE_X = WIDTH / 2;
const GOLD = 0xffd98a;
/** Above the fight and its effects (impacts use depth 19-21). */
const DEPTH = 30;
const SERIF = "'Noto Serif TC', 'Songti TC', serif";

/**
 * One-off flourishes over the tower fight: a title card for each new floor, the
 * entrance of a Boss or an elite, and the burst when a monster falls. They are
 * overlays only; the fight keeps running underneath.
 */
export class TowerCeremony {
  private readonly reducedMotion = typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  public constructor(private readonly scene: Phaser.Scene) {
    ensureTowerFxTextures(scene);
  }

  /** "第 12 層" with the floor's theme name, fading in at the top of the scene. */
  public floorTitle(title: string, subtitle: string): void {
    const heading = this.scene.add.text(0, 0, title, { fontFamily: SERIF, fontSize: "58px", fontStyle: "bold", color: "#ffe9b0", stroke: "#4a2a10", strokeThickness: 8 }).setOrigin(0.5);
    const name = this.scene.add.text(0, 54, subtitle, { fontFamily: SERIF, fontSize: "28px", color: "#f4f8ff", stroke: "#10243c", strokeThickness: 5 }).setOrigin(0.5);
    const rule = this.scene.add.rectangle(0, 98, 260, 3, GOLD, 0.9);
    const card = this.scene.add.container(CENTRE_X, 118, [heading, name, rule]).setDepth(DEPTH).setAlpha(0);
    this.scene.tweens.add({ targets: card, alpha: 1, y: 132, duration: 420, ease: "Quad.easeOut", hold: 1300, yoyo: true, onComplete: () => card.destroy() });
  }

  /** The room-10 guardian arrives: the scene darkens, a banner slams in, the screen shakes. */
  public bossEntrance(name: string): void {
    const dim = this.scene.add.rectangle(CENTRE_X, HEIGHT / 2, WIDTH, HEIGHT, 0x10000a, 0).setDepth(DEPTH - 1);
    const blood = this.scene.add.rectangle(CENTRE_X, HEIGHT / 2, WIDTH, HEIGHT, 0xa01020, 0).setDepth(DEPTH - 1).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: dim, alpha: 0.58, duration: 260, hold: 1100, yoyo: true, onComplete: () => dim.destroy() });
    this.scene.tweens.add({ targets: blood, alpha: 0.2, duration: 260, hold: 1100, yoyo: true, onComplete: () => blood.destroy() });

    const bars = [-1, 1].map(side => this.scene.add.rectangle(CENTRE_X, HEIGHT / 2 + side * 78, 880, 4, GOLD, 0.95).setDepth(DEPTH).setScale(0, 1));
    const banner = this.scene.add.text(CENTRE_X, HEIGHT / 2 - 8, "守 關 BOSS", { fontFamily: SERIF, fontSize: "88px", fontStyle: "bold", color: "#ffe39a", stroke: "#5b1010", strokeThickness: 14 }).setOrigin(0.5).setDepth(DEPTH + 1).setAlpha(0).setScale(this.reducedMotion ? 1 : 2.4);
    const title = this.scene.add.text(CENTRE_X, HEIGHT / 2 + 56, name, { fontFamily: SERIF, fontSize: "36px", color: "#fff4dc", stroke: "#3a0c0c", strokeThickness: 7 }).setOrigin(0.5).setDepth(DEPTH + 1).setAlpha(0);
    this.scene.tweens.add({ targets: bars, scaleX: 1, duration: 340, ease: "Quad.easeOut" });
    this.scene.tweens.add({ targets: banner, alpha: 1, scale: 1, duration: 380, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: title, alpha: 1, duration: 300, delay: 220 });
    this.scene.tweens.add({
      targets: [banner, title, ...bars],
      alpha: 0,
      duration: 420,
      delay: 1500,
      onComplete: () => { banner.destroy(); title.destroy(); bars.forEach(bar => bar.destroy()); },
    });
    if (!this.reducedMotion) this.scene.cameras.main.shake(420, 0.012);
  }

  /** A smaller announcement for the room-9 elite: no darkening, no shake. */
  public eliteEntrance(name: string): void {
    const text = this.scene.add.text(CENTRE_X, 170, `精英妖獸・${name}`, { fontFamily: SERIF, fontSize: "40px", fontStyle: "bold", color: "#ffc27a", stroke: "#4a1c08", strokeThickness: 8 }).setOrigin(0.5).setDepth(DEPTH).setAlpha(0).setScale(this.reducedMotion ? 1 : 1.35);
    this.scene.tweens.add({ targets: text, alpha: 1, scale: 1, duration: 300, ease: "Back.easeOut", hold: 800, yoyo: true, onComplete: () => text.destroy() });
  }

  /** The monster falls: a ring of light and a burst of motes; a Boss adds a flash and a title. */
  public victory(position: Phaser.Math.Vector2, isBoss: boolean): void {
    const ring = this.scene.add.graphics().setDepth(DEPTH - 2).setPosition(position.x, position.y).setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(isBoss ? 10 : 6, GOLD, 0.95).strokeCircle(0, 0, 40);
    ring.lineStyle(isBoss ? 5 : 3, 0xffffff, 0.9).strokeCircle(0, 0, 56);
    ring.setScale(0.3);
    this.scene.tweens.add({ targets: ring, scale: isBoss ? 5.2 : 3.4, alpha: 0, duration: isBoss ? 760 : 520, ease: "Quad.easeOut", onComplete: () => ring.destroy() });

    const motes = this.scene.add.particles(position.x, position.y, FX_SOFT, {
      emitting: false,
      speed: { min: 110, max: isBoss ? 460 : 320 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 500, max: isBoss ? 1100 : 800 },
      scale: { start: isBoss ? 0.6 : 0.42, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe39a, 0xfff4c8, 0xffbf60],
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH - 2);
    motes.explode(this.reducedMotion ? (isBoss ? 18 : 8) : (isBoss ? 56 : 24));
    this.scene.time.delayedCall(1300, () => motes.destroy());

    if (!isBoss) return;
    const text = this.scene.add.text(CENTRE_X, HEIGHT / 2 - 60, "擊 破！", { fontFamily: SERIF, fontSize: "88px", fontStyle: "bold", color: "#fff0b8", stroke: "#6a3a08", strokeThickness: 12 }).setOrigin(0.5).setDepth(DEPTH).setAlpha(0).setScale(this.reducedMotion ? 1 : 1.8);
    this.scene.tweens.add({ targets: text, alpha: 1, scale: 1, duration: 320, ease: "Back.easeOut", hold: 900, yoyo: true, onComplete: () => text.destroy() });
    if (!this.reducedMotion) {
      const flash = this.scene.add.rectangle(CENTRE_X, HEIGHT / 2, WIDTH, HEIGHT, 0xfff0c8, 0.32).setDepth(DEPTH - 3).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: flash, alpha: 0, duration: 360, onComplete: () => flash.destroy() });
    }
  }
}
