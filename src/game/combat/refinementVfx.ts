import { IMMORTAL_AWAKENING_LEVEL, normalizeRefinementLevel, SPIRIT_AWAKENING_LEVEL } from "../../features/refinement";

export type RefinementAwakening = "none" | "spirit" | "immortal";

/** Visual intensity of a sword's refinement level, layered on top of its element profile. */
export interface RefinementVfxTier {
  readonly awakening: RefinementAwakening;
  readonly trailWidthScale: number;
  readonly trailAlphaScale: number;
  readonly particleScale: number;
  /** Element-coloured halo that stays on the blade (+11). */
  readonly bladeGlow: boolean;
  readonly afterimageAlpha: number;
  /** A second, larger gold afterimage (+21). */
  readonly afterimageLayers: 1 | 2;
  /** Gold line along the outer edge of the trail (+21). */
  readonly goldEdge: boolean;
  readonly shockwaveScale: number;
  /** Rotating gold rune ring on impact (+21). */
  readonly runeRing: boolean;
}

const BASE_AFTERIMAGE_ALPHA = 0.3;

/**
 * +1～+10 grow gradually (up to +20% width, +15% brightness, +30% particles);
 * +11 spirit awakening adds the blade glow, 1.5× particles and clearer
 * afterimages; +21 immortal awakening adds the gold edge, a second afterimage,
 * a larger shockwave and the rune ring.
 */
export function getRefinementVfxTier(refinementLevel: number): RefinementVfxTier {
  const level = normalizeRefinementLevel(refinementLevel);
  const gradual = Math.min(level, SPIRIT_AWAKENING_LEVEL - 1);
  const spirit = level >= SPIRIT_AWAKENING_LEVEL;
  const immortal = level >= IMMORTAL_AWAKENING_LEVEL;
  return {
    awakening: immortal ? "immortal" : spirit ? "spirit" : "none",
    trailWidthScale: 1 + gradual * 0.02 + (immortal ? 0.1 : 0),
    trailAlphaScale: 1 + gradual * 0.015,
    particleScale: immortal ? 1.8 : spirit ? 1.5 : 1 + gradual * 0.03,
    bladeGlow: spirit,
    afterimageAlpha: spirit ? 0.42 : BASE_AFTERIMAGE_ALPHA,
    afterimageLayers: immortal ? 2 : 1,
    goldEdge: immortal,
    shockwaveScale: immortal ? 1.35 : 1,
    runeRing: immortal,
  };
}

/** Turns a fractional particle count into a whole count with the right average. */
export function scaleParticleCount(base: number, scale: number, randomValue = Math.random()): number {
  const exact = base * scale;
  const whole = Math.floor(exact);
  return whole + (randomValue < exact - whole ? 1 : 0);
}
