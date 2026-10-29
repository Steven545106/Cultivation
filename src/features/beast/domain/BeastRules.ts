import { beastCatalog, DEFAULT_BEAST_ID, getBeastById, type BeastConfig, type BeastPossessionStat } from "./BeastCatalog";
import { getBeastRealmDamageMultiplier, getBeastRealmPossessionMultiplier, getBeastRealmStartIndex, getRealmStartStageIndex, onCurveBeastStageAt, onCurveSecondsAtTowerStage } from "./BeastRealm";

/** Stages per tower floor; kept local so the tower balance can depend on beasts without a cycle. */
const STAGES_PER_FLOOR = 10;

/** Battle-clock interval between a deployed beast's attacks. */
export const BEAST_ATTACK_INTERVAL_MS = 1_500;

export function isBeastUnlocked(beast: BeastConfig, highestClearedTowerStage: number): boolean {
  return highestClearedTowerStage >= beast.towerStageRequired;
}

export function getUnlockedBeasts(highestClearedTowerStage: number): readonly BeastConfig[] {
  return beastCatalog.filter(beast => isBeastUnlocked(beast, highestClearedTowerStage));
}

export function getBeastUnlockText(beast: BeastConfig): string {
  return beast.towerStageRequired === 0 ? "初始贈送" : `首次通關第 ${beast.towerStageRequired / STAGES_PER_FLOOR} 層 Boss`;
}

/** Stage a beast starts at when unlocked, and never stands below. */
export function getBeastStartStageIndex(beast: BeastConfig): number {
  return getRealmStartStageIndex(beast.startRealmId);
}

/** The saved deployment if that beast is unlocked, otherwise the starter beast. */
export function resolveDeployedBeast(deployedBeastId: string | null | undefined, highestClearedTowerStage: number): BeastConfig {
  const saved = deployedBeastId ? getBeastById(deployedBeastId) : undefined;
  return saved && isBeastUnlocked(saved, highestClearedTowerStage) ? saved : getBeastById(DEFAULT_BEAST_ID)!;
}

/** Deployed damage share at a beast realm stage (index into the realm stages, 0 = 凝氣一層). */
export function getBeastDamageShare(beast: BeastConfig, stageIndex = 0): number {
  return beast.damageShare * getBeastRealmDamageMultiplier(stageIndex);
}

/** Damage of one beast attack, from the hero's expected DPS. */
export function getBeastAttackDamage(beast: BeastConfig, heroDps: number, stageIndex = 0): number {
  return Math.max(1, Math.round(heroDps * getBeastDamageShare(beast, stageIndex) * BEAST_ATTACK_INTERVAL_MS / 1000));
}

/**
 * Share of hero DPS an on-curve player's deployed beast adds when first
 * attempting `stageNumber`. Every 妖丹 goes into one beast, which reaches the
 * on-curve beast stage for that time; the newest unlocked beast starts at the
 * beginning of that major realm, or its own starting realm if higher. The tower is sized for the hero alone, so
 * this is the beast's real advantage over its 20% margin.
 */
export function getExpectedBeastDamageShare(stageNumber: number): number {
  const fed = onCurveBeastStageAt(onCurveSecondsAtTowerStage(stageNumber));
  const unlocked = getUnlockedBeasts(stageNumber - 1);
  const newest = unlocked[unlocked.length - 1];
  return Math.max(...unlocked.map(beast => getBeastDamageShare(beast, Math.max(getBeastStartStageIndex(beast), beast === newest && unlocked.length > 1 ? getBeastRealmStartIndex(fed) : fed))));
}

export type BeastPossessionBonuses = Readonly<Record<BeastPossessionStat, number>>;

/** Possession bonuses of every unlocked beast, summed per stat. */
/** A beast's possession bonus at a realm stage: it grows with the beast's realm, deployed or not. */
export function getBeastPossessionValue(beast: BeastConfig, stageIndex = getBeastStartStageIndex(beast)): number {
  return beast.possession.value * getBeastRealmPossessionMultiplier(stageIndex);
}

/**
 * Possession bonuses of every unlocked beast, summed per stat, each at its realm
 * (`stageOf`, from the save; by default its starting realm).
 */
export function getBeastPossessionBonuses(highestClearedTowerStage: number, stageOf: (beast: BeastConfig) => number = getBeastStartStageIndex): BeastPossessionBonuses {
  const bonuses: Record<BeastPossessionStat, number> = { cultivationSpeed: 0, spiritStoneSpeed: 0, demonCoreYield: 0 };
  for (const beast of getUnlockedBeasts(highestClearedTowerStage)) bonuses[beast.possession.stat] += getBeastPossessionValue(beast, stageOf(beast));
  return bonuses;
}

const POSSESSION_LABEL: Readonly<Record<BeastPossessionStat, string>> = {
  cultivationSpeed: "修為速度",
  spiritStoneSpeed: "靈石速度",
  demonCoreYield: "妖丹產量",
};

/** e.g. "+3.4%": the possession bonus at the beast's realm stage (by default its starting realm). */
export function formatBeastPossessionValue(beast: BeastConfig, stageIndex = getBeastStartStageIndex(beast)): string {
  return `+${Math.round(getBeastPossessionValue(beast, stageIndex) * 1000) / 10}%`;
}

/** e.g. "修為速度 +3.4%". */
export function formatBeastPossession(beast: BeastConfig, stageIndex = getBeastStartStageIndex(beast)): string {
  return `${POSSESSION_LABEL[beast.possession.stat]} ${formatBeastPossessionValue(beast, stageIndex)}`;
}

export function getBeastPossessionLabel(stat: BeastPossessionStat): string {
  return POSSESSION_LABEL[stat];
}
