import { getRealmStage, realmConfigs, type RealmId } from "../../cultivation";

/**
 * Combat values supplied by a cultivation stage alone. The realm scales the
 * sword's damage instead of adding a flat per-hit value, so every sword grows
 * proportionally and fast swords are not favoured. Critical chance is 0–1.
 */
export interface RealmCombatStats {
  readonly attackMultiplier: number;
  readonly critRate: number;
}

export interface RealmCombatStatsEntry extends RealmCombatStats {
  readonly stageId: string;
}

/** Every stage step multiplies attack by this; a major breakthrough adds the bonus on top. */
export const REALM_STAGE_ATTACK_GROWTH = 1.06;
export const REALM_BREAKTHROUGH_ATTACK_BONUS = 1.18;

const critByRealm: Readonly<Record<RealmId, readonly number[]>> = {
  qi: [0, 0.002, 0.004, 0.006, 0.008, 0.01, 0.012, 0.014, 0.016, 0.018],
  foundation: [0.03, 0.04, 0.05, 0.06],
  core: [0.07, 0.08, 0.09, 0.1],
  nascentSoul: [0.11, 0.12, 0.13, 0.14],
  celestial: [0.15, 0.16, 0.17, 0.18],
  demigod: [0.19, 0.2, 0.21, 0.22],
  venerable: [0.24, 0.26, 0.28, 0.3],
  archaic: [0.32, 0.34, 0.36, 0.38],
  sovereign: [0.4, 0.42, 0.44, 0.46],
  eternal: [0.5],
};

/**
 * M = 1.06^(stage steps) × 1.18^(major breakthroughs). Stage ids come from the
 * existing RealmCatalog; this is deliberately not a second realm numbering scheme.
 */
export const realmCombatStatsConfig: readonly RealmCombatStatsEntry[] = (() => {
  let multiplier = 1;
  return realmConfigs.map((stage, index) => {
    if (index > 0) {
      multiplier *= REALM_STAGE_ATTACK_GROWTH;
      if (realmConfigs[index - 1].realmId !== stage.realmId) multiplier *= REALM_BREAKTHROUGH_ATTACK_BONUS;
    }
    const stageIndex = realmConfigs.filter(candidate => candidate.realmId === stage.realmId)
      .findIndex(candidate => candidate.stageId === stage.stageId);
    const critRate = critByRealm[stage.realmId][stageIndex];
    if (critRate === undefined) throw new Error(`Missing combat stats for ${stage.stageId}`);
    return { stageId: stage.stageId, attackMultiplier: Math.round(multiplier * 10_000) / 10_000, critRate };
  });
})();

const byStageId = new Map(realmCombatStatsConfig.map(entry => [entry.stageId, entry]));

export function getRealmCombatStats(stageId: string): RealmCombatStats {
  // Retain RealmCatalog as the validation authority for stage identities.
  getRealmStage(stageId);
  const stats = byStageId.get(stageId);
  if (!stats) throw new Error(`Missing combat stats for ${stageId}`);
  return { attackMultiplier: stats.attackMultiplier, critRate: stats.critRate };
}
