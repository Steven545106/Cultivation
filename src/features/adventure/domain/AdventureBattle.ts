import { getAdventureSkill, OWN_SWORD_BONUS, type AdventureSkillId } from "./AdventureSkills";

/** The hero's hit points grow with his attack; the enemy's strength is set by the stage (see AdventureStages). */
export const ADVENTURE_BALANCE = {
  heroHpPerAttack: 15,
  /** Damage varies by this much either way. */
  damageSpread: 0.15,
  maxQi: 100,
  startQi: 50,
  /** Spirit power the basic attack gathers, and what every turn restores on top. */
  basicAttackQiGain: 20,
  turnQiRegen: 10,
  criticalMultiplier: 1.5,
  /** Seconds the hero has to choose each turn before the chance passes. */
  turnSeconds: 30,
  /** A boss gathers its strength every this many turns, then strikes this many times harder on the next. */
  bossChargeEvery: 3,
  bossChargedMultiplier: 2.5,
  /** Turns a weakening skill lasts: this turn's reply and the next. */
  weakenTurns: 2,
} as const;

export interface AdventureHeroStats {
  readonly attack: number;
  /** Critical chance, 0–1. */
  readonly critRate: number;
  /** The equipped sword: its own skill deals more. */
  readonly weaponId?: string | null;
}

export interface AdventureEnemySpec {
  readonly id: string;
  readonly nameZh: string;
  /** Tower theme the creature is drawn from (picks its picture). */
  readonly themeId: string;
  readonly maxHp: number;
  readonly attack: number;
  readonly isBoss: boolean;
}

export interface AdventureCombatant {
  readonly hp: number;
  readonly maxHp: number;
}

export interface AdventureHero extends AdventureCombatant {
  readonly qi: number;
  readonly maxQi: number;
  readonly attack: number;
  readonly critRate: number;
  readonly weaponId: string | null;
  /** Share of the next blow a shield takes off; 0 when there is none. */
  readonly shield: number;
}

export interface AdventureEnemy extends AdventureCombatant, AdventureEnemySpec {
  /** Replies still weakened, and by how much. */
  readonly weakenTurns: number;
  readonly weakenShare: number;
  /** Turns of poison left and the damage each deals. */
  readonly poisonTurns: number;
  readonly poisonDamage: number;
  /** A boss that has gathered its strength strikes hard on its next reply. */
  readonly charged: boolean;
}

export type AdventureStatus = "playerTurn" | "victory" | "defeat";

export type AdventureAction =
  | { readonly kind: "attack" }
  | { readonly kind: "skill"; readonly skillId: AdventureSkillId }
  /** The turn's time ran out before the hero chose: he does not strike, the enemy still does. */
  | { readonly kind: "timeout" };

/** What happened during the last action, in order, so the screen can play it back. */
export type AdventureEvent =
  | { readonly kind: "hero-hit"; readonly damage: number; readonly critical: boolean; readonly skillId: AdventureSkillId | null; readonly hitIndex: number }
  | { readonly kind: "hero-heal"; readonly amount: number }
  /** `heavy`: the blow of a charged boss. `blocked`: what a shield took off. */
  | { readonly kind: "enemy-hit"; readonly damage: number; readonly heavy: boolean; readonly blocked: number }
  /** A skill paralysed the enemy: it does not strike back this turn (a charged blow is lost). */
  | { readonly kind: "enemy-paralyzed" }
  /** The hero dodged the enemy's reply. */
  | { readonly kind: "hero-evade" }
  /** A boss gathers its strength instead of striking; its next blow is heavy. */
  | { readonly kind: "enemy-charge" }
  | { readonly kind: "poison"; readonly damage: number };

export interface AdventureBattle {
  readonly hero: AdventureHero;
  readonly enemy: AdventureEnemy;
  readonly turn: number;
  readonly status: AdventureStatus;
  readonly events: readonly AdventureEvent[];
  readonly log: readonly string[];
}

/** Uniform random number in [0, 1). */
export type Roll = () => number;

const zh = (value: number) => value.toLocaleString("zh-TW");

