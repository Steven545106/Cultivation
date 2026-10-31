import { adventureRegions, ADVENTURE_STAGES_PER_REGION, getStageReferenceAttack } from "../adventure";
import { PILL_CATALOG, type PillId } from "../alchemy/Alchemy";
import {
  beastCatalog,
  BEAST_MAX_STAGE_INDEX,
  demonCoresPerSecond,
  getBeastDamageShare,
  getBeastPossessionBonuses,
  getBeastStartStageIndex,
  isBeastUnlocked,
  type BeastConfig,
  type BeastId,
} from "../beast";
import { calculateFinalCombatStats, weaponToCombatStats, type FinalCombatStats } from "../combat";
import {
  companionCatalog,
  getCompanionUnlockBonus,
  getDualCombatBonus,
  getDualCultivationBonus,
  getDualSpecialty,
  INTIMACY_THRESHOLDS,
  isCompanionUnlocked,
} from "../companion/companionCatalog";
import { breakthroughConfig, getNextRealmStage, getRealmStage, getSpiritStonesPerSecond, realmConfigs } from "../cultivation";
import { getRealmCombatStats } from "../realm";
import { MAX_REFINEMENT_LEVEL } from "../refinement";
import { getTowerStage, getTowerStageCapForRealm, TOWER_STAGES_PER_FLOOR, TOWER_TOTAL_STAGES } from "../tower";
import { getActiveWeaponEffects, getWeaponUnlockStatus, weaponCatalog } from "../weapon";

/**
 * 數值實驗室: one made-up character, fed through the game's own rules, so the
 * effect of every realm, sword, beast, companion and pill step can be read off
 * without a save. Mirrors how the game combines the bonuses (see
 * ui/hooks/loadoutCombatStats and game/save/GameSaveService).
 */
export interface LabProfile {
  readonly stageId: string;
  readonly towerCleared: number;
  readonly weaponId: string;
  readonly refinementLevel: number;
  /** Realm stage index of each unlocked beast (missing: its starting realm). */
  readonly beastStages: Partial<Record<BeastId, number>>;
  readonly deployedBeastId: BeastId;
  readonly companionId: string | null;
  readonly intimacy: number;
  /** Pills eaten of each kind, all at `pillQuality`. */
  readonly pillCounts: Partial<Record<PillId, number>>;
  /** 0 雜品 … 5 天品. */
  readonly pillQuality: number;
}

export interface LabResult {
  readonly combat: FinalCombatStats;
  /** Deployed beast damage as a share of the hero's DPS. */
  readonly beastShare: number;
  /** Hero plus deployed beast. */
  readonly teamDps: number;
  /** Highest tower stage whose monster dies within its time limit at `teamDps`, within the realm's cap. */
  readonly towerReach: number;
  readonly towerCap: number;
  /** Adventure stages whose sizing attack the hero's attack reaches (0–60), the estimate of how far 遊歷 goes. */
  readonly adventureReach: number;
  readonly cultivationPerSecond: number;
  readonly spiritStonesPerSecond: number;
  readonly demonCoresPerSecond: number;
  /** Success chance of the next major breakthrough (first try), or null when the next stage needs none. */
  readonly breakthroughRate: number | null;
  readonly breakthroughTarget: string | null;
  /** How each income multiplier is made up, for the page to explain. */
  readonly parts: {
    readonly cultivation: Readonly<Record<string, number>>;
    readonly spiritStones: Readonly<Record<string, number>>;
    readonly demonCores: Readonly<Record<string, number>>;
  };
}

export const defaultLabProfile: LabProfile = {
  stageId: realmConfigs[0].stageId,
  towerCleared: 0,
  weaponId: weaponCatalog[0].weaponId,
  refinementLevel: 0,
  beastStages: {},
  deployedBeastId: beastCatalog[0].beastId,
  companionId: null,
  intimacy: 0,
  pillCounts: {},
  pillQuality: 2,
};

const realmIdOf = (stageId: string) => getRealmStage(stageId).realmId;

export function labBeastStage(profile: LabProfile, beast: BeastConfig): number {
  return Math.max(getBeastStartStageIndex(beast), Math.min(BEAST_MAX_STAGE_INDEX, profile.beastStages[beast.beastId] ?? 0));
}

