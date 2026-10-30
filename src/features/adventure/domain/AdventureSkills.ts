export type AdventureSkillId = "luoying" | "leiyu" | "xinyue" | "yuehua";

export interface AdventureSkill {
  readonly id: AdventureSkillId;
  readonly nameZh: string;
  readonly description: string;
  /** Spirit power (靈力) spent when the skill is cast. */
  readonly qiCost: number;
  /** One entry per hit, in order: the share of the hero's attack it deals. Every hit rolls its own critical. */
  readonly hitMultipliers: readonly number[];
  /** Chance (0–1) that the enemy is paralysed and does not strike back this turn. */
  readonly paralyzeChance?: number;
}

/** The hero's skills; every one can be cast whatever sword is equipped. */
export const adventureSkills: readonly AdventureSkill[] = [
  {
    id: "luoying",
    nameZh: "落英繽紛",
    description: "寒櫻霜華劍化作漫天落花，花瓣連斬五次，每次造成 50% 攻擊，各自判定暴擊。",
    qiCost: 30,
    hitMultipliers: [0.5, 0.5, 0.5, 0.5, 0.5],
  },
  {
    id: "leiyu",
    nameZh: "雷獄崩天",
    description: "引九霄雷霆困住敵人，四道雷柱各造成 40% 攻擊，最後一記巨雷造成 120% 攻擊；30% 機率使敵人麻痺，這回合無法反擊。",
    qiCost: 45,
    hitMultipliers: [0.4, 0.4, 0.4, 0.4, 1.2],
    paralyzeChance: 0.3,
  },
  {
    id: "xinyue",
    nameZh: "新月破空",
    description: "星穹弦月刃旋身一斬，新月光刃造成 140% 攻擊；劃開的星空裂縫再迸出兩顆星光，各造成 60% 攻擊。",
    qiCost: 40,
    hitMultipliers: [1.4, 0.6, 0.6],
  },
  {
    id: "yuehua",
    nameZh: "月華流照",
    description: "皓月流光劍引明月之光，揮出五波月華，一波比一波強：40%、40%、50%、50%、80% 攻擊，各自判定暴擊。",
    qiCost: 40,
    hitMultipliers: [0.4, 0.4, 0.5, 0.5, 0.8],
  },
];

export function getAdventureSkill(id: AdventureSkillId): AdventureSkill {
  const skill = adventureSkills.find(entry => entry.id === id);
  if (!skill) throw new Error(`Unknown adventure skill: ${id}`);
  return skill;
}
