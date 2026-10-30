export type AdventureSkillId = "luoying";

export interface AdventureSkill {
  readonly id: AdventureSkillId;
  readonly nameZh: string;
  readonly description: string;
  /** Spirit power (靈力) spent when the skill is cast. */
  readonly qiCost: number;
  /** The skill lands as this many separate hits, each rolling its own critical. */
  readonly hits: number;
  /** Each hit deals this share of the hero's attack. */
  readonly hitMultiplier: number;
}

/** The hero's skill list. Only 落英繽紛 so far; the battle engine takes any entry added here. */
export const adventureSkills: readonly AdventureSkill[] = [
  {
    id: "luoying",
    nameZh: "落英繽紛",
    description: "寒櫻霜華劍化作漫天落花，花瓣連斬五次，每次造成 50% 攻擊，各自判定暴擊。",
    qiCost: 30,
    hits: 5,
    hitMultiplier: 0.5,
  },
];

export function getAdventureSkill(id: AdventureSkillId): AdventureSkill {
  const skill = adventureSkills.find(entry => entry.id === id);
  if (!skill) throw new Error(`Unknown adventure skill: ${id}`);
  return skill;
}
