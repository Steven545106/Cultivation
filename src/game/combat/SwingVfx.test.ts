import { describe, expect, it } from "vitest";
import { weaponConfigs } from "../../features/weapon";
import { getInterpolationSteps, interpolateBladeSegments, SwingTrailBuffer } from "./SwingTrailBuffer";
import { getSwingVfxProfile } from "./swingVfxProfiles";

const up = { base: { x: 0, y: 0 }, tip: { x: 0, y: -100 } };
const right = { base: { x: 0, y: 0 }, tip: { x: 100, y: 0 } };

describe("swing VFX profiles", () => {
  it("gives every sword's element a profile with at least one particle tint", () => {
    weaponConfigs.forEach(weapon => {
      const profile = getSwingVfxProfile(weapon.element);
      expect(profile.particleTints.length).toBeGreaterThan(0);
      expect(profile.particlesPerSample).toBeGreaterThan(0);
    });
  });

  it("only the thunder element draws lightning arcs", () => {
    expect(weaponConfigs.filter(weapon => getSwingVfxProfile(weapon.element).lightning).map(weapon => weapon.element)).toEqual(["雷"]);
  });
});

describe("blade interpolation", () => {
  it("rotates around the base so inserted tips stay on the arc", () => {
    const [middle] = interpolateBladeSegments(up, right, 2);
    expect(Math.hypot(middle.tip.x, middle.tip.y)).toBeCloseTo(100);
    expect(middle.tip.x).toBeCloseTo(Math.SQRT1_2 * 100);
    expect(middle.tip.y).toBeCloseTo(-Math.SQRT1_2 * 100);
  });

  it("subdivides large rotations, capped at eight steps", () => {
    expect(getInterpolationSteps(up, up)).toBe(1);
    expect(getInterpolationSteps(up, { base: up.base, tip: { x: Math.sin(0.15) * 100, y: -Math.cos(0.15) * 100 } })).toBe(2);
    expect(getInterpolationSteps(up, right)).toBe(8);
  });
});

describe("swing trail buffer", () => {
  it("fills gaps between fast frames and fades samples over their lifetime", () => {
    const buffer = new SwingTrailBuffer(100);
    buffer.push(up, 0);
    buffer.push(right, 16);
    expect(buffer.size).toBe(9);
    const faded = buffer.getFaded(66);
    expect(faded[0].strength).toBeCloseTo(0.34);
    expect(faded[faded.length - 1].strength).toBeCloseTo(0.5);
  });

  it("drops expired samples", () => {
    const buffer = new SwingTrailBuffer(100);
    buffer.push(up, 0);
    expect(buffer.getFaded(100)).toEqual([]);
    expect(buffer.size).toBe(0);
  });

  it("keeps only the newest samples past the cap", () => {
    const buffer = new SwingTrailBuffer(1_000, 4);
    for (let time = 0; time < 10; time += 1) buffer.push(up, time);
    expect(buffer.getFaded(10).map(sample => sample.time)).toEqual([6, 7, 8, 9]);
  });
});
