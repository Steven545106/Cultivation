import { describe, expect, it } from "vitest";
import { cyclePhase, hash01, qiStage, smoothstep, window01 } from "./qiBreath";

describe("qi breathing cycle", () => {
  it("wraps time into a 0..1 phase, even for negative times", () => {
    expect(cyclePhase(0, 1000)).toBe(0);
    expect(cyclePhase(250, 1000)).toBeCloseTo(0.25);
    expect(cyclePhase(1250, 1000)).toBeCloseTo(0.25);
    expect(cyclePhase(-250, 1000)).toBeCloseTo(0.75);
    expect(cyclePhase(5, 0)).toBeGreaterThanOrEqual(0);
  });

  it("moves through inhale, circulate, peak and exhale in order", () => {
    const at = (phase: number) => qiStage(phase);
    expect(at(0.2).inhale).toBeGreaterThan(0.9);
    expect(at(0.2).peak).toBe(0);
    expect(at(0.5).circulate).toBeGreaterThan(0.9);
    expect(at(0.7).peak).toBeGreaterThan(0.9);
    expect(at(0.88).exhale).toBeGreaterThan(0.9);
    expect(at(0.88).inhale).toBe(0);
  });

  it("starts and ends the loop quiet so it repeats without a jump", () => {
    const start = qiStage(0);
    const end = qiStage(0.9999);
    for (const stage of [start, end]) {
      expect(stage.circulate).toBe(0);
      expect(stage.peak).toBe(0);
    }
    expect(start.breath).toBeCloseTo(end.breath, 2);
  });

  it("fills the lungs at the middle of the cycle", () => {
    expect(qiStage(0.5).breath).toBeCloseTo(1);
    expect(qiStage(0).breath).toBeCloseTo(0);
  });

  it("keeps helper curves inside their ranges", () => {
    expect(smoothstep(0, 1, -3)).toBe(0);
    expect(smoothstep(0, 1, 4)).toBe(1);
    expect(window01(0.4, 0.6, 0.1, 0.1, 0.5)).toBe(1);
    expect(window01(0.4, 0.6, 0.1, 0.1, 0.1)).toBe(0);
    for (let index = 0; index < 50; index += 1) {
      const value = hash01(index, 3);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