export function startAdventureBattle(stats: AdventureHeroStats, spec: AdventureEnemySpec): AdventureBattle {
  const attack = Math.max(1, stats.attack);
  const heroMaxHp = Math.round(attack * ADVENTURE_BALANCE.heroHpPerAttack);
  return {
    hero: { hp: heroMaxHp, maxHp: heroMaxHp, qi: ADVENTURE_BALANCE.startQi, maxQi: ADVENTURE_BALANCE.maxQi, attack, critRate: Math.min(1, Math.max(0, stats.critRate)), weaponId: stats.weaponId ?? null, shield: 0 },
    enemy: { ...spec, maxHp: Math.max(1, Math.round(spec.maxHp)), hp: Math.max(1, Math.round(spec.maxHp)), attack: Math.max(1, Math.round(spec.attack)), weakenTurns: 0, weakenShare: 0, poisonTurns: 0, poisonDamage: 0, charged: false },
    turn: 1,
    status: "playerTurn",
    events: [],
    log: [`${spec.nameZh}${spec.isBoss ? "（首領）" : ""}擋住了去路！`],
  };
}

export function canUseSkill(battle: AdventureBattle, skillId: AdventureSkillId): boolean {
  return battle.status === "playerTurn" && battle.hero.qi >= getAdventureSkill(skillId).qiCost;
}

const spread = (roll: Roll): number => 1 + (roll() * 2 - 1) * ADVENTURE_BALANCE.damageSpread;

/**
 * The hero acts, then, if the enemy still stands, it answers (strikes, gathers
 * its strength or is held off), poison bites, and the turn ends. Returns the
 * battle unchanged when the action is not allowed.
 */
