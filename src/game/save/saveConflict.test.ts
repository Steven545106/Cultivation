import { describe, expect, it } from "vitest";
import { chooseSaveOnSignIn, summarizeSave } from "./saveConflict";

const save = (stageId: string, highestClearedStage: number, updatedAt = 0) => ({ cultivation: { stageId }, tower: { highestClearedStage }, spiritStones: 500, updatedAt });

describe("sign-in save choice", () => {
  it("loads the cloud save unless this device has progress the cloud lacks", () => {
    expect(chooseSaveOnSignIn(save("qi-3", 20), save("qi-5", 40))).toBe("cloud");
    expect(chooseSaveOnSignIn(save("qi-5", 40), save("qi-5", 40))).toBe("cloud");
    // A stale device re-stamps its save every second: a newer timestamp alone never wins.
    expect(chooseSaveOnSignIn(save("qi-3", 20, 9e12), save("qi-5", 40, 1))).toBe("cloud");
    expect(chooseSaveOnSignIn(save("foundation-1", 40), save("qi-10", 40))).toBe("ask");
    expect(chooseSaveOnSignIn(save("qi-5", 41), save("qi-5", 40))).toBe("ask");
  });

  it("describes each side for the player", () => {
    expect(summarizeSave(save("foundation-2", 120, 5))).toEqual({ realmNameZh: "築基中期", towerCleared: 120, spiritStones: 500, updatedAt: 5 });
  });
});
