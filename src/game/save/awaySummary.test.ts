import { describe, expect, it } from "vitest";
import { createCultivationState } from "../../features/cultivation/domain/CultivationState";
import { realmConfigs } from "../../features/cultivation/domain/RealmCatalog";
import { AWAY_SUMMARY_MIN_SECONDS, summarizeAway } from "./awaySummary";

const at = (seconds: number, stageId = "qi-1", earned = 0, current = 0) => ({
  cultivation: { ...createCultivationState(0), stageId, realmId: stageId.split("-")[0] as "qi", lastCultivationTimestamp: seconds * 1000, totalCultivationEarned: earned, currentCultivation: current },
  totalSpiritStonesEarned: earned / 10,
  demonCores: earned / 100,
});

describe("away summary", () => {
  it("reports what an absence earned and the stages it climbed", () => {
    expect(summarizeAway(at(0), at(3_600, "qi-3", 9_000))).toEqual({
      seconds: 3_600, cultivation: 9_000, spiritStones: 900, demonCores: 90,
      fromStageNameZh: "凝氣一層", toStageNameZh: "凝氣三層", breakthroughToNameZh: null,
    });
  });

  it("says when a breakthrough is waiting", () => {
    const qiTen = realmConfigs.find(stage => stage.stageId === "qi-10")!;
    expect(summarizeAway(at(0, "qi-9"), at(7_200, "qi-10", 50_000, qiTen.cultivationRequired!))?.breakthroughToNameZh).toBe("築基初期");
  });

  it("stays quiet for short absences or when nothing was earned", () => {
    expect(summarizeAway(at(0), at(AWAY_SUMMARY_MIN_SECONDS - 1, "qi-1", 500))).toBeNull();
    expect(summarizeAway(at(0), at(3_600))).toBeNull();
  });
});
