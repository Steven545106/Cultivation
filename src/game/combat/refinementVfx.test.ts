import { describe, expect, it } from "vitest";
import { getNewRefinementAwakening } from "../../features/refinement";
import { getRefinementVfxTier, scaleParticleCount } from "./refinementVfx";

describe("refinement VFX tiers", () => {
  it("leaves +0 at the element's baseline look", () => {
    expect(getRefinementVfxTier(0)).toMatchObject({ awakening: "none", trailWidthScale: 1, trailAlphaScale: 1, particleScale: 1, bladeGlow: false, afterimageLayers: 1, goldEdge: false, runeRing: false });
  });

  it("grows gradually through +10 without any awakening features", () => {
    const tier = getRefinementVfxTier(10);
    expect(tier.trailWidthScale).toBeCloseTo(1.2);
    expect(tier.trailAlphaScale).toBeCloseTo(1.15);
    expect(tier.particleScale).toBeCloseTo(1.3);
    expect(tier.bladeGlow).toBe(false);
    expect(getRefinementVfxTier(5).trailWidthScale).toBeLessThan(tier.trailWidthScale);
  });

  it("adds the blade glow and 1.5× particles at +11", () => {
    expect(getRefinementVfxTier(11)).toMatchObject({ awakening: "spirit", bladeGlow: true, particleScale: 1.5, goldEdge: false, afterimageLayers: 1 });
    expect(getRefinementVfxTier(11).afterimageAlpha).toBeGreaterThan(getRefinementVfxTier(10).afterimageAlpha);
  });

  it("adds the gold edge, double afterimage, bigger shockwave and rune ring at +21", () => {
    expect(getRefinementVfxTier(21)).toMatchObject({ awakening: "immortal", bladeGlow: true, goldEdge: true, afterimageLayers: 2, runeRing: true });
    expect(getRefinementVfxTier(21).shockwaveScale).toBeGreaterThan(1);
  });

  it("reports an awakening only on the step that crosses a threshold", () => {
    expect(getNewRefinementAwakening(10, 11)).toBe("spirit");
    expect(getNewRefinementAwakening(11, 12)).toBe("none");
    expect(getNewRefinementAwakening(20, 21)).toBe("immortal");
    expect(getNewRefinementAwakening(5, 25)).toBe("immortal");
  });

  it("rounds fractional particle counts so the average is kept", () => {
    expect(scaleParticleCount(2, 1.5, 0.99)).toBe(3);
    expect(scaleParticleCount(1, 1.3, 0.2)).toBe(2);
    expect(scaleParticleCount(1, 1.3, 0.5)).toBe(1);
  });
});
