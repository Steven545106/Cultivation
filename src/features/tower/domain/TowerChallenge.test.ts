import { describe, expect, it } from "vitest";
import {
  applyTowerDamage,
  completeTowerStage,
  createTowerProgress,
  evaluateTowerChallenge,
  getTowerClearReward,
  getTowerFarmStage,
  getTowerRepeatReward,
  getTowerRequiredDps,
  getTowerStage,
  startTowerChallenge,
  towerStages,
} from "..";

describe("pure-output tower", () => {
  it("generates exactly 100 floors and 1,000 stages with a boss at every tenth stage", () => {
    expect(towerStages).toHaveLength(1_000);
    expect(getTowerStage(1)).toMatchObject({ floor: 1, room: 1, isBoss: false, timeLimitSeconds: 30 });
    expect(getTowerStage(10)).toMatchObject({ floor: 1, room: 10, isBoss: true, timeLimitSeconds: 60 });
    expect(getTowerStage(1_000)).toMatchObject({ floor: 100, room: 10, isBoss: true });
  });

  it("derives HP from the static required-DPS curve, never a player's current DPS", () => {
    // 72 DPS × 30 s: sized for the hero alone (the spirit beast is extra).
    expect(getTowerStage(1).monsterMaxHp).toBe(2_160);
    for (const stage of [1, 5, 9, 10, 500, 1_000].map(getTowerStage)) {
      const expected = getTowerRequiredDps(stage.stageNumber, stage.monsterKind) * stage.timeLimitSeconds;
      expect(stage.monsterMaxHp).toBe(Math.round(expected));
    }
  });

  it("grows each kind's required DPS stage by stage and peaks every floor at the boss", () => {
    const byKind = new Map<string, number>();
    for (const stage of towerStages) {
      const previous = byKind.get(stage.monsterKind);
      if (previous !== undefined) expect(stage.requiredDps).toBeGreaterThan(previous);
      byKind.set(stage.monsterKind, stage.requiredDps);
    }
    for (let floor = 1; floor <= 100; floor += 1) {
      const rooms = towerStages.slice((floor - 1) * 10, floor * 10);
      expect(Math.max(...rooms.map(room => room.requiredDps))).toBe(rooms[9].requiredDps);
    }
  });

  it("sizes first-clear cultivation by the expected realm's rate", () => {
    expect(getTowerClearReward(getTowerStage(1)).cultivation).toBe(2 * 30);
    expect(getTowerClearReward(getTowerStage(10)).cultivation).toBe(2 * 150);
    expect(getTowerStage(1_000).expectedRealmId).toBe("eternal");
    expect(getTowerClearReward(getTowerStage(1_000)).cultivation).toBe(43_740 * 150);
  });

  it("only lets player damage reduce passive monster HP and clears once at zero", () => {
    const initial = startTowerChallenge(createTowerProgress(), 1, 10_000);
    expect("attack" in initial.monster).toBe(false);
    const hit = applyTowerDamage(initial, initial.monster.maxHp - 1, 10_001);
    expect(hit.status).toBe("active");
    expect(hit.monster.currentHp).toBe(1);
    const cleared = applyTowerDamage(hit, 1, 10_002);
    expect(cleared.status).toBe("cleared");
    expect(applyTowerDamage(cleared, 999, 10_003)).toBe(cleared);
  });

  it("fails only on the centralised time limit without removing any progress", () => {
    const progress = createTowerProgress();
    const challenge = startTowerChallenge(progress, 1, 10_000);
    expect(evaluateTowerChallenge(challenge, challenge.expiresAt - 1).status).toBe("active");
    expect(evaluateTowerChallenge(challenge, challenge.expiresAt).status).toBe("failed");
    expect(progress).toEqual(createTowerProgress());
  });

  it("unlocks the next stage and awards a first-clear reward exactly once", () => {
    const stage = getTowerStage(1);
    const first = completeTowerStage(createTowerProgress(), stage);
    expect(first.progress).toMatchObject({ highestClearedStage: 1, unlockedStage: 2, selectedStage: 2 });
    expect(first.reward?.spiritStones).toBeGreaterThan(0);
    expect(first.reward?.cultivation).toBeGreaterThan(0);
    const replay = completeTowerStage(first.progress, stage);
    expect(replay.reward).toBeNull();
    expect(replay.progress).toBe(first.progress);
  });

  it("drops part of the first-clear reward when the realm-gated stage is cleared again, once per 45 s", () => {
    // 凝氣 opens floors 1–10: after stage 100 the next stage needs 築基.
    const gated = { ...createTowerProgress(), highestClearedStage: 100, unlockedStage: 101, selectedStage: 101 };
    expect(getTowerFarmStage(gated, "qi")).toBe(100);
    expect(getTowerFarmStage(gated, "foundation")).toBeNull();
    const boss = getTowerStage(100);
    const first = getTowerClearReward(boss);
    const drop = completeTowerStage(gated, boss, "qi", 100_000);
    expect(drop).toMatchObject({ repeat: true, nextRepeatDropAt: 145_000 });
    expect(drop.reward).toEqual(getTowerRepeatReward(boss));
    expect(drop.reward!.cultivation).toBe(Math.round(first.cultivation * 0.1));
    expect(drop.reward!.spiritStones).toBe(Math.round(first.spiritStones * 0.03));
    expect(drop.progress).toEqual({ ...gated, lastRepeatDropAt: 100_000 });
    // A faster kill (battle speed, a strong sword, a second tab) waits for the interval.
    expect(completeTowerStage(drop.progress, boss, "qi", 120_000)).toMatchObject({ reward: null, repeat: true, nextRepeatDropAt: 145_000 });
    expect(completeTowerStage(drop.progress, boss, "qi", 145_000).reward).toEqual(drop.reward);
    // A clock set back does not lock farming out.
    expect(completeTowerStage(drop.progress, boss, "qi", 50_000).reward).toEqual(drop.reward);
    // No drop for other cleared stages, without the realm, or once the realm opens the next stage.
    expect(completeTowerStage(gated, getTowerStage(99), "qi", 100_000).reward).toBeNull();
    expect(completeTowerStage(gated, boss).reward).toBeNull();
    expect(completeTowerStage(gated, boss, "foundation", 100_000)).toMatchObject({ reward: null, repeat: false });
  });
});
