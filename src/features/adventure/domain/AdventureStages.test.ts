import { describe, expect, it } from "vitest";
import { defaultLabProfile, evaluateLab, labUnlockedWeapons } from "../../balance/statLab";
import { realmConfigs } from "../../cultivation";
import { performPlayerAction, startAdventureBattle, type AdventureBattle } from "./AdventureBattle";
import { getAdventureSkill } from "./AdventureSkills";
import {
  ADVENTURE_DPS_PER_ATTACK,
  ADVENTURE_STAGE_BALANCE,
  adventureRegions,
  canChallengeStage,
  createAdventureProgress,
  getAdventureEnemy,
  getAdventureReward,
  getFrontierStage,
  getStageReferenceAttack,
  isRegionOpen,
  normalizeAdventureProgress,
  repeatsLeftToday,
  settleAdventureVictory,
} from "./AdventureStages";

const NOW = new Date(2026, 9, 31, 12).getTime();
const realms = [...new Set(realmConfigs.map(stage => stage.realmId))];

/**
 * The stat lab's hero who has just finished each realm: its last stage, the newest sword, refined
 * just far enough to clear the realm's last tower floor.
 */
const heroAfterRealm = (index: number) => {
  const stage = realmConfigs.filter(entry => entry.realmId === realms[index]).at(-1)!;
  let result = evaluateLab(defaultLabProfile);
  for (let refinementLevel = 0; refinementLevel <= 30; refinementLevel += 1) {
    let profile = { ...defaultLabProfile, stageId: stage.stageId, towerCleared: index * 100, refinementLevel };
    profile = { ...profile, weaponId: labUnlockedWeapons(profile).at(-1)!.weaponId };
    result = evaluateLab(profile);
    if (result.towerReach >= result.towerCap) break;
  }
  return result;
};

/** Fights with a simple plan: a skill whenever there is spirit power for it, else a basic strike. Returns the turns it took, or null on defeat. */
const fight = (attack: number, critRate: number, regionIndex: number, stage: number): number | null => {
  let battle: AdventureBattle = startAdventureBattle({ attack, critRate }, getAdventureEnemy(regionIndex, stage));
  const skill = getAdventureSkill("leiyu");
  let seed = 7;
  const roll = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (battle.status === "playerTurn" && battle.turn < 60) {
    battle = performPlayerAction(battle, battle.hero.qi >= skill.qiCost ? { kind: "skill", skillId: skill.id } : { kind: "attack" }, roll);
  }
  return battle.status === "victory" ? battle.turn : null;
};

describe("adventure stages", () => {
  it("the DPS-per-attack table matches the stat lab's hero, so stages stay sized on the tower", () => {
    ADVENTURE_DPS_PER_ATTACK.forEach((ratio, index) => {
      const hero = heroAfterRealm(index);
      expect(hero.teamDps / hero.combat.attack, realms[index]).toBeGreaterThan(ratio * 0.8);
      expect(hero.teamDps / hero.combat.attack, realms[index]).toBeLessThan(ratio * 1.25);
    });
  });

  it("the hero who has just cleared a region's tower floors beats its boss in a handful of turns", () => {
    ADVENTURE_DPS_PER_ATTACK.forEach((_, index) => {
      const hero = heroAfterRealm(index);
      const turns = fight(hero.combat.attack, hero.combat.critRate, index, 6);
      expect(turns, realms[index]).not.toBeNull();
      expect(turns!, realms[index]).toBeLessThanOrEqual(14);
    });
  });

  it("a hero a region behind loses to the next region's boss, or needs far longer", () => {
    for (let index = 1; index < ADVENTURE_DPS_PER_ATTACK.length; index += 1) {
      const behind = heroAfterRealm(index - 1);
      const onCurve = heroAfterRealm(index);
      const turns = fight(behind.combat.attack, behind.combat.critRate, index, 6);
      if (turns !== null) expect(turns, realms[index]).toBeGreaterThanOrEqual(1.3 * fight(onCurve.combat.attack, onCurve.combat.critRate, index, 6)!);
    }
  });

  it("enemies grow stage by stage, and each region's normal enemies outgrow the last region's", () => {
    for (const region of adventureRegions) {
      const normal = [1, 2, 3, 4, 5].map(stage => getStageReferenceAttack(region.index, stage));
      normal.slice(1).forEach((value, index) => expect(value).toBeGreaterThan(normal[index]));
      if (region.index > 0) expect(normal[0]).toBeGreaterThan(getStageReferenceAttack(region.index - 1, 5));
    }
    expect(getAdventureEnemy(0, 6).isBoss).toBe(true);
    expect(getAdventureEnemy(0, 5).isBoss).toBe(false);
  });

  it("opens a region once the boss of the one before falls, one stage at a time", () => {
    let progress = createAdventureProgress();
    expect(isRegionOpen(progress, 0)).toBe(true);
    expect(isRegionOpen(progress, 1)).toBe(false);
    expect(canChallengeStage(progress, 0, 2)).toBe(false);
    for (let stage = 1; stage <= 6; stage += 1) progress = settleAdventureVictory(progress, 0, stage, NOW).progress;
    expect(isRegionOpen(progress, 1)).toBe(true);
    expect(getFrontierStage(progress)).toEqual({ regionIndex: 1, stage: 1 });
  });

  it("pays the full reward on a first clear, a share on repeats, and nothing after the day's repeats", () => {
    let progress = settleAdventureVictory(createAdventureProgress(), 0, 1, NOW).progress;
    const first = getAdventureReward(0, 1, true);
    for (let repeat = 0; repeat < ADVENTURE_STAGE_BALANCE.dailyRepeats; repeat += 1) {
      const result = settleAdventureVictory(progress, 0, 1, NOW);
      expect(result.firstClear).toBe(false);
      expect(result.reward!.spiritStones).toBe(Math.round(first.spiritStones * ADVENTURE_STAGE_BALANCE.repeatShare));
      progress = result.progress;
    }
    expect(repeatsLeftToday(progress, NOW)).toBe(0);
    expect(settleAdventureVictory(progress, 0, 1, NOW).reward).toBeNull();
    expect(repeatsLeftToday(progress, NOW + 24 * 3600 * 1000)).toBe(ADVENTURE_STAGE_BALANCE.dailyRepeats);
  });

  it("a boss's first clear also gives a pill", () => {
    expect(getAdventureReward(3, 6, true, () => 0).pill).toEqual({ id: "attack", quality: 1 });
    expect(getAdventureReward(3, 6, false).pill).toBeNull();
    expect(getAdventureReward(3, 5, true).pill).toBeNull();
  });

  it("normalizes a broken save", () => {
    expect(normalizeAdventureProgress({ cleared: { mist: 9, forest: -2, nowhere: 3 }, skills: ["leiyu", "nope"], dailyRepeats: "x" })).toEqual({ cleared: { mist: 6, forest: 0 }, skills: ["leiyu"], dailyDate: "", dailyRepeats: 0 });
  });
});
