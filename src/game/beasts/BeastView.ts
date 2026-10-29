import Phaser from "phaser";
import type { BeastConfig } from "../../features/beast";

/** World height of a deployed beast, visibly smaller than the hero. */
const BEAST_HEIGHT = 150;
const FLYING_HOVER = 46;
const BOB_PX = 5;
const SHADOW_ALPHA = 0.22;
/** How far towards the target the beast dashes, and the round-trip time (battle ms, via tween timeScale). */
const DASH_SHARE = 0.72;
const DASH_OUT_MS = 240;
const DASH_BACK_MS = 340;
/** Peak height of the leap towards the target. */
const LEAP_PX = 38;
const DEPTH = 3;
/** In front of the hero while it dashes past him. */
const DASH_DEPTH = 8.5;
const IDLE_FRAMES = 8;
const FRAME_HEIGHT = 256;
const SHEET_COLUMNS = 4;

/**
 * The deployed spirit beast (出戰): floats behind Bai Xiaochun with a light
 * outline and an element-coloured glow so it reads against the busy
 * background, and dashes at the monster when it attacks. All tweens run on the
 * scene's tween clock, so tower battle speed (2×/3×/5×) applies.
 */
export class BeastView {
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private beast: BeastConfig | null = null;
  private dashOffset = { x: 0, y: 0, leap: 0 };
  private dashing = false;

  public constructor(private readonly scene: Phaser.Scene, private readonly home: Phaser.Math.Vector2) {
    this.shadow = scene.add.ellipse(home.x, home.y, 110, 22, 0x000000, SHADOW_ALPHA).setDepth(2.5).setVisible(false);
    this.sprite = scene.add.sprite(home.x, home.y, "__DEFAULT").setOrigin(0.5, 1).setDepth(DEPTH).setVisible(false);
  }

  public get current(): BeastConfig | null {
    return this.beast;
  }

  public setBeast(beast: BeastConfig | null): void {
    if (beast?.beastId === this.beast?.beastId) return;
    // Cancel an in-flight dash before the displayed beast changes.
    this.reset();
    this.beast = beast;
    const visible = beast !== null && this.scene.textures.exists(beast.textureKey);
    this.sprite.setVisible(visible);
    this.shadow.setVisible(visible);
    if (!visible) return;
    const animationKey = this.ensureIdleAnimation(beast);
    if (animationKey) this.sprite.play(animationKey);
    else this.sprite.stop().setTexture(beast.textureKey);
    this.sprite.setScale(BEAST_HEIGHT / this.sprite.height);
    this.shadow.setSize(this.sprite.displayWidth * 0.7, 22);
    // Light rim, then a wider glow in the beast's element colour (WebGL only; canvas just skips it).
    this.sprite.preFX?.clear();
    this.sprite.preFX?.addGlow(0xfff6e0, 1.6, 0, false, 0.12, 3);
    this.sprite.preFX?.addGlow(beast.glowColor, 5, 0, false, 0.12, 12);
  }

