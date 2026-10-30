import { describe, expect, it } from "vitest";
import { ADVENTURE_BALANCE, canUseSkill, performPlayerAction, startAdventureBattle, type AdventureBattle, type Roll } from "./AdventureBattle";
import { getUnlockedThemeCount, pickAdventureEnemy } from "./AdventureEnemies";
import { adventureSkills, getAdventureSkill } from "./AdventureSkills";

const enemy = { id: "mist", nameZh: "雲霧靈鶴", themeId: "mist" };
/** A roll that always returns the same number; 0.5 means no damage spread and, with a low crit rate, no crit. */
const fixed = (value: number): Roll => () => value;
const start = (critRate = 0): AdventureBattle => startAdventureBattle({ attack: 100, critRate }, enemy);

describe("adventure battle", () => {
  it("builds both sides' hit points from the hero's attack", () => {
    const battle = start();
    expect(battle.hero.maxHp).toBe(100 * ADVENTURE_BALANCE.heroHpPerAttack);
    expect(battle.enemy.maxHp).toBe(100 * ADVENTURE_BALANCE.enemyHpPerAttack);
    expect(battle.hero.qi).toBe(ADVENTURE_BALANCE.startQi);
    expect(battle.status).toBe("playerTurn");
  });

  it("a basic attack deals the attack value, gathers spirit power, then the enemy strikes back", () => {
    const next = performPlayerAction(start(), { kind: "attack" }, fixed(0.5));
    expect(next.enemy.hp).toBe(next.enemy.maxHp - 100);
    expect(next.hero.qi).toBe(ADVENTURE_BALANCE.startQi + ADVENTURE_BALANCE.basicAttackQiGain + ADVENTURE_BALANCE.turnQiRegen);
    expect(next.hero.hp).toBe(next.hero.maxHp - next.enemy.attack);
    expect(next.turn).toBe(2);
    expect(next.events.map(event => event.kind)).toEqual(["hero-hit", "enemy-hit"]);
  });

  it("落英繽紛 lands five hits of half the attack and costs spirit power", () => {
    const skill = getAdventureSkill("luoying");
    const next = performPlayerAction(start(), { kind: "skill", skillId: "luoying" }, fixed(0.5));
    const hits = next.events.filter(event => event.kind === "hero-hit");
    expect(hits).toHaveLength(skill.hitMultipliers.length);
    expect(hits.every(event => event.kind === "hero-hit" && event.damage === 50 && event.skillId === "luoying")).toBe(true);
    expect(next.enemy.hp).toBe(next.enemy.maxHp - 250);
    expect(next.hero.qi).toBe(ADVENTURE_BALANCE.startQi - skill.qiCost + ADVENTURE_BALANCE.turnQiRegen);
  });

  it("every petal rolls its own critical", () => {
    const next = performPlayerAction(start(1), { kind: "skill", skillId: "luoying" }, fixed(0.5));
    const hits = next.events.filter(event => event.kind === "hero-hit");
    expect(hits.every(event => event.kind === "hero-hit" && event.critical && event.damage === Math.round(50 * ADVENTURE_BALANCE.criticalMultiplier))).toBe(true);
  });

  it("a timed-out turn deals no damage, the enemy still strikes and spirit power still returns", () => {
    const next = performPlayerAction(start(), { kind: "timeout" }, fixed(0.5));
    expect(next.enemy.hp).toBe(next.enemy.maxHp);
    expect(next.events.map(event => event.kind)).toEqual(["enemy-hit"]);
    expect(next.hero.hp).toBe(next.hero.maxHp - next.enemy.attack);
    expect(next.hero.qi).toBe(ADVENTURE_BALANCE.startQi + ADVENTURE_BALANCE.turnQiRegen);
    expect(next.turn).toBe(2);
  });

  it("refuses a skill without enough spirit power and leaves the battle untouched", () => {
    const poor = { ...start(), hero: { ...start().hero, qi: 10 } };
    expect(canUseSkill(poor, "luoying")).toBe(false);
    expect(performPlayerAction(poor, { kind: "skill", skillId: "luoying" }, fixed(0.5))).toBe(poor);
  });

  it("ends in victory without a counter-attack when the enemy falls", () => {
    const nearlyDead = { ...start(), enemy: { ...start().enemy, hp: 30 } };
    const next = performPlayerAction(nearlyDead, { kind: "attack" }, fixed(0.5));
    expect(next.status).toBe("victory");
    expect(next.enemy.hp).toBe(0);
    expect(next.hero.hp).toBe(next.hero.maxHp);
    expect(next.events.map(event => event.kind)).toEqual(["hero-hit"]);
    expect(performPlayerAction(next, { kind: "attack" }, fixed(0.5))).toBe(next);
  });

  it("ends in defeat when the hero's hit points run out", () => {
    const dying = { ...start(), hero: { ...start().hero, hp: 1 } };
    const next = performPlayerAction(dying, { kind: "attack" }, fixed(0.5));
    expect(next.status).toBe("defeat");
    expect(next.hero.hp).toBe(0);
  });

  it("is winnable by mixing the skill and the basic attack", () => {
    let battle = start(0.1);
    let guard = 0;
    while (battle.status === "playerTurn" && guard++ < 100) {
      battle = performPlayerAction(battle, canUseSkill(battle, "luoying") ? { kind: "skill", skillId: "luoying" } : { kind: "attack" }, fixed(0.5));
    }
    expect(battle.status).toBe("victory");
    expect(battle.hero.hp).toBeGreaterThan(0);
  });

  it("the skill list holds all eight skills in order", () => {
    expect(adventureSkills.map(skill => skill.nameZh)).toEqual(["落英繽紛", "雷獄崩天", "新月破空", "月華流照", "周天星轉", "星落九天", "清輝點雪", "踏雪無痕"]);
  });

  it("踏雪無痕 cuts through twice, then the ice feathers burst", () => {
    const rich = { ...start(), hero: { ...start().hero, qi: 100 } };
    const next = performPlayerAction(rich, { kind: "skill", skillId: "taxue" }, fixed(0.5));
    const damage = next.events.flatMap(event => (event.kind === "hero-hit" ? [event.damage] : []));
    expect(damage).toEqual([40, 40, 180]);
    expect(next.hero.qi).toBe(100 - getAdventureSkill("taxue").qiCost + ADVENTURE_BALANCE.turnQiRegen);
  });

  it("清輝點雪 thrusts eight times, then the moon strikes", () => {
    const rich = { ...start(), hero: { ...start().hero, qi: 100 } };
    const next = performPlayerAction(rich, { kind: "skill", skillId: "qinghui" }, fixed(0.5));
    const damage = next.events.flatMap(event => (event.kind === "hero-hit" ? [event.damage] : []));
    expect(damage).toEqual([25, 25, 25, 25, 25, 25, 25, 25, 80]);
    expect(next.hero.qi).toBe(100 - getAdventureSkill("qinghui").qiCost + ADVENTURE_BALANCE.turnQiRegen);
  });

  it("星落九天 drops four meteors, then a great star that bursts", () => {
    const rich = { ...start(), hero: { ...start().hero, qi: 100 } };
    const next = performPlayerAction(rich, { kind: "skill", skillId: "xingluo" }, fixed(0.5));
    const damage = next.events.flatMap(event => (event.kind === "hero-hit" ? [event.damage] : []));
    expect(damage).toEqual([30, 30, 30, 30, 50, 100]);
    expect(next.hero.qi).toBe(100 - getAdventureSkill("xingluo").qiCost + ADVENTURE_BALANCE.turnQiRegen);
  });

  it("周天星轉 flies seven stars, the seventh thrust the strongest", () => {
    const rich = { ...start(), hero: { ...start().hero, qi: 100 } };
    const next = performPlayerAction(rich, { kind: "skill", skillId: "zhoutian" }, fixed(0.5));
    const damage = next.events.flatMap(event => (event.kind === "hero-hit" ? [event.damage] : []));
    expect(damage).toEqual([30, 30, 30, 35, 35, 40, 80]);
    expect(next.hero.qi).toBe(100 - getAdventureSkill("zhoutian").qiCost + ADVENTURE_BALANCE.turnQiRegen);
  });

  it("月華流照 rolls out five waves of moonlight, the last the strongest", () => {
    const rich = { ...start(), hero: { ...start().hero, qi: 100 } };
    const next = performPlayerAction(rich, { kind: "skill", skillId: "yuehua" }, fixed(0.5));
    const damage = next.events.flatMap(event => (event.kind === "hero-hit" ? [event.damage] : []));
    expect(damage).toEqual([40, 40, 50, 50, 80]);
    expect(next.hero.qi).toBe(100 - getAdventureSkill("yuehua").qiCost + ADVENTURE_BALANCE.turnQiRegen);
  });

  it("新月破空 lands one crescent slash and two star bursts", () => {
    const rich = { ...start(), hero: { ...start().hero, qi: 100 } };
    const next = performPlayerAction(rich, { kind: "skill", skillId: "xinyue" }, fixed(0.5));
    const damage = next.events.flatMap(event => (event.kind === "hero-hit" ? [event.damage] : []));
    expect(damage).toEqual([140, 60, 60]);
    expect(next.hero.qi).toBe(100 - getAdventureSkill("xinyue").qiCost + ADVENTURE_BALANCE.turnQiRegen);
  });

  it("雷獄崩天 lands four lightning pillars and one great bolt", () => {
    const rich = { ...start(), hero: { ...start().hero, qi: 100 } };
    // 0.5 keeps the spread at 1 and, at 0.3 paralysis chance, does not paralyse.
    const next = performPlayerAction(rich, { kind: "skill", skillId: "leiyu" }, fixed(0.5));
    const damage = next.events.flatMap(event => (event.kind === "hero-hit" ? [event.damage] : []));
    expect(damage).toEqual([40, 40, 40, 40, 120]);
    expect(next.hero.qi).toBe(100 - getAdventureSkill("leiyu").qiCost + ADVENTURE_BALANCE.turnQiRegen);
    expect(next.events.at(-1)?.kind).toBe("enemy-hit");
  });

  it("雷獄崩天 can paralyse the enemy so it does not strike back", () => {
    const rich = { ...start(), hero: { ...start().hero, qi: 100 } };
    const rolls = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.1];
    const next = performPlayerAction(rich, { kind: "skill", skillId: "leiyu" }, () => rolls.shift() ?? 0.5);
    expect(next.events.at(-1)?.kind).toBe("enemy-paralyzed");
    expect(next.hero.hp).toBe(next.hero.maxHp);
    expect(next.turn).toBe(2);
    expect(next.status).toBe("playerTurn");
  });
});

describe("adventure enemies", () => {
  it("opens one more theme every ten tower floors", () => {
    expect(getUnlockedThemeCount(0)).toBe(1);
    expect(getUnlockedThemeCount(99)).toBe(1);
    expect(getUnlockedThemeCount(100)).toBe(2);
    expect(getUnlockedThemeCount(10_000)).toBe(10);
  });

  it("picks only creatures from the themes already reached", () => {
    expect(pickAdventureEnemy(0, fixed(0.99)).themeId).toBe("mist");
    expect(pickAdventureEnemy(100, fixed(0.99)).themeId).toBe("forest");
    expect(pickAdventureEnemy(100, fixed(0)).themeId).toBe("mist");
  });
});