export function performPlayerAction(battle: AdventureBattle, action: AdventureAction, roll: Roll): AdventureBattle {
  if (battle.status !== "playerTurn") return battle;
  const events: AdventureEvent[] = [];
  const log: string[] = [];
  let hero = battle.hero;
  let enemy = battle.enemy;
  let enemyHp = enemy.hp;
  let paralyzed = false;
  let evading = false;

  const strike = (multiplier: number, skillId: AdventureSkillId | null, hitIndex: number, critBonus = 0, critMultiplier: number = ADVENTURE_BALANCE.criticalMultiplier): number => {
    const critical = roll() < hero.critRate + critBonus;
    const damage = Math.max(1, Math.round(hero.attack * multiplier * spread(roll) * (critical ? critMultiplier : 1)));
    enemyHp = Math.max(0, enemyHp - damage);
    events.push({ kind: "hero-hit", damage, critical, skillId, hitIndex });
    return damage;
  };

  if (action.kind === "skill") {
    const skill = getAdventureSkill(action.skillId);
    if (hero.qi < skill.qiCost) return battle;
    hero = { ...hero, qi: hero.qi - skill.qiCost };
    const own = skill.weaponId === hero.weaponId ? 1 + OWN_SWORD_BONUS : 1;
    let dealt = 0;
    skill.hitMultipliers.forEach((multiplier, hit) => {
      const last = hit === skill.hitMultipliers.length - 1;
      const boss = last && enemy.isBoss ? 1 + (skill.lastHitBossBonus ?? 0) : 1;
      dealt += strike(multiplier * own * boss, skill.id, hit, hit === 0 ? skill.firstHitCritBonus ?? 0 : 0, skill.criticalMultiplier);
    });
    log.push(`你施展「${skill.nameZh}」，連擊 ${skill.hitMultipliers.length} 次，共造成 ${zh(dealt)} 點傷害。`);
    const criticals = events.filter(event => event.kind === "hero-hit" && event.critical).length;
    if (skill.qiPerCritical && criticals > 0) {
      hero = { ...hero, qi: Math.min(hero.maxQi, hero.qi + skill.qiPerCritical * criticals) };
      log.push(`暴擊 ${criticals} 次，回復 ${skill.qiPerCritical * criticals} 點靈力。`);
    }
    if (skill.lifesteal) {
      const amount = Math.min(hero.maxHp - hero.hp, Math.round(dealt * skill.lifesteal));
      if (amount > 0) {
        hero = { ...hero, hp: hero.hp + amount };
        events.push({ kind: "hero-heal", amount });
        log.push(`月華入體，回復 ${zh(amount)} 點氣血。`);
      }
    }
    if (skill.shield) hero = { ...hero, shield: Math.max(hero.shield, skill.shield) };
    if (skill.weaken) enemy = { ...enemy, weakenTurns: ADVENTURE_BALANCE.weakenTurns, weakenShare: skill.weaken };
    if (skill.poison) enemy = { ...enemy, poisonTurns: skill.poison.turns, poisonDamage: Math.max(1, Math.round(hero.attack * skill.poison.share)) };
    evading = skill.evade === true;
    paralyzed = enemyHp > 0 && skill.paralyzeChance !== undefined && roll() < skill.paralyzeChance;
  } else if (action.kind === "timeout") {
    log.push("你遲疑片刻，錯失了出手的時機。");
  } else {
    hero = { ...hero, qi: Math.min(hero.maxQi, hero.qi + ADVENTURE_BALANCE.basicAttackQiGain) };
    strike(1, null, 0);
    const hit = events[0];
    if (hit?.kind === "hero-hit") log.push(`你揮劍${hit.critical ? "暴擊" : "斬擊"}，造成 ${zh(hit.damage)} 點傷害。`);
  }

  const won = (): AdventureBattle => {
    log.push(`${enemy.nameZh}倒下了，你贏了！`);
    return { ...battle, hero, enemy: { ...enemy, hp: 0 }, status: "victory", events, log: [...battle.log, ...log] };
  };
  if (enemyHp <= 0) return won();

  // The enemy answers.
  if (paralyzed) {
    events.push({ kind: "enemy-paralyzed" });
    log.push(enemy.charged ? `${enemy.nameZh}被雷電麻痺，蓄好的力量散去了。` : `${enemy.nameZh}被雷電麻痺，無法反擊。`);
    enemy = { ...enemy, charged: false };
  } else if (enemy.isBoss && !enemy.charged && battle.turn % ADVENTURE_BALANCE.bossChargeEvery === 0) {
    events.push({ kind: "enemy-charge" });
    log.push(`${enemy.nameZh}正在蓄力，下一擊會很重！`);
    enemy = { ...enemy, charged: true };
  } else {
    const heavy = enemy.charged;
    const weakened = enemy.weakenTurns > 0 ? 1 - enemy.weakenShare : 1;
    const raw = Math.max(1, Math.round(enemy.attack * spread(roll) * (heavy ? ADVENTURE_BALANCE.bossChargedMultiplier : 1) * weakened));
    enemy = { ...enemy, charged: false };
    if (evading) {
      events.push({ kind: "hero-evade" });
      log.push(`你身化冰風，閃過了${enemy.nameZh}的${heavy ? "重擊" : "攻擊"}。`);
    } else {
      const blocked = Math.round(raw * hero.shield);
      const damage = raw - blocked;
      hero = { ...hero, hp: Math.max(0, hero.hp - damage), shield: 0 };
      events.push({ kind: "enemy-hit", damage, heavy, blocked });
      log.push(`${enemy.nameZh}${heavy ? "釋放重擊" : "反撲"}，造成 ${zh(damage)} 點傷害${blocked > 0 ? `（冰霜護體擋下 ${zh(blocked)}）` : ""}。`);
    }
  }
  enemy = { ...enemy, weakenTurns: Math.max(0, enemy.weakenTurns - 1) };

  if (hero.hp <= 0) {
    log.push("你力竭倒地，這次遊歷到此為止。");
    return { ...battle, hero, enemy: { ...enemy, hp: enemyHp }, turn: battle.turn + 1, status: "defeat", events, log: [...battle.log, ...log] };
  }

  if (enemy.poisonTurns > 0) {
    enemyHp = Math.max(0, enemyHp - enemy.poisonDamage);
    events.push({ kind: "poison", damage: enemy.poisonDamage });
    log.push(`花毒發作，${enemy.nameZh}受到 ${zh(enemy.poisonDamage)} 點傷害。`);
    enemy = { ...enemy, poisonTurns: enemy.poisonTurns - 1 };
    if (enemyHp <= 0) return won();
  }

  hero = { ...hero, qi: Math.min(hero.maxQi, hero.qi + ADVENTURE_BALANCE.turnQiRegen) };
  return {
    ...battle,
    hero,
    enemy: { ...enemy, hp: enemyHp },
    turn: battle.turn + 1,
    status: "playerTurn",
    events,
    log: [...battle.log, ...log],
  };
}
