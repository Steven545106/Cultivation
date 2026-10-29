import { describe, expect, it } from "vitest";
import { weaponConfigById } from "../../weapon";
import { sweptBladeHitsCircle } from "../domain/SweepGeometry";
import { resolveSweepHit, type SweepHitQuery } from "./ResolveSweepHit";

const timeline = weaponConfigById.get("weapon_01")!.attackTimeline;
const centre = { x: 100, y: 0 };

// A blade swinging from pointing up to pointing right, sweeping across the target.
const before = { base: { x: 0, y: -20 }, tip: { x: 0, y: -150 } };
const after = { base: { x: 20, y: 0 }, tip: { x: 150, y: 0 } };

const query: SweepHitQuery = {
  alreadyHit: false,
  targetAlive: true,
  timeline,
  progress: (timeline.activeStart + timeline.activeEnd) / 2,
  previous: before,
  current: after,
  targetCentre: centre,
  hitRadius: 10,
};

describe("sweep geometry", () => {
  it("hits when the current blade passes through the circle", () => {
    expect(sweptBladeHitsCircle(before, after, centre, 10)).toBe(true);
  });

  it("catches a fast swing whose tip path crosses the target between samples", () => {
    const left = { base: { x: -5, y: 0 }, tip: { x: -5, y: -100 } };
    const right = { base: { x: 5, y: 0 }, tip: { x: 5, y: -100 } };
    expect(sweptBladeHitsCircle({ base: left.base, tip: { x: -100, y: -100 } }, { base: right.base, tip: { x: 100, y: -100 } }, { x: 0, y: -100 }, 4)).toBe(true);
  });

  it("misses a target outside every sampled segment and the tip path", () => {
    expect(sweptBladeHitsCircle(before, after, { x: -200, y: 200 }, 10)).toBe(false);
  });

  it("handles a zero-length segment", () => {
    const point = { base: { x: 0, y: 0 }, tip: { x: 0, y: 0 } };
    expect(sweptBladeHitsCircle(point, point, { x: 3, y: 4 }, 5)).toBe(true);
    expect(sweptBladeHitsCircle(point, point, { x: 3, y: 4 }, 4.9)).toBe(false);
  });
});

describe("resolve sweep hit", () => {
  it("lands a hit inside the active window on a live target", () => {
    expect(resolveSweepHit(query)).toBe(true);
  });

  it("hits the same target only once per attack", () => {
    expect(resolveSweepHit({ ...query, alreadyHit: true })).toBe(false);
  });

  it("ignores dead targets", () => {
    expect(resolveSweepHit({ ...query, targetAlive: false })).toBe(false);
  });

  it("ignores contact outside the active window", () => {
    expect(resolveSweepHit({ ...query, progress: timeline.activeStart - 0.01 })).toBe(false);
    expect(resolveSweepHit({ ...query, progress: timeline.activeEnd + 0.01 })).toBe(false);
  });
});
