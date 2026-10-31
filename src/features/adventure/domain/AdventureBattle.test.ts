import { describe, expect, it } from "vitest";
import { ADVENTURE_BALANCE, canUseSkill, performPlayerAction, startAdventureBattle, type AdventureBattle, type AdventureEnemySpec, type Roll } from "./AdventureBattle";
import { ADVENTURE_SKILL_SLOTS, OWN_SWORD_BONUS, adventureSkills, getAdventureSkill, resolveEquippedSkills } from "./AdventureSkills";

const enemy: AdventureEnemySpec = { id: "mist-1", nameZh: "雲霧靈鶴", themeId: "mist", maxHp: 1_000_000, attack: 100, isBoss: false };
const boss: AdventureEnemySpec = { ...enemy, id: "mist-6", nameZh: "雲霧靈鶴王", isBoss: true };
/** A roll that always returns the same number; 0.5 means no damage spread and, with a low crit rate, no crit. */
const fixed = (value: number): Roll => () => value;
const start = (critRate = 0, spec = enemy, weaponId: string | null = null, qi = 100): AdventureBattle => {
  const battle = startAdventureBattle({ attack: 100, critRate, weaponId }, spec);
  return { ...battle, hero: { ...battle.hero, qi } };
};
const damageOf = (battle: AdventureBattle) => battle.events.flatMap(event => (event.kind === "hero-hit" ? [event.damage] : []));
const cast = (battle: AdventureBattle, skillId: Parameters<typeof getAdventureSkill>[0], roll: Roll = fixed(0.5)) => performPlayerAction(battle, { kind: "skill", skillId }, roll);

