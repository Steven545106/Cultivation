import Phaser from "phaser";
import type { AttackResult, BladeSegment, Point } from "../../features/combat";
import type { WeaponConfig } from "../../features/weapon";
import type { WeaponSpriteState } from "../weapons/WeaponAttachmentController";
import { getRefinementVfxTier, scaleParticleCount, type RefinementVfxTier } from "./refinementVfx";
import { SwingTrailBuffer, type FadedTrailSample } from "./SwingTrailBuffer";
import { getSwingVfxProfile, type SwingParticleShape, type SwingVfxProfile } from "./swingVfxProfiles";

const GOLD = 0xffd77a;
const TRAIL_LIFETIME_MS = 180;
const AFTERIMAGE_INTERVAL_MS = 34;
const AFTERIMAGE_FADE_MS = 150;
const IMPACT_PARTICLES = 10;
const TEXTURE_PREFIX = "swing-vfx-";
const PARTICLE_SHAPES: readonly SwingParticleShape[] = ["spark", "glint", "shard", "petal", "mote"];

function along(sample: FadedTrailSample, t: number): Point {
  return { x: sample.base.x + (sample.tip.x - sample.base.x) * t, y: sample.base.y + (sample.tip.y - sample.base.y) * t };
}

/**
 * Draws the windup charge, layered swing ribbon, weapon afterimages, element
 * particles, impact flashes, and damage numbers. It applies no damage.
 */
export class CombatVfxRenderer {
  /** Soft outer ribbon, normal blending so it stays readable on the bright sky. */
  private readonly band: Phaser.GameObjects.Graphics;
  /** Bright edge, tip line, lightning and charge glow, additively blended. */
  private readonly core: Phaser.GameObjects.Graphics;
  private readonly trail = new SwingTrailBuffer(TRAIL_LIFETIME_MS);
  private readonly emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private weapon: WeaponConfig | null = null;
  private charge: { readonly tip: Point; readonly progress: number } | null = null;
  private swinging = false;
  private lastAfterimageAt = Number.NEGATIVE_INFINITY;
  /** Refinement layer on top of the element profile; +0 leaves the element look unchanged. */
  private tier: RefinementVfxTier = getRefinementVfxTier(0);
  /** Additive halo copy of the weapon sprite, shown from +11. */
  private glow: Phaser.GameObjects.Image | null = null;
  /** OS "reduce motion": no flicker or afterimages, half the particles. */
  private readonly reducedMotion = typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  private particleScale(): number {
    return this.tier.particleScale * (this.reducedMotion ? 0.5 : 1);
  }

