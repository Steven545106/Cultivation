import { describe, expect, it } from "vitest";
import { startTowerChallenge } from "./TowerChallenge";
import { getRequiredRealmForStage, getTowerStageCapForRealm, isTowerStageRealmLocked } from "./TowerRealmGate";
import { canChallengeTowerStage, createTowerProgress } from "./TowerState";

describe("tower realm gate", () => {
  it("opens 10 floors per major realm, eternal from floor 91", () => {
    expect(getTowerStageCapForRealm("qi")).toBe(100);
    expect(getTowerStageCapForRealm("foundation")).toBe(200);
    expect(getTowerStageCapForRealm("sovereign")).toBe(900);
    expect(getTowerStageCapForRealm("eternal")).toBe(1000);
    expect(getRequiredRealmForStage(100)).toBe("qi");
    expect(getRequiredRealmForStage(101)).toBe("foundation");
    expect(getRequiredRealmForStage(900)).toBe("sovereign");
    expect(getRequiredRealmForStage(901)).toBe("eternal");
    expect(getRequiredRealmForStage(1000)).toBe("eternal");
  });

  it("locks stages beyond the realm even when tower progress has unlocked them", () => {
    const progress = { ...createTowerProgress(), unlockedStage: 901, highestClearedStage: 900, selectedStage: 901 };
    expect(isTowerStageRealmLocked(901, "sovereign")).toBe(true);
    expect(canChallengeTowerStage(progress, 901, "sovereign")).toBe(false);
    expect(canChallengeTowerStage(progress, 901, "eternal")).toBe(true);
    expect(canChallengeTowerStage(progress, 900, "sovereign")).toBe(true);
    expect(() => startTowerChallenge(progress, 901, 0, "sovereign")).toThrow(/locked/);
    expect(startTowerChallenge(progress, 901, 0, "eternal").stage.stageNumber).toBe(901);
  });
});