describe("adventure battle", () => {
  it("builds the hero's hit points from his attack and takes the enemy's strength from the stage", () => {
    const battle = startAdventureBattle({ attack: 100, critRate: 0 }, enemy);
    expect(battle.hero.maxHp).toBe(100 * ADVENTURE_BALANCE.heroHpPerAttack);
    expect(battle.enemy.maxHp).toBe(enemy.maxHp);
    expect(battle.enemy.attack).toBe(enemy.attack);
    expect(battle.hero.qi).toBe(ADVENTURE_BALANCE.startQi);
  });

  it("a basic attack deals the attack value, gathers spirit power, then the enemy strikes back", () => {
    const battle = start(0, enemy, null, 50);
    const next = performPlayerAction(battle, { kind: "attack" }, fixed(0.5));
    expect(damageOf(next)).toEqual([100]);
    expect(next.hero.qi).toBe(50 + ADVENTURE_BALANCE.basicAttackQiGain + ADVENTURE_BALANCE.turnQiRegen);
    expect(next.hero.hp).toBe(next.hero.maxHp - 100);
    expect(next.turn).toBe(2);
  });

  it("each skill lands its listed hits", () => {
    for (const skill of adventureSkills) {
      const next = cast(start(), skill.id);
      expect(damageOf(next), skill.nameZh).toEqual(skill.hitMultipliers.map(multiplier => Math.round(100 * multiplier)));
    }
  });

  it("a skill cast with its own sword deals more", () => {
    const skill = getAdventureSkill("xinyue");
    const own = cast(start(0, enemy, skill.weaponId), skill.id);
    expect(damageOf(own)).toEqual(skill.hitMultipliers.map(multiplier => Math.round(100 * multiplier * (1 + OWN_SWORD_BONUS))));
  });

  it("refuses a skill without enough spirit power and leaves the battle untouched", () => {
    const poor = start(0, enemy, null, 10);
    expect(canUseSkill(poor, "leiyu")).toBe(false);
    expect(cast(poor, "leiyu")).toBe(poor);
  });

  it("a timed-out turn deals no damage, the enemy still strikes and spirit power still returns", () => {
    const next = performPlayerAction(start(0, enemy, null, 50), { kind: "timeout" }, fixed(0.5));
    expect(damageOf(next)).toEqual([]);
    expect(next.hero.hp).toBe(next.hero.maxHp - 100);
    expect(next.hero.qi).toBe(50 + ADVENTURE_BALANCE.turnQiRegen);
  });

  it("ends in victory without a counter-attack when the enemy falls", () => {
    const next = performPlayerAction(start(0, { ...enemy, maxHp: 50 }), { kind: "attack" }, fixed(0.5));
    expect(next.status).toBe("victory");
    expect(next.events.some(event => event.kind === "enemy-hit")).toBe(false);
  });

  it("ends in defeat when the hero's hit points run out", () => {
    const next = performPlayerAction(start(0, { ...enemy, attack: 1_000_000 }), { kind: "attack" }, fixed(0.5));
    expect(next.status).toBe("defeat");
  });

  it("雷獄崩天 can paralyse the enemy so it does not strike back", () => {
    const rolls = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.1];
    const next = cast(start(), "leiyu", () => rolls.shift() ?? 0.5);
    expect(next.events.map(event => event.kind)).toContain("enemy-paralyzed");
    expect(next.hero.hp).toBe(next.hero.maxHp);
  });

  it("新月破空's first slash is more likely to be critical", () => {
    // 0.2 is above the hero's 10% crit rate but within it plus the 30% bonus.
    const next = cast(start(0.1), "xinyue", fixed(0.2));
    const hits = next.events.filter(event => event.kind === "hero-hit");
    expect(hits.map(hit => hit.kind === "hero-hit" && hit.critical)).toEqual([true, false, false]);
  });

  it("月華流照 heals a share of the damage it deals", () => {
    const hurt = start();
    const wounded = { ...hurt, hero: { ...hurt.hero, hp: 500 } };
    const next = cast(wounded, "yuehua");
    const healed = next.events.find(event => event.kind === "hero-heal");
    expect(healed?.kind === "hero-heal" && healed.amount).toBe(Math.round(240 * 0.2));
  });

  it("周天星轉's criticals deal double", () => {
    const next = cast(start(1), "zhoutian");
    expect(damageOf(next)[0]).toBe(Math.round(100 * 0.3 * 2));
  });

  it("星落九天's last hit deals more to a boss", () => {
    const normal = damageOf(cast(start(), "xingluo")).at(-1)!;
    const onBoss = damageOf(cast(start(0, boss), "xingluo")).at(-1)!;
    expect(onBoss).toBe(Math.round(normal * 1.5));
  });

  it("清輝點雪 weakens the enemy's next two replies", () => {
    const after = cast(start(), "qinghui");
    expect(after.hero.maxHp - after.hero.hp).toBe(70);
    const second = performPlayerAction(after, { kind: "attack" }, fixed(0.5));
    expect(after.hero.hp - second.hero.hp).toBe(70);
    const third = performPlayerAction(second, { kind: "attack" }, fixed(0.5));
    expect(second.hero.hp - third.hero.hp).toBe(100);
  });

  it("踏雪無痕 dodges the reply", () => {
    const next = cast(start(), "taxue");
    expect(next.events.map(event => event.kind)).toContain("hero-evade");
    expect(next.hero.hp).toBe(next.hero.maxHp);
  });

  it("千峰凝雪's shield halves the next blow, then is spent", () => {
    const next = cast(start(), "qianfeng");
    expect(next.hero.maxHp - next.hero.hp).toBe(50);
    expect(next.hero.shield).toBe(0);
  });

  it("春華滿城 poisons the enemy for three turns", () => {
    let battle = cast(start(), "chunhua");
    const ticks: number[] = [];
    for (let turn = 0; turn < 4; turn += 1) {
      ticks.push(...battle.events.flatMap(event => (event.kind === "poison" ? [event.damage] : [])));
      battle = performPlayerAction(battle, { kind: "timeout" }, fixed(0.5));
    }
    expect(ticks).toEqual([25, 25, 25]);
  });

  it("落英繽紛 gives spirit power back for every critical", () => {
    const next = cast(start(1), "luoying");
    // 100 − 45 to cast, + 5 for each of the five criticals, + the turn's regeneration.
    expect(next.hero.qi).toBe(100 - 45 + 25 + ADVENTURE_BALANCE.turnQiRegen);
  });

  it("a boss gathers its strength every third turn and then strikes hard", () => {
    let battle = start(0, boss);
    battle = performPlayerAction(battle, { kind: "timeout" }, fixed(0.5));
    battle = performPlayerAction(battle, { kind: "timeout" }, fixed(0.5));
    const charging = performPlayerAction(battle, { kind: "timeout" }, fixed(0.5));
    expect(charging.events.map(event => event.kind)).toContain("enemy-charge");
    expect(charging.hero.hp).toBe(battle.hero.hp);
    const struck = performPlayerAction(charging, { kind: "timeout" }, fixed(0.5));
    expect(charging.hero.hp - struck.hero.hp).toBe(100 * ADVENTURE_BALANCE.bossChargedMultiplier);
  });

  it("paralysing a charged boss makes it lose the heavy blow", () => {
    let battle = start(0, boss);
    for (let turn = 0; turn < 3; turn += 1) battle = performPlayerAction(battle, { kind: "timeout" }, fixed(0.5));
    expect(battle.enemy.charged).toBe(true);
    battle = { ...battle, hero: { ...battle.hero, qi: 100 } };
    const rolls = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.1];
    const next = cast(battle, "leiyu", () => rolls.shift() ?? 0.5);
    expect(next.enemy.charged).toBe(false);
    expect(next.hero.hp).toBe(battle.hero.hp);
  });
});

describe("adventure skills", () => {
  it("there is one skill per sword, in sword order", () => {
    expect(adventureSkills.map(skill => skill.weaponId)).toEqual(Array.from({ length: 10 }, (_, index) => `weapon_${String(index + 1).padStart(2, "0")}`));
  });

  it("takes three skills into a fight, only unlocked ones, filling up from the earliest", () => {
    expect(resolveEquippedSkills([], ["weapon_01"])).toEqual(["leiyu"]);
    expect(resolveEquippedSkills(["luoying", "xinyue"], ["weapon_01", "weapon_02", "weapon_03"])).toEqual(["xinyue", "leiyu", "yuehua"]);
    expect(resolveEquippedSkills(["yuehua", "xinyue", "leiyu", "zhoutian"], ["weapon_01", "weapon_02", "weapon_03", "weapon_04"])).toHaveLength(ADVENTURE_SKILL_SLOTS);
  });
});
