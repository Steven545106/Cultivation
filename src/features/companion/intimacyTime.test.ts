import { describe, expect, it } from "vitest";
import { INTIMACY_POINT_MS, settleIntimacy, migrateIntimacyRemainder } from "./intimacyTime";

describe("雙修時間與親密度", () => {
  it("按時間累積並保留未滿一點的時間，不重複結算", () => {
    const first = settleIntimacy(0, 0, 1000, 1000 + INTIMACY_POINT_MS / 2, true);
    expect(first.points).toBe(0);
    const second = settleIntimacy(first.points, first.remainderMs, first.timestamp, 1000 + INTIMACY_POINT_MS, true);
    expect(second.points).toBe(1);
    expect(settleIntimacy(second.points, second.remainderMs, second.timestamp, second.timestamp, true).points).toBe(1);
  });
  it("未雙修不累積，離線時間可累積且不超過五級上限", () => {
    expect(settleIntimacy(0, 0, 1, 1 + INTIMACY_POINT_MS * 4, false).points).toBe(0);
    expect(settleIntimacy(99, 0, 1, 1 + INTIMACY_POINT_MS * 4, true).points).toBe(100);
  });
  it("舊版累積時間換算後不遺失，且不突破上限", () => {
    expect(migrateIntimacyRemainder(5, 25 * 60 * 1000)).toEqual({ points: 7, remainderMs: 5 * 60 * 1000 });
    expect(migrateIntimacyRemainder(99, 25 * 60 * 1000)).toEqual({ points: 100, remainderMs: 0 });
  });
});
