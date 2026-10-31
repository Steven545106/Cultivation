export type AdventureSkillId = "leiyu" | "xinyue" | "yuehua" | "zhoutian" | "xingluo" | "qinghui" | "taxue" | "qianfeng" | "chunhua" | "luoying";

export interface AdventureSkill {
  readonly id: AdventureSkillId;
  readonly nameZh: string;
  /** The sword that teaches the skill: it is unlocked with the sword, and deals more while that sword is equipped. */
  readonly weaponId: string;
  /** One word for what the skill is for, shown on its button. */
  readonly roleZh: string;
  readonly description: string;
  /** Spirit power (靈力) spent when the skill is cast. */
  readonly qiCost: number;
  /** One entry per hit, in order: the share of the hero's attack it deals. Every hit rolls its own critical. */
  readonly hitMultipliers: readonly number[];
  /** Chance (0–1) that the enemy is paralysed and does not strike back this turn. */
  readonly paralyzeChance?: number;
  /** Added to the critical chance of the first hit. */
  readonly firstHitCritBonus?: number;
  /** Critical hits of this skill deal this many times the damage, instead of the usual multiplier. */
  readonly criticalMultiplier?: number;
  /** Extra share of damage the last hit deals to a boss. */
  readonly lastHitBossBonus?: number;
  /** Heals this share of the damage the skill dealt. */
  readonly lifesteal?: number;
  /** The enemy's next attacks (this turn's reply and the next one) deal this share less. */
  readonly weaken?: number;
  /** The hero dodges the enemy's reply this turn. */
  readonly evade?: boolean;
  /** The next blow the hero takes is reduced by this share. */
  readonly shield?: number;
  /** Poison: at the end of each of the next `turns` turns the enemy takes `share` of the hero's attack. */
  readonly poison?: { readonly turns: number; readonly share: number };
  /** Each critical hit of the skill gives back this much spirit power. */
  readonly qiPerCritical?: number;
}

/** Damage bonus of a skill cast with its own sword equipped. */
export const OWN_SWORD_BONUS = 0.2;
/** How many skills the hero takes into a fight. */
export const ADVENTURE_SKILL_SLOTS = 3;

/**
 * The hero's skills, in the order their swords unlock. Each one does a
 * different job, so the three taken into a fight are a real choice; the
 * damage of a skill with a strong extra is a little lower.
 */