export function labPill(profile: LabProfile, id: PillId): number {
  const pill = PILL_CATALOG.find(entry => entry.id === id)!;
  return (profile.pillCounts[id] ?? 0) * (pill.values[profile.pillQuality] ?? 0);
}

export function labUnlockedWeapons(profile: LabProfile) {
  const context = { realmStageId: profile.stageId, highestClearedTowerStage: profile.towerCleared };
  return weaponCatalog.filter(weapon => getWeaponUnlockStatus(weapon, context).unlocked);
}

export function labUnlockedBeasts(profile: LabProfile) {
  return beastCatalog.filter(beast => isBeastUnlocked(beast, profile.towerCleared));
}

export function labUnlockedCompanions(profile: LabProfile) {
  const realmId = realmIdOf(profile.stageId);
  return companionCatalog.filter(companion => isCompanionUnlocked(companion, profile.towerCleared, realmId));
}

export function evaluateLab(profile: LabProfile): LabResult {
  const realmId = realmIdOf(profile.stageId);
  const weapon = weaponCatalog.find(entry => entry.weaponId === profile.weaponId) ?? weaponCatalog[0];
  const effects = getActiveWeaponEffects(labUnlockedWeapons(profile), weapon);
  const { towerCleared, companionId, intimacy } = profile;
  const companion = getDualCombatBonus(companionId, towerCleared, realmId, intimacy);
  const specialty = getDualSpecialty(companionId, towerCleared, realmId, intimacy, weapon.element);
  const combat = calculateFinalCombatStats(getRealmCombatStats(profile.stageId), weaponToCombatStats(weapon), profile.refinementLevel, effects.total, {
    attackPercent: companion.attackPercent + specialty.weaponAttackPercent + labPill(profile, "attack"),
    critRateBonus: companion.critRateBonus + labPill(profile, "crit"),
    attackSpeedBonus: companion.attackSpeedBonus + labPill(profile, "speed"),
  });

  const unlockedBeasts = labUnlockedBeasts(profile);
  const deployed = unlockedBeasts.find(beast => beast.beastId === profile.deployedBeastId) ?? beastCatalog[0];
  const beastShare = getBeastDamageShare(deployed, labBeastStage(profile, deployed));
  const teamDps = combat.dps * (1 + beastShare);
  const towerCap = getTowerStageCapForRealm(realmId);
  let towerReach = 0;
  for (let stage = 1; stage <= Math.min(towerCap, TOWER_TOTAL_STAGES); stage += 1) {
    if (teamDps < getTowerStage(stage).requiredDps) break;
    towerReach = stage;
  }

  // Every unlocked beast's possession bonus at its own realm, as the game pays it.
  const beastIncome = getBeastPossessionBonuses(towerCleared, beast => labBeastStage(profile, beast));
  const cultivation = {
    靈獸持有: beastIncome.cultivationSpeed,
    道侶解鎖: getCompanionUnlockBonus(towerCleared, realmId),
    雙修: getDualCultivationBonus(companionId, towerCleared, realmId, intimacy),
    聚靈丹: labPill(profile, "cultivation"),
  };
  const spiritStones = { 靈獸持有: beastIncome.spiritStoneSpeed, 納財丹: labPill(profile, "stones") };
  const demonCores = { 靈獸持有: beastIncome.demonCoreYield, 凝妖丹: labPill(profile, "cores") };
  const multiplier = (parts: Record<string, number>) => 1 + Object.values(parts).reduce((sum, value) => sum + value, 0);

  const stage = getRealmStage(profile.stageId);
  let breakthroughRate: number | null = null;
  let breakthroughTarget: string | null = null;
  for (let next = getNextRealmStage(stage.stageId); next; next = getNextRealmStage(next.stageId)) {
    if (next.realmId === stage.realmId) continue;
    const bonus = getDualSpecialty(companionId, towerCleared, realmId, intimacy).breakthroughBonus + labPill(profile, "breakthrough");
    breakthroughRate = Math.min(1, breakthroughConfig.baseSuccessRateByTargetRealm[next.realmId] + bonus);
    breakthroughTarget = next.realmNameZh;
    break;
  }

  let adventureReach = 0;
  for (const region of adventureRegions) {
    for (let stage = 1; stage <= ADVENTURE_STAGES_PER_REGION; stage += 1) {
      if (combat.attack < getStageReferenceAttack(region.index, stage)) break;
      adventureReach = region.index * ADVENTURE_STAGES_PER_REGION + stage;
    }
    if (adventureReach < (region.index + 1) * ADVENTURE_STAGES_PER_REGION) break;
  }

  return {
    combat,
    beastShare,
    adventureReach,
    teamDps,
    towerReach,
    towerCap,
    cultivationPerSecond: stage.baseCultivationRate * multiplier(cultivation),
    spiritStonesPerSecond: getSpiritStonesPerSecond(realmId) * multiplier(spiritStones),
    demonCoresPerSecond: demonCoresPerSecond[realmId] * multiplier(demonCores),
    breakthroughRate,
    breakthroughTarget,
    parts: { cultivation, spiritStones, demonCores },
  };
}

