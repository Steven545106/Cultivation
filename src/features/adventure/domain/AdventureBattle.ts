import { getAdventureSkill, type AdventureSkillId } from "./AdventureSkills";

/** Hit points are built from the hero's attack, so the fights stay even as the sword and realm grow. */
export const ADVENTURE_BALANCE = {
  heroHpPerAttack: 15,
  enemyHpPerAttack: 14,
  /** An enemy blow takes this share of the hero's maximum HP, before the roll below. */
  enemyDamageShare: 0.07,
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
} as const;

export interface AdventureHeroStats {
  readonly attack: number;
  /** Critical chance, 0–1. */
  readonly critRate: number;
}

export interface AdventureEnemySpec {
  readonly id: string;
  readonly nameZh: string;
  /** Tower theme the creature is drawn from (picks its picture). */
  readonly themeId: string;
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
}

export interface AdventureEnemy extends AdventureCombatant, AdventureEnemySpec {
  readonly attack: number;
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
  | { readonly kind: "enemy-hit"; readonly damage: number }
  /** A skill paralysed the enemy: it does not strike back this turn. */
  | { readonly kind: "enemy-paralyzed" };

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

export function startAdventureBattle(stats: AdventureHeroStats, spec: AdventureEnemySpec): AdventureBattle {
  const attack = Math.max(1, stats.attack);
  const heroMaxHp = Math.round(attack * ADVENTURE_BALANCE.heroHpPerAttack);
  const enemyMaxHp = Math.round(attack * ADVENTURE_BALANCE.enemyHpPerAttack);
  return {
    hero: { hp: heroMaxHp, maxHp: heroMaxHp, qi: ADVENTURE_BALANCE.startQi, maxQi: ADVENTURE_BALANCE.maxQi, attack, critRate: Math.min(1, Math.max(0, stats.critRate)) },
    enemy: { ...spec, hp: enemyMaxHp, maxHp: enemyMaxHp, attack: Math.max(1, Math.round(heroMaxHp * ADVENTURE_BALANCE.enemyDamageShare)) },
    turn: 1,
    status: "playerTurn",
    events: [],
    log: [`${spec.nameZh}擋住了去路！`],
  };
}

export function canUseSkill(battle: AdventureBattle, skillId: AdventureSkillId): boolean {
  return battle.status === "playerTurn" && battle.hero.qi >= getAdventureSkill(skillId).qiCost;
}

const spread = (roll: Roll): number => 1 + (roll() * 2 - 1) * ADVENTURE_BALANCE.damageSpread;

/**
 * The hero acts, then, if the enemy still stands, it strikes back and the turn
 * ends. Returns the battle unchanged when the action is not allowed.
 */
export function performPlayerAction(battle: AdventureBattle, action: AdventureAction, roll: Roll): AdventureBattle {
  if (battle.status !== "playerTurn") return battle;
  const events: AdventureEvent[] = [];
  const log: string[] = [];
  let hero = battle.hero;
  let enemyHp = battle.enemy.hp;
  let paralyzed = false;

  const strike = (multiplier: number, skillId: AdventureSkillId | null, hitIndex: number): void => {
    const critical = roll() < hero.critRate;
    const damage = Math.max(1, Math.round(hero.attack * multiplier * spread(roll) * (critical ? ADVENTURE_BALANCE.criticalMultiplier : 1)));
    enemyHp = Math.max(0, enemyHp - damage);
    events.push({ kind: "hero-hit", damage, critical, skillId, hitIndex });
  };

  if (action.kind === "skill") {
    const skill = getAdventureSkill(action.skillId);
    if (hero.qi < skill.qiCost) return battle;
    hero = { ...hero, qi: hero.qi - skill.qiCost };
    skill.hitMultipliers.forEach((multiplier, hit) => strike(multiplier, skill.id, hit));
    const dealt = events.reduce((sum, event) => (event.kind === "hero-hit" ? sum + event.damage : sum), 0);
    log.push(`你施展「${skill.nameZh}」，連擊 ${skill.hitMultipliers.length} 次，共造成 ${dealt.toLocaleString("zh-TW")} 點傷害。`);
    paralyzed = enemyHp > 0 && skill.paralyzeChance !== undefined && roll() < skill.paralyzeChance;
  } else if (action.kind === "timeout") {
    log.push("你遲疑片刻，錯失了出手的時機。");
  } else {
    hero = { ...hero, qi: Math.min(hero.maxQi, hero.qi + ADVENTURE_BALANCE.basicAttackQiGain) };
    strike(1, null, 0);
    const hit = events[0];
    if (hit?.kind === "hero-hit") log.push(`你揮劍${hit.critical ? "暴擊" : "斬擊"}，造成 ${hit.damage.toLocaleString("zh-TW")} 點傷害。`);
  }

  if (enemyHp <= 0) {
    log.push(`${battle.enemy.nameZh}倒下了，你贏了！`);
    return { ...battle, hero, enemy: { ...battle.enemy, hp: 0 }, status: "victory", events, log: [...battle.log, ...log] };
  }

  let heroHp = hero.hp;
  if (paralyzed) {
    events.push({ kind: "enemy-paralyzed" });
    log.push(`${battle.enemy.nameZh}被雷電麻痺，無法反擊。`);
  } else {
    const enemyDamage = Math.max(1, Math.round(battle.enemy.attack * spread(roll)));
    heroHp = Math.max(0, hero.hp - enemyDamage);
    events.push({ kind: "enemy-hit", damage: enemyDamage });
    log.push(`${battle.enemy.nameZh}反撲，造成 ${enemyDamage.toLocaleString("zh-TW")} 點傷害。`);
  }
  hero = { ...hero, hp: heroHp, qi: Math.min(hero.maxQi, hero.qi + ADVENTURE_BALANCE.turnQiRegen) };
  if (heroHp <= 0) log.push("你力竭倒地，這次遊歷到此為止。");

  return {
    ...battle,
    hero,
    enemy: { ...battle.enemy, hp: enemyHp },
    turn: battle.turn + 1,
    status: heroHp <= 0 ? "defeat" : "playerTurn",
    events,
    log: [...battle.log, ...log],
  };
}