export const adventureSkills: readonly AdventureSkill[] = [
  {
    id: "leiyu",
    nameZh: "雷獄崩天",
    weaponId: "weapon_01",
    roleZh: "控制",
    description: "引九霄雷霆困住敵人：四道雷柱各 40%，最後一記巨雷 120% 攻擊；30% 機率麻痺敵人，這回合無法反擊（也能打斷首領蓄力）。",
    qiCost: 40,
    hitMultipliers: [0.4, 0.4, 0.4, 0.4, 1.2],
    paralyzeChance: 0.3,
  },
  {
    id: "xinyue",
    nameZh: "新月破空",
    weaponId: "weapon_02",
    roleZh: "爆發",
    description: "旋身一斬，新月光刃 140% 攻擊且暴擊率 +30%；星空裂縫再迸出兩顆星光，各 60% 攻擊。",
    qiCost: 40,
    hitMultipliers: [1.4, 0.6, 0.6],
    firstHitCritBonus: 0.3,
  },
  {
    id: "yuehua",
    nameZh: "月華流照",
    weaponId: "weapon_03",
    roleZh: "續戰",
    description: "揮出五波月華：四波各 40%、第五波 80% 攻擊；回復造成傷害 20% 的氣血。",
    qiCost: 40,
    hitMultipliers: [0.4, 0.4, 0.4, 0.4, 0.8],
    lifesteal: 0.2,
  },
  {
    id: "zhoutian",
    nameZh: "周天星轉",
    weaponId: "weapon_04",
    roleZh: "多段",
    description: "七顆星辰隨劍飛出：前六顆各 30%～40%，第七劍突刺 80% 攻擊；這招的暴擊造成 2 倍傷害，暴擊率越高越強。",
    qiCost: 45,
    hitMultipliers: [0.3, 0.3, 0.3, 0.35, 0.35, 0.4, 0.8],
    criticalMultiplier: 2,
  },
  {
    id: "xingluo",
    nameZh: "星落九天",
    weaponId: "weapon_05",
    roleZh: "破首領",
    description: "四顆流星各 30%、巨星墜落 50%，最後爆開 100% 攻擊；最後一擊對首領多造成 50% 傷害。",
    qiCost: 50,
    hitMultipliers: [0.3, 0.3, 0.3, 0.3, 0.5, 1.0],
    lastHitBossBonus: 0.5,
  },
  {
    id: "qinghui",
    nameZh: "清輝點雪",
    weaponId: "weapon_06",
    roleZh: "削弱",
    description: "月下連刺八次各 20%，月影一擊 80% 攻擊；敵人這回合和下回合的攻擊 −30%。",
    qiCost: 45,
    hitMultipliers: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.8],
    weaken: 0.3,
  },
  {
    id: "taxue",
    nameZh: "踏雪無痕",
    weaponId: "weapon_07",
    roleZh: "迴避",
    description: "化作冰風衝過敵人再一閃而回，兩道風線各 40%，冰羽炸開 140% 攻擊；這回合迴避敵人的反擊。",
    qiCost: 50,
    hitMultipliers: [0.4, 0.4, 1.4],
    evade: true,
  },
  {
    id: "qianfeng",
    nameZh: "千峰凝雪",
    weaponId: "weapon_08",
    roleZh: "護盾",
    description: "三座冰峰破土而出各 35%，一起碎裂 120% 攻擊；冰霜護體，下一次受到的傷害減半。",
    qiCost: 50,
    hitMultipliers: [0.35, 0.35, 0.35, 1.2],
    shield: 0.5,
  },
  {
    id: "chunhua",
    nameZh: "春華滿城",
    weaponId: "weapon_09",
    roleZh: "持續",
    description: "三朵花綻放各 30%，花浪撲向敵人 110% 攻擊；花毒纏身，之後 3 回合每回合再受 25% 攻擊。",
    qiCost: 50,
    hitMultipliers: [0.3, 0.3, 0.3, 1.1],
    poison: { turns: 3, share: 0.25 },
  },
  {
    id: "luoying",
    nameZh: "落英繽紛",
    weaponId: "weapon_10",
    roleZh: "絕技",
    description: "寒櫻霜華劍化作漫天落花，花瓣連斬五次各 60% 攻擊；每次暴擊回復 5 點靈力。",
    qiCost: 45,
    hitMultipliers: [0.6, 0.6, 0.6, 0.6, 0.6],
    qiPerCritical: 5,
  },
];

export function getAdventureSkill(id: AdventureSkillId): AdventureSkill {
  const skill = adventureSkills.find(entry => entry.id === id);
  if (!skill) throw new Error(`Unknown adventure skill: ${id}`);
  return skill;
}

export function isAdventureSkillId(value: unknown): value is AdventureSkillId {
  return adventureSkills.some(skill => skill.id === value);
}

/** The skills whose swords are unlocked, in unlock order. */
export function getUnlockedAdventureSkills(unlockedWeaponIds: readonly string[]): readonly AdventureSkill[] {
  return adventureSkills.filter(skill => unlockedWeaponIds.includes(skill.weaponId));
}

/**
 * The skills taken into a fight: the saved choice, keeping only unlocked
 * skills, filled up with the earliest unlocked ones, at most three.
 */
export function resolveEquippedSkills(saved: readonly string[], unlockedWeaponIds: readonly string[]): readonly AdventureSkillId[] {
  const unlocked = getUnlockedAdventureSkills(unlockedWeaponIds).map(skill => skill.id);
  const kept = [...new Set(saved)].filter((id): id is AdventureSkillId => unlocked.includes(id as AdventureSkillId));
  for (const id of unlocked) {
    if (kept.length >= ADVENTURE_SKILL_SLOTS) break;
    if (!kept.includes(id)) kept.push(id);
  }
  return kept.slice(0, ADVENTURE_SKILL_SLOTS);
}
