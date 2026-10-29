import Phaser from "phaser";
import type { TowerAmbientKind, TowerTheme } from "../../features/tower";
import { ensureTowerFxTextures, FX_LEAF, FX_PETAL, FX_SOFT, FX_STAR } from "./towerFxTextures";

/** The battle scene's logical size (the camera zooms the 1920x1080 canvas onto it). */
const WIDTH = 1280;
const HEIGHT = 720;
/** Behind the monster (4) and the hero, in front of the background. */
const DEPTH = 1.5;

type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

interface AmbientLook {
  readonly texture: string;
  readonly config: EmitterConfig;
  /** How long the first particles take to cross the scene, to pre-fill it. */
  readonly warmUpMs: number;
}

const LOOKS: Readonly<Record<TowerAmbientKind, (tints: readonly number[]) => AmbientLook>> = {
  mist: tints => ({
    texture: FX_SOFT,
    warmUpMs: 12000,
    config: { x: { min: -120, max: -40 }, y: { min: 260, max: 640 }, speedX: { min: 18, max: 40 }, speedY: { min: -4, max: 4 }, lifespan: 40000, scale: { min: 3.2, max: 4.6 }, alpha: { values: [0, 0.12, 0.12, 0] }, tint: [...tints], frequency: 3500, quantity: 1 },
  }),
  leaf: tints => ({
    texture: FX_LEAF,
    warmUpMs: 9000,
    config: { x: { min: 0, max: WIDTH }, y: -24, speedX: { min: -24, max: 36 }, speedY: { min: 40, max: 82 }, rotate: { min: 0, max: 360 }, lifespan: 10500, scale: { min: 0.5, max: 0.95 }, alpha: { values: [0, 0.85, 0.85, 0] }, tint: [...tints], frequency: 380, quantity: 1 },
  }),
  ember: tints => ({
    texture: FX_SOFT,
    warmUpMs: 6500,
    config: { x: { min: 0, max: WIDTH }, y: HEIGHT + 20, speedX: { min: -24, max: 24 }, speedY: { min: -120, max: -52 }, lifespan: 6500, scale: { start: 0.3, end: 0.04 }, alpha: { values: [0, 0.95, 0.7, 0] }, tint: [...tints], blendMode: Phaser.BlendModes.ADD, frequency: 140, quantity: 1 },
  }),
  snow: tints => ({
    texture: FX_SOFT,
    warmUpMs: 11000,
    config: { x: { min: 0, max: WIDTH }, y: -20, speedX: { min: -16, max: 16 }, speedY: { min: 30, max: 72 }, lifespan: 11500, scale: { min: 0.14, max: 0.3 }, alpha: { values: [0, 0.9, 0.9, 0] }, tint: [...tints], frequency: 150, quantity: 1 },
  }),
  spark: tints => ({
    texture: FX_STAR,
    warmUpMs: 0,
    config: { x: { min: 40, max: WIDTH - 40 }, y: { min: 60, max: 560 }, speed: 0, lifespan: { min: 220, max: 520 }, scale: { start: 0.6, end: 0.05 }, rotate: { min: 0, max: 90 }, alpha: { values: [0, 1, 0] }, tint: [...tints], blendMode: Phaser.BlendModes.ADD, frequency: 240, quantity: 1 },
  }),
  star: tints => ({
    texture: FX_STAR,
    warmUpMs: 4500,
    config: { x: { min: 0, max: WIDTH }, y: { min: 0, max: 520 }, speed: 0, lifespan: { min: 2600, max: 4600 }, scale: { min: 0.12, max: 0.34 }, alpha: { values: [0, 0.95, 0] }, tint: [...tints], blendMode: Phaser.BlendModes.ADD, frequency: 180, quantity: 1 },
  }),
  petal: tints => ({
    texture: FX_PETAL,
    warmUpMs: 10500,
    config: { x: { min: 0, max: WIDTH + 120 }, y: -24, speedX: { min: -66, max: -22 }, speedY: { min: 38, max: 84 }, rotate: { min: 0, max: 360 }, lifespan: 10500, scale: { min: 0.4, max: 0.85 }, alpha: { values: [0, 0.9, 0.9, 0] }, tint: [...tints], frequency: 330, quantity: 1 },
  }),
  mote: tints => ({
    texture: FX_SOFT,
    warmUpMs: 9000,
    config: { x: { min: 0, max: WIDTH }, y: { min: HEIGHT - 40, max: HEIGHT + 30 }, speedX: { min: -12, max: 12 }, speedY: { min: -52, max: -24 }, lifespan: 9500, scale: { min: 0.22, max: 0.5 }, alpha: { values: [0, 0.8, 0.8, 0] }, tint: [...tints], blendMode: Phaser.BlendModes.ADD, frequency: 200, quantity: 1 },
  }),
};

/**
 * Slow drifting particles behind the fight that follow the floor's theme: mist,
 * leaves, embers, snow, sparks, stars, petals or glowing motes.
 */
export class TowerAmbience {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private themeId: string | null = null;
  private readonly reducedMotion = typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  public constructor(private readonly scene: Phaser.Scene) {
    ensureTowerFxTextures(scene);
  }

  public setTheme(theme: TowerTheme): void {
    if (theme.id === this.themeId) return;
    this.themeId = theme.id;
    this.emitter?.destroy();
    const look = LOOKS[theme.ambient](theme.ambientTints);
    const config: EmitterConfig = this.reducedMotion ? { ...look.config, frequency: (look.config.frequency as number) * 2.5 } : look.config;
    const emitter = this.scene.add.particles(0, 0, look.texture, config).setDepth(DEPTH);
    // Start with the scene already populated instead of waiting for the first particles to cross it.
    if (look.warmUpMs > 0) emitter.fastForward(look.warmUpMs);
    this.emitter = emitter;
  }

  public destroy(): void {
    this.emitter?.destroy();
    this.emitter = null;
    this.themeId = null;
  }
}
