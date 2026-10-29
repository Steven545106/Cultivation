export type MonsterStatus = "idle" | "hit" | "dead";

/** Monsters are deliberately passive: no attack, defence, or AI attributes exist here. */
export interface MonsterState {
  readonly id: string;
  readonly nameZh: string;
  readonly isBoss: boolean;
  readonly maxHp: number;
  readonly currentHp: number;
  readonly status: MonsterStatus;
}

export function createMonsterState(input: Omit<MonsterState, "currentHp" | "status">): MonsterState {
  const maxHp = Math.max(1, Math.round(input.maxHp));
  return { ...input, maxHp, currentHp: maxHp, status: "idle" };
}

export function applyMonsterDamage(monster: MonsterState, damage: number): MonsterState {
  if (monster.status === "dead") return monster;
  const currentHp = Math.max(0, monster.currentHp - Math.max(0, Math.round(damage)));
  return { ...monster, currentHp, status: currentHp === 0 ? "dead" : "hit" };
}

export function getMonsterHealthRatio(monster: MonsterState): number {
  return monster.currentHp / monster.maxHp;
}