  /** Build a small in-memory sheet from the existing static image, without extra asset files. */
  private ensureIdleAnimation(beast: BeastConfig): string | null {
    const sheetKey = `${beast.textureKey}-idle-sheet`;
    const animationKey = `${beast.textureKey}-idle`;
    if (this.scene.anims.exists(animationKey)) return animationKey;
    const source = this.scene.textures.get(beast.textureKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    if (!sourceWidth || !sourceHeight) return null;
    const frameWidth = Math.max(1, Math.min(512, Math.ceil(FRAME_HEIGHT * sourceWidth / sourceHeight)));
    const sheet = this.scene.textures.createCanvas(sheetKey, frameWidth * SHEET_COLUMNS, FRAME_HEIGHT * 2);
    if (!sheet) return null;
    const context = sheet.getContext();
    for (let frame = 0; frame < IDLE_FRAMES; frame += 1) {
      const x = (frame % SHEET_COLUMNS) * frameWidth;
      const y = Math.floor(frame / SHEET_COLUMNS) * FRAME_HEIGHT;
      const breathing = 1 + 0.012 * Math.sin(frame * Math.PI * 2 / IDLE_FRAMES);
      const height = FRAME_HEIGHT * 0.96 * breathing;
      const width = frameWidth * 0.96 / Math.sqrt(breathing);
      context.drawImage(source, x + (frameWidth - width) / 2, y + FRAME_HEIGHT - height, width, height);
      sheet.add(frame, 0, x, y, frameWidth, FRAME_HEIGHT);
    }
    sheet.refresh();
    this.scene.anims.create({ key: animationKey, frames: this.scene.anims.generateFrameNumbers(sheetKey, { start: 0, end: IDLE_FRAMES - 1 }), frameRate: 8, repeat: -1 });
    return animationKey;
  }

  /** Per frame: idle float (time in seconds). */
  public update(timeSeconds: number): void {
    if (!this.beast || !this.sprite.visible) return;
    const hover = this.beast.flying ? FLYING_HOVER + BOB_PX * 1.6 * Math.sin(timeSeconds * 2.4) : BOB_PX * Math.abs(Math.sin(timeSeconds * 1.8)) * 0.6;
    this.sprite.setPosition(this.home.x + this.dashOffset.x, this.home.y - hover + this.dashOffset.y - LEAP_PX * Math.sin(Math.PI * this.dashOffset.leap));
    const lift = this.beast.flying ? 0.55 : 1;
    this.shadow.setPosition(this.home.x + this.dashOffset.x, this.home.y).setScale(lift, lift);
  }

  /** Dashes towards `target`, calls `onHit` at the far point, then returns home. */
  public attack(target: Phaser.Math.Vector2, onHit: (position: Phaser.Math.Vector2) => void): void {
    if (!this.beast || this.dashing || !this.sprite.visible) return;
    this.dashing = true;
    this.sprite.setDepth(DASH_DEPTH);
    this.dashOffset.leap = 0;
    const dx = (target.x - this.home.x) * DASH_SHARE;
    const dy = (target.y - this.home.y) * DASH_SHARE * 0.35;
    this.scene.tweens.add({
      targets: this.dashOffset,
      x: dx,
      y: dy,
      leap: 0.5,
      duration: DASH_OUT_MS,
      ease: "Cubic.easeIn",
      onComplete: () => {
        onHit(new Phaser.Math.Vector2(this.sprite.x + this.sprite.displayWidth * 0.4, this.sprite.y - this.sprite.displayHeight * 0.5));
        this.scene.tweens.add({
          targets: this.dashOffset,
          x: 0,
          y: 0,
          leap: 1,
          duration: DASH_BACK_MS,
          ease: "Sine.easeOut",
          onComplete: () => this.endDash(),
        });
      },
    });
  }

  /** Element-coloured burst and the damage number at the hit point. */
  public playHit(position: Phaser.Math.Vector2, damage: number): void {
    if (!this.beast) return;
    const ring = this.scene.add.circle(position.x, position.y, 16, this.beast.glowColor, 0.55).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 260, ease: "Quad.easeOut", onComplete: () => ring.destroy() });
    const color = `#${this.beast.glowColor.toString(16).padStart(6, "0")}`;
    const text = this.scene.add.text(position.x, position.y - 24, damage.toLocaleString("zh-TW"), {
      fontFamily: "Arial, 'Noto Sans TC', sans-serif",
      fontSize: "22px",
      fontStyle: "bold",
      color,
      stroke: "#1b1030",
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(10);
    this.scene.tweens.add({ targets: text, y: text.y - 34, alpha: 0, duration: 650, ease: "Quad.easeOut", onComplete: () => text.destroy() });
  }

  /** Back home at once, e.g. when a challenge ends mid-dash. */
  public reset(): void {
    this.scene.tweens.killTweensOf(this.dashOffset);
    this.dashOffset = { x: 0, y: 0, leap: 0 };
    this.endDash();
  }

  private endDash(): void {
    this.dashing = false;
    this.dashOffset.leap = 0;
    this.sprite.setDepth(DEPTH);
  }
}
