import { describe, expect, it } from "vitest";
import { calculateFinalCombatStats, resolveHitDamage } from "../../combat";
import { applyMonsterDamage, getMonsterHealthRatio } from "../domain/MonsterState";
import { createTrainingDummy, formatTrainingDummyLabel, TRAINING_DUMMY_MAX_HP } from "./TrainingDummy";

describe("training dummy fixture", () => {
  it("starts at 2000 HP with the original label", () => {
    const dummy = createTrainingDummy();
    expect(dummy.maxHp).toBe(TRAINING_DUMMY_MAX_HP);
    expect(formatTrainingDummyLabel(dummy)).toBe("測試妖獸　2000 / 2000");
  });

  it("tracks damage, health ratio and defeat", () => {
    let dummy = applyMonsterDamage(createTrainingDummy(), 500);
    expect(formatTrainingDummyLabel(dummy)).toBe("測試妖獸　1500 / 2000");
    expect(getMonsterHealthRatio(dummy)).toBe(0.75);
    dummy = applyMonsterDamage(dummy, 5_000);
    expect(dummy.status).toBe("dead");
    expect(formatTrainingDummyLabel(dummy)).toBe("測試妖獸　已擊敗");
  });
});

describe("hit damage", () => {
  it("falls back to rounded weapon base damage without a crit before stats exist", () => {
    expect(resolveHitDamage(null, 124.6, 0)).toEqual({ isCritical: false, damage: 125 });
  });

  it("uses the domain crit roll once stats are available", () => {
    const stats = calculateFinalCombatStats({ attackMultiplier: 1, critRate: 0.5 }, { attack: 100, critRate: 0, attackSpeed: 1 }, 0);
    expect(resolveHitDamage(stats, 999, 0.1)).toEqual({ isCritical: true, damage: 200 });
    expect(resolveHitDamage(stats, 999, 0.9)).toEqual({ isCritical: false, damage: 100 });
  });
});