  public constructor(private readonly scene: Phaser.Scene) {
    this.band = scene.add.graphics().setDepth(7);
    this.core = scene.add.graphics().setDepth(7.2).setBlendMode(Phaser.BlendModes.ADD);
    this.ensureParticleTextures();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.render, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.render, this));
  }

  public setRefinementLevel(refinementLevel: number): void {
    this.tier = getRefinementVfxTier(refinementLevel);
    if (!this.tier.bladeGlow) this.glow?.setVisible(false);
  }

  /**
   * Keeps the +11 blade halo on the weapon sprite; call whenever the weapon moves.
   * A solid-colour silhouette sits just behind the sword and slightly larger, so
   * it reads as a coloured outline even on the pale, near-white blades.
   */
  public syncWeaponGlow(sprite: WeaponSpriteState, weapon: WeaponConfig): void {
    if (!this.tier.bladeGlow) {
      this.glow?.setVisible(false);
      return;
    }
    this.glow ??= this.scene.add.image(sprite.x, sprite.y, sprite.textureKey).setBlendMode(Phaser.BlendModes.ADD);
    this.glow
      .setDepth(sprite.depths.glow)
      .setTexture(sprite.textureKey)
      .setOrigin(sprite.originX, sprite.originY)
      .setPosition(sprite.x, sprite.y)
      .setRotation(sprite.rotation)
      .setScale(sprite.scale * 1.12)
      .setTintFill(this.tier.goldEdge ? GOLD : getSwingVfxProfile(weapon.element).afterimageTint)
      .setVisible(true);
  }

  /** Windup: a glow gathers at the blade tip as the swing is drawn back. */
  public chargeWindup(segment: BladeSegment, weapon: WeaponConfig, progress: number): void {
    this.weapon = weapon;
    this.charge = { tip: { x: segment.tip.x, y: segment.tip.y }, progress };
  }

  /** Swing frame: extends the ribbon and emits afterimages and element particles. */
  public recordSwing(previous: BladeSegment, current: BladeSegment, weapon: WeaponConfig, sprite: WeaponSpriteState): void {
    const now = this.scene.time.now;
    this.weapon = weapon;
    if (!this.swinging) {
      this.swinging = true;
      this.charge = null;
      this.trail.clear();
      this.trail.push(previous, now);
    }
    this.trail.push(current, now);
    const profile = getSwingVfxProfile(weapon.element);
    const emitter = this.getEmitter(profile);
    const particles = scaleParticleCount(profile.particlesPerSample, this.particleScale());
    for (let index = 0; index < particles; index += 1) {
      const t = Math.random();
      emitter.emitParticleAt(Phaser.Math.Linear(previous.tip.x, current.tip.x, t), Phaser.Math.Linear(previous.tip.y, current.tip.y, t), 1);
    }
    if (!this.reducedMotion && now - this.lastAfterimageAt >= AFTERIMAGE_INTERVAL_MS) {
      this.lastAfterimageAt = now;
      this.spawnAfterimage(sprite, profile);
    }
  }

  /** The ribbon keeps fading on its own after the swing ends. */
  public endSwing(): void {
    this.swinging = false;
    this.charge = null;
  }

  /** `finisher`: the combo's last move adds a second, larger burst. */
  public playImpact(weapon: WeaponConfig, result: AttackResult, position: Phaser.Math.Vector2, finisher = false): void {
    const flash = this.scene.add.graphics().setDepth(20);
    flash.fillStyle(weapon.impactConfig.color, 0.9).fillCircle(position.x, position.y, 44);
    if (weapon.element === "雷") {
      flash.lineStyle(5, 0xdaf6ff, 1).beginPath().moveTo(position.x, position.y - 160).lineTo(position.x - 18, position.y - 85).lineTo(position.x + 22, position.y - 38).lineTo(position.x, position.y).strokePath();
    } else if (weapon.element === "月") {
      flash.lineStyle(7, 0xffffff, 0.9).arc(position.x, position.y, 54, Phaser.Math.DegToRad(210), Phaser.Math.DegToRad(30), false).strokePath();
      flash.fillStyle(0xe9f7ff, 0.95).fillCircle(position.x - 18, position.y - 18, 8).fillCircle(position.x + 30, position.y + 12, 6);
    } else {
      flash.lineStyle(6, weapon.impactConfig.color, 0.92).strokeCircle(position.x, position.y, 48);
      for (let angle = 0; angle < 360; angle += 60) {
        const radians = Phaser.Math.DegToRad(angle);
        flash.lineBetween(position.x, position.y, position.x + Math.cos(radians) * 72, position.y + Math.sin(radians) * 72);
      }
    }
    if (result.isCritical) {
      flash.lineStyle(8, 0xffdc68, 1).strokeCircle(position.x, position.y, 66);
    }
    const damage = this.scene.add.text(
      position.x,
      position.y - 60,
      result.isCritical ? `暴擊！ ${result.damage}` : `${result.damage}`,
      {
        fontSize: result.isCritical || finisher ? "40px" : "32px",
        fontStyle: "bold",
        color: result.isCritical ? "#ffe26f" : "#ecfbff",
        stroke: result.isCritical ? "#9b3a18" : "#225899",
        strokeThickness: result.isCritical ? 7 : 5,
      },
    ).setOrigin(0.5).setDepth(21);
    this.scene.tweens.add({ targets: [flash, damage], alpha: 0, y: "-=25", scale: 1.15, duration: 300, onComplete: () => { flash.destroy(); damage.destroy(); } });
    this.playShockwave(position, weapon.impactConfig.color, result.isCritical);
    if (this.tier.runeRing) this.playRuneRing(position);
    const impactParticles = scaleParticleCount(result.isCritical ? IMPACT_PARTICLES * 2 : IMPACT_PARTICLES, this.particleScale());
    this.getEmitter(getSwingVfxProfile(weapon.element)).emitParticleAt(position.x, position.y, impactParticles);
    if (finisher) this.playFinisherBurst(position, weapon.impactConfig.color);
  }

  /** Combo finisher: a wide white-gold ring plus radiating slash lines. */
  private playFinisherBurst(position: Phaser.Math.Vector2, color: number): void {
    const burst = this.scene.add.graphics().setDepth(19.6).setPosition(position.x, position.y).setBlendMode(Phaser.BlendModes.ADD);
    burst.lineStyle(8, 0xffffff, 0.95).strokeCircle(0, 0, 60);
    burst.lineStyle(4, GOLD, 0.85).strokeCircle(0, 0, 76);
    for (let angle = 15; angle < 360; angle += 45) {
      const radians = Phaser.Math.DegToRad(angle);
      burst.lineStyle(5, color, 0.9).lineBetween(Math.cos(radians) * 40, Math.sin(radians) * 40, Math.cos(radians) * 130, Math.sin(radians) * 130);
    }
    burst.setScale(0.4);
    this.scene.tweens.add({ targets: burst, scale: 2.1 * this.tier.shockwaveScale, alpha: 0, duration: 420, ease: "Cubic.easeOut", onComplete: () => burst.destroy() });
  }

  private render(): void {
    this.band.clear();
    this.core.clear();
    // Slow breathing pulse keeps the awakened blade alive while idle.
    if (this.glow?.visible) this.glow.setAlpha(0.55 + 0.2 * Math.sin(this.scene.time.now / 260));
    const weapon = this.weapon;
    if (!weapon) return;
    const profile = getSwingVfxProfile(weapon.element);
    if (this.charge) this.drawCharge(this.charge.tip, this.charge.progress, weapon, profile);
    const samples = this.trail.getFaded(this.scene.time.now);
    if (samples.length >= 2) this.drawRibbon(samples, weapon, profile);
  }

  private drawCharge(tip: Point, progress: number, weapon: WeaponConfig, profile: SwingVfxProfile): void {
    const p = Phaser.Math.Clamp(progress, 0, 1);
    this.core.fillStyle(weapon.trailConfig.color, 0.12 + 0.28 * p).fillCircle(tip.x, tip.y, 8 + 16 * p);
    this.core.fillStyle(profile.coreColor, 0.3 + 0.5 * p).fillCircle(tip.x, tip.y, 2.5 + 4 * p);
  }

  private drawRibbon(samples: readonly FadedTrailSample[], weapon: WeaponConfig, profile: SwingVfxProfile): void {
    const { color } = weapon.trailConfig;
    const width = weapon.trailConfig.width * this.tier.trailWidthScale;
    const alpha = Math.min(1, weapon.trailConfig.alpha * this.tier.trailAlphaScale);
    for (let index = 1; index < samples.length; index += 1) {
      const from = samples[index - 1];
      const to = samples[index];
      // Ease the fade so the ribbon holds its body, then thins out quickly.
      const strength = Math.pow((from.strength + to.strength) / 2, 1.4);
      if (strength <= 0.01) continue;
      // Soft body: outer 70% of the blade, where a real swing reads as a blur.
      this.band.fillStyle(color, alpha * 0.42 * strength).fillPoints([along(from, 0.3), from.tip, to.tip, along(to, 0.3)], true);
      // Wide glow along the tip path, matching the original single-line trail.
      this.band.lineStyle(width * 0.65 * strength, color, alpha * 0.55 * strength).lineBetween(from.tip.x, from.tip.y, to.tip.x, to.tip.y);
      // Bright cutting edge near the tip.
      this.core.fillStyle(color, alpha * 0.5 * strength).fillPoints([along(from, 0.8), from.tip, to.tip, along(to, 0.8)], true);
      this.core.lineStyle(1.5 + width * 0.14 * strength, profile.coreColor, 0.9 * strength).lineBetween(from.tip.x, from.tip.y, to.tip.x, to.tip.y);
      if (this.tier.goldEdge) {
        const a = this.outward(from, 5);
        const b = this.outward(to, 5);
        this.core.lineStyle(2.5, GOLD, 0.85 * strength).lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    if (profile.lightning && !this.reducedMotion) this.drawLightning(samples, color, profile.coreColor);
  }

  /** The tip pushed `distance` px further out along the blade. */
  private outward(sample: FadedTrailSample, distance: number): Point {
    const dx = sample.tip.x - sample.base.x;
    const dy = sample.tip.y - sample.base.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: sample.tip.x + dx / length * distance, y: sample.tip.y + dy / length * distance };
  }

  /** Re-randomised every frame so the arcs flicker along the freshest part of the trail. */
  private drawLightning(samples: readonly FadedTrailSample[], color: number, coreColor: number): void {
    const fresh = samples.filter(sample => sample.strength > 0.35);
    if (fresh.length < 2) return;
    const points = fresh.map((sample, index) => {
      const jitter = index === 0 || index === fresh.length - 1 ? 0 : Phaser.Math.Between(-14, 14);
      const dx = sample.tip.x - sample.base.x;
      const dy = sample.tip.y - sample.base.y;
      const length = Math.hypot(dx, dy) || 1;
      // Offset outward along the blade direction so arcs crackle just beyond the edge.
      const outward = 6 + Math.abs(jitter) * 0.5;
      return { x: sample.tip.x + dx / length * outward + (-dy / length) * jitter, y: sample.tip.y + dy / length * outward + (dx / length) * jitter };
    });
    this.core.lineStyle(6, color, 0.22).strokePoints(points, false);
    this.core.lineStyle(2, coreColor, 0.85).strokePoints(points, false);
  }

  private spawnAfterimage(sprite: WeaponSpriteState, profile: SwingVfxProfile): void {
    const ghost = this.scene.add.image(sprite.x, sprite.y, sprite.textureKey)
      .setOrigin(sprite.originX, sprite.originY)
      .setScale(sprite.scale)
      .setRotation(sprite.rotation)
      .setDepth(sprite.depths.afterimage)
      .setAlpha(this.tier.afterimageAlpha)
      .setTint(profile.afterimageTint)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: AFTERIMAGE_FADE_MS, ease: "Quad.easeOut", onComplete: () => ghost.destroy() });
    if (this.tier.afterimageLayers < 2) return;
    // Immortal awakening: a larger, longer-lived gold echo behind the first afterimage.
    const echo = this.scene.add.image(sprite.x, sprite.y, sprite.textureKey)
      .setOrigin(sprite.originX, sprite.originY)
      .setScale(sprite.scale * 1.08)
      .setRotation(sprite.rotation)
      .setDepth(sprite.depths.echo)
      .setAlpha(this.tier.afterimageAlpha * 0.6)
      .setTint(GOLD)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: echo, alpha: 0, duration: AFTERIMAGE_FADE_MS * 1.5, ease: "Quad.easeOut", onComplete: () => echo.destroy() });
  }

  private playShockwave(position: Phaser.Math.Vector2, color: number, isCritical: boolean): void {
    const ring = this.scene.add.graphics().setDepth(19).setPosition(position.x, position.y).setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(isCritical ? 6 : 4, color, 0.9).strokeCircle(0, 0, 44);
    ring.setScale(0.35);
    const finalScale = (isCritical ? 2 : 1.6) * this.tier.shockwaveScale;
    this.scene.tweens.add({ targets: ring, scale: finalScale, alpha: 0, duration: 280, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
  }

  /** Immortal awakening: a gold ring of eight rune marks that turns as it expands. */
  private playRuneRing(position: Phaser.Math.Vector2): void {
    const ring = this.scene.add.graphics().setDepth(19.5).setPosition(position.x, position.y).setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(3, GOLD, 0.9).strokeCircle(0, 0, 62);
    ring.lineStyle(1.5, GOLD, 0.6).strokeCircle(0, 0, 54);
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      const x = Math.cos(angle) * 62;
      const y = Math.sin(angle) * 62;
      ring.fillStyle(GOLD, 0.95).fillPoints([
        { x: x + Math.cos(angle) * 7, y: y + Math.sin(angle) * 7 },
        { x: x + Math.cos(angle + Math.PI / 2) * 4, y: y + Math.sin(angle + Math.PI / 2) * 4 },
        { x: x - Math.cos(angle) * 7, y: y - Math.sin(angle) * 7 },
        { x: x - Math.cos(angle + Math.PI / 2) * 4, y: y - Math.sin(angle + Math.PI / 2) * 4 },
      ], true);
    }
    ring.setScale(0.8);
    this.scene.tweens.add({ targets: ring, scale: 1.3, angle: 90, alpha: 0, duration: 420, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
  }

  private getEmitter(profile: SwingVfxProfile): Phaser.GameObjects.Particles.ParticleEmitter {
    const key = `${profile.particle}:${profile.particleTints.join(",")}:${profile.particleGravity}`;
    const existing = this.emitters.get(key);
    if (existing) return existing;
    const emitter = this.scene.add.particles(0, 0, `${TEXTURE_PREFIX}${profile.particle}`, {
      emitting: false,
      lifespan: { min: 240, max: 460 },
      speed: { min: 15, max: 85 },
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.15 },
      alpha: { start: 0.95, end: 0 },
      gravityY: profile.particleGravity,
      tint: [...profile.particleTints],
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(9);
    this.emitters.set(key, emitter);
    return emitter;
  }

  /** Small white silhouettes, tinted per element at emit time. */
  private ensureParticleTextures(): void {
    PARTICLE_SHAPES.forEach(shape => {
      const key = `${TEXTURE_PREFIX}${shape}`;
      if (this.scene.textures.exists(key)) return;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      switch (shape) {
        case "spark":
          g.fillRoundedRect(0, 0, 14, 4, 2);
          g.generateTexture(key, 14, 4);
          break;
        case "glint":
          g.fillPoints([{ x: 8, y: 0 }, { x: 9.6, y: 6.4 }, { x: 16, y: 8 }, { x: 9.6, y: 9.6 }, { x: 8, y: 16 }, { x: 6.4, y: 9.6 }, { x: 0, y: 8 }, { x: 6.4, y: 6.4 }], true);
          g.generateTexture(key, 16, 16);
          break;
        case "shard":
          g.fillPoints([{ x: 3, y: 0 }, { x: 6, y: 7 }, { x: 3, y: 14 }, { x: 0, y: 7 }], true);
          g.generateTexture(key, 6, 14);
          break;
        case "petal":
          g.fillEllipse(5, 3.5, 10, 7);
          g.generateTexture(key, 10, 7);
          break;
        case "mote":
          g.fillStyle(0xffffff, 0.25).fillCircle(5, 5, 5);
          g.fillStyle(0xffffff, 0.55).fillCircle(5, 5, 3.4);
          g.fillStyle(0xffffff, 1).fillCircle(5, 5, 1.8);
          g.generateTexture(key, 10, 10);
          break;
      }
      g.destroy();
    });
  }
}
