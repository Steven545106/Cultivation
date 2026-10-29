import Phaser from "phaser";
import { getMonsterTextureKey, monsterAssetPaths } from "./monsterAssetManifest";
import { monsterAnimationKey, monsterAnimations, monsterSheetKey } from "./monsterAnimationConfig";
import { themedMonsterAnimationKey, themedMonsters, themedMonsterSheetKey } from "./themedMonsters";

const MONSTER_SIZE = 300;

/** Visual-only monster view: tower rules and damage remain in the domain layer. */
export class MonsterView {
  public readonly home: Phaser.Math.Vector2;
  private readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly decoration: Phaser.GameObjects.Graphics;
  private readonly health: Phaser.GameObjects.Rectangle;
  private readonly healthBack: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private scale = 1;
  private boss = false;
  private defeated = false;
  private hitTween?: Phaser.Tweens.Tween;
  private defeatTween?: Phaser.Tweens.Tween;

  public constructor(private readonly scene: Phaser.Scene, home: Phaser.Math.Vector2, private readonly groundY: number, initialLabel: string) {
    this.home = home.clone();
    this.container = scene.add.container(home.x, home.y).setDepth(4);
    this.decoration = scene.add.graphics();
    this.sprite = scene.add.sprite(0, 0, "bai-xiaochun").setVisible(false);
    this.healthBack = scene.add.rectangle(0, 0, 182, 14, 0x211426);
    this.health = scene.add.rectangle(-88, 0, 176, 8, 0x84e8a2).setOrigin(0, 0.5);
    this.label = scene.add.text(0, 0, initialLabel, { fontSize: "20px", color: "#ffe9ef" }).setOrigin(0.5, 0).setVisible(false);
    this.container.add([this.decoration, this.sprite, this.healthBack, this.health, this.label]);
    this.setTexture(1);
    this.layout();
  }

  public setHome(x: number, y: number): void { this.home.set(x, y); this.container.setPosition(x, y); this.layout(); }

  private layout(): void {
    const size = MONSTER_SIZE * this.scale;
    const centreY = Math.min(0, this.groundY - this.home.y - size / 2);
    this.sprite.setPosition(0, centreY);
    this.healthBack.setY(centreY - size / 2 - 18);
    this.health.setY(centreY - size / 2 - 18);
    this.label.setY(centreY + size / 2 + 6);
    this.decoration.clear();
    if (this.boss) this.decoration.lineStyle(4, 0xffe2a0, 0.7).strokeEllipse(0, centreY + size / 2, size * 0.8, 32);
  }

  public setHealth(ratio: number, label: string): void { this.health.setScale(Phaser.Math.Clamp(ratio, 0, 1), 1); this.label.setText(label); }
  public setLabel(label: string): void { this.label.setText(label); }

  public reset(scale = 1): void {
    this.hitTween?.stop(); this.defeatTween?.stop(); this.defeated = false;
    this.container.setPosition(this.home.x, this.home.y).setAlpha(1).setScale(1);
    this.sprite.clearTint(); this.scale = scale; this.fitSprite(); this.layout();
  }

  public playKnockback(distance: number, durationMs: number): void {
    this.hitTween?.stop(); this.sprite.setTintFill(0xffffff);
    this.hitTween = this.scene.tweens.add({ targets: this.container, x: this.home.x + distance, duration: durationMs, yoyo: true, ease: "Quad.easeOut", onComplete: () => this.sprite.clearTint() });
  }

  public playDefeat(finalScale: number, dropY: number): void {
    if (this.defeated) return;
    this.defeated = true; this.hitTween?.stop(); this.sprite.clearTint();
    this.defeatTween = this.scene.tweens.add({ targets: this.container, alpha: 0, scale: finalScale, y: this.home.y + dropY, duration: 260, ease: "Quad.easeIn" });
  }

  /** `themeId`: the floor's theme; a theme with its own creature shows that instead of the shared rotation. */
  public setTexture(stageNumber: number, themeId?: string): void {
    const themed = themeId ? themedMonsters[themeId] : undefined;
    if (themeId && themed && this.scene.textures.exists(themedMonsterSheetKey(themeId))) {
      const animationKey = themedMonsterAnimationKey(themeId);
      if (!this.scene.anims.exists(animationKey)) this.scene.anims.create({ key: animationKey, frames: this.scene.anims.generateFrameNumbers(themedMonsterSheetKey(themeId), { start: 0, end: themed.frames - 1 }), frameRate: themed.frameRate, repeat: -1 });
      if (this.sprite.anims.currentAnim?.key !== animationKey || !this.sprite.anims.isPlaying) this.sprite.play(animationKey);
      this.sprite.setVisible(true); this.fitSprite(); this.layout();
      return;
    }
    const textureKey = getMonsterTextureKey(stageNumber);
    if (!textureKey || !this.scene.textures.exists(textureKey)) { this.sprite.setVisible(false); return; }
    const index = (stageNumber - 1) % monsterAssetPaths.length;
    const name = monsterAssetPaths[index].split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
    const config = monsterAnimations[name];
    const sheetKey = monsterSheetKey(name);
    const animationKey = monsterAnimationKey(name);
    if (config && this.scene.textures.exists(sheetKey)) {
      if (!this.scene.anims.exists(animationKey)) this.scene.anims.create({ key: animationKey, frames: this.scene.anims.generateFrameNumbers(sheetKey, { start: 0, end: config.frames - 1 }), frameRate: config.frameRate, repeat: -1 });
      if (this.sprite.anims.currentAnim?.key !== animationKey) this.sprite.play(animationKey);
    } else {
      this.sprite.stop().setTexture(textureKey);
    }
    this.sprite.setVisible(true); this.fitSprite(); this.layout();
  }

  public drawDecoration(isBoss: boolean): void { this.boss = isBoss; this.layout(); }

  public update(timeSeconds: number): void {
    if (this.defeated || !this.sprite.visible) return;
    const baseScale = MONSTER_SIZE * this.scale / Math.max(this.sprite.width, this.sprite.height);
    this.sprite.setScale(baseScale, baseScale * (1 + Math.sin(timeSeconds * 1.8) * 0.012));
  }

  private fitSprite(): void {
    if (!this.sprite.visible) return;
    const baseScale = MONSTER_SIZE * this.scale / Math.max(this.sprite.width, this.sprite.height);
    this.sprite.setScale(baseScale);
  }
}