/** One step a player can take; null when it cannot be taken from this profile. */
export interface LabStep {
  readonly system: "境界" | "仙劍" | "靈獸" | "道侶" | "靈丹" | "通天塔";
  readonly label: string;
  readonly apply: (profile: LabProfile) => LabProfile | null;
}

const stageIndexOf = (stageId: string) => realmConfigs.findIndex(stage => stage.stageId === stageId);

export const labSteps: readonly LabStep[] = [
  {
    system: "境界",
    label: "升一小階",
    apply: profile => {
      const next = realmConfigs[stageIndexOf(profile.stageId) + 1];
      return next ? { ...profile, stageId: next.stageId } : null;
    },
  },
  {
    system: "仙劍",
    label: "煉靈 +1",
    apply: profile => (profile.refinementLevel < MAX_REFINEMENT_LEVEL ? { ...profile, refinementLevel: profile.refinementLevel + 1 } : null),
  },
  {
    system: "仙劍",
    label: "換裝已解鎖中最強的劍",
    apply: profile => {
      const best = labUnlockedWeapons(profile).at(-1);
      return best && best.weaponId !== profile.weaponId ? { ...profile, weaponId: best.weaponId } : null;
    },
  },
  {
    system: "靈獸",
    label: "出戰靈獸 +1 小階",
    apply: profile => {
      const beast = beastCatalog.find(entry => entry.beastId === profile.deployedBeastId);
      if (!beast) return null;
      const stage = labBeastStage(profile, beast);
      return stage < BEAST_MAX_STAGE_INDEX ? { ...profile, beastStages: { ...profile.beastStages, [beast.beastId]: stage + 1 } } : null;
    },
  },
  {
    system: "道侶",
    label: "親密度 +1 級",
    apply: profile => {
      const next = INTIMACY_THRESHOLDS.find(threshold => threshold > profile.intimacy);
      return profile.companionId && next !== undefined ? { ...profile, intimacy: next } : null;
    },
  },
  ...PILL_CATALOG.map<LabStep>(pill => ({
    system: "靈丹",
    label: `${pill.name} +10 顆`,
    apply: profile => ({ ...profile, pillCounts: { ...profile.pillCounts, [pill.id]: (profile.pillCounts[pill.id] ?? 0) + 10 } }),
  })),
  {
    system: "通天塔",
    label: "多通關 1 層",
    apply: profile => (profile.towerCleared + TOWER_STAGES_PER_FLOOR <= TOWER_TOTAL_STAGES ? { ...profile, towerCleared: profile.towerCleared + TOWER_STAGES_PER_FLOOR } : null),
  },
];

export type LabMetric = "attack" | "critRate" | "attackSpeed" | "teamDps" | "towerReach" | "adventureReach" | "cultivationPerSecond" | "spiritStonesPerSecond" | "demonCoresPerSecond" | "breakthroughRate";

export function labMetric(result: LabResult, metric: LabMetric): number {
  switch (metric) {
    case "attack": return result.combat.attack;
    case "critRate": return result.combat.critRate;
    case "attackSpeed": return result.combat.attackSpeed;
    case "breakthroughRate": return result.breakthroughRate ?? 0;
    default: return result[metric];
  }
}

export interface LabStepImpact {
  readonly step: LabStep;
  /** Null when the step is not available from this profile. */
  readonly after: LabResult | null;
}

export function evaluateLabSteps(profile: LabProfile): readonly LabStepImpact[] {
  return labSteps.map(step => {
    const next = step.apply(profile);
    return { step, after: next ? evaluateLab(next) : null };
  });
}
