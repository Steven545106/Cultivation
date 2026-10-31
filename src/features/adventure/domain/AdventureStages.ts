import { PILL_CATALOG, localDateKey, type PillId } from "../../alchemy/Alchemy";
import { demonCoresPerSecond } from "../../beast/domain/BeastRealm";
import { getSpiritStonesPerSecond } from "../../cultivation/domain/CultivationRewardConfig";
import { getTowerStage } from "../../tower/domain/TowerCatalog";
import { towerThemes } from "../../tower/domain/TowerTheme";
import { ADVENTURE_BALANCE, type AdventureEnemySpec, type Roll } from "./AdventureBattle";
import { creatureNames } from "./AdventureEnemies";
import { isAdventureSkillId, type AdventureSkillId } from "./AdventureSkills";

/**
 * 遊歷 stages: ten regions (the tower's ten themes, with their backdrops and
 * creatures), six stages each, the sixth a boss. A region opens once the boss
 * of the one before it falls. Enemy strength is fixed per stage, sized on the
 * tower floor it stands for, so growing stronger makes the fights easier.
 */
export const ADVENTURE_STAGES_PER_REGION = 6;
/** Tower stage (within the region's hundred) each adventure stage is sized on: rooms 5 and 9, never a tower boss room, whose extra strength the adventure boss adds itself. */
const STAGE_TOWER_OFFSETS = [15, 35, 55, 75, 95, 99] as const;

/**
 * Team DPS per point of attack of a hero who has just cleared each region's
 * tower floors, at the end of the region (crit, attack speed and the beast all
 * add to DPS, not to the attack a turn-based strike uses). Read off the stat
 * lab; a test keeps it honest. Between region ends it is interpolated.
 */
export const ADVENTURE_DPS_PER_ATTACK = [1.02, 1.73, 1.91, 2.21, 3.48, 3.86, 4.63, 4.89, 5.63, 6.71] as const;

function dpsPerAttackAt(towerStage: number): number {
  const table = ADVENTURE_DPS_PER_ATTACK;
  if (towerStage <= 100) return table[0];
  const region = Math.min(table.length - 1, Math.ceil(towerStage / 100) - 1);
  const t = (towerStage - region * 100) / 100;
  return table[region - 1] + (table[region] - table[region - 1]) * t;
}

export const ADVENTURE_STAGE_BALANCE = {
  /** A normal enemy takes about this many of the reference hero's attacks to fall (≈ 5–6 turns of mixed strikes and skills). */
  enemyHpPerAttack: 11,
  bossHpMultiplier: 1.8,
  /** An enemy blow takes this share of the reference hero's hit points (≈ 12 blows to fall). */
  enemyDamageShare: 0.085,
  /** Rewards, in seconds of idle income at the stage's realm. */
  firstClearStoneSeconds: 1800,
  firstClearCoreSeconds: 900,
  bossRewardMultiplier: 3,
  /** A repeat clear pays this share of the first clear, for this many repeats a day. */
  repeatShare: 0.2,
  dailyRepeats: 20,
} as const;

export interface AdventureRegion {
  readonly index: number;
  readonly themeId: string;
  readonly nameZh: string;
  readonly creatureZh: string;
}

export const adventureRegions: readonly AdventureRegion[] = towerThemes.map((theme, index) => ({
  index,
  themeId: theme.id,
  nameZh: theme.nameZh,
  creatureZh: creatureNames[theme.id] ?? theme.nameZh,
}));

export interface AdventureProgress {
  /** Highest stage cleared in each region (by theme id), 0–6. */
  readonly cleared: Readonly<Record<string, number>>;
  /** Skills taken into a fight. */
  readonly skills: readonly AdventureSkillId[];
  /** Local date the repeat count belongs to. */
  readonly dailyDate: string;
  readonly dailyRepeats: number;
}

export function createAdventureProgress(): AdventureProgress {
  return { cleared: {}, skills: [], dailyDate: "", dailyRepeats: 0 };
}

export function normalizeAdventureProgress(value: unknown): AdventureProgress {
  if (typeof value !== "object" || value === null) return createAdventureProgress();
  const raw = value as Record<string, unknown>;
  const cleared: Record<string, number> = {};
  if (typeof raw.cleared === "object" && raw.cleared !== null) {
    for (const region of adventureRegions) {
      const count = (raw.cleared as Record<string, unknown>)[region.themeId];
      if (typeof count === "number" && Number.isFinite(count)) cleared[region.themeId] = Math.max(0, Math.min(ADVENTURE_STAGES_PER_REGION, Math.floor(count)));
    }
  }
  const skills = Array.isArray(raw.skills) ? raw.skills.filter(isAdventureSkillId) : [];
  const dailyRepeats = typeof raw.dailyRepeats === "number" && Number.isFinite(raw.dailyRepeats) ? Math.max(0, Math.floor(raw.dailyRepeats)) : 0;
  return { cleared, skills, dailyDate: typeof raw.dailyDate === "string" ? raw.dailyDate : "", dailyRepeats };
}

export function getClearedStages(progress: AdventureProgress, regionIndex: number): number {
  const region = adventureRegions[regionIndex];
  return region ? progress.cleared[region.themeId] ?? 0 : 0;
}

export function isRegionOpen(progress: AdventureProgress, regionIndex: number): boolean {
  if (regionIndex < 0 || regionIndex >= adventureRegions.length) return false;
  return regionIndex === 0 || getClearedStages(progress, regionIndex - 1) >= ADVENTURE_STAGES_PER_REGION;
}

/** A stage can be fought once its region is open and the stage before it is cleared; cleared stages can be fought again. */
export function canChallengeStage(progress: AdventureProgress, regionIndex: number, stage: number): boolean {
  return isRegionOpen(progress, regionIndex) && stage >= 1 && stage <= Math.min(ADVENTURE_STAGES_PER_REGION, getClearedStages(progress, regionIndex) + 1);
}

export const isBossStage = (stage: number): boolean => stage === ADVENTURE_STAGES_PER_REGION;

/** The tower stage an adventure stage is sized on. */
export function getStageTowerNumber(regionIndex: number, stage: number): number {
  return regionIndex * 100 + STAGE_TOWER_OFFSETS[Math.max(0, Math.min(ADVENTURE_STAGES_PER_REGION, stage) - 1)];
}

/** Attack of the hero the stage is sized for: the tower stage's required DPS turned back into attack. */
export function getStageReferenceAttack(regionIndex: number, stage: number): number {
  const towerStage = getStageTowerNumber(regionIndex, stage);
  return getTowerStage(towerStage).requiredDps / dpsPerAttackAt(towerStage);
}

export function getAdventureEnemy(regionIndex: number, stage: number): AdventureEnemySpec {
  const region = adventureRegions[regionIndex];
  const boss = isBossStage(stage);
  const reference = getStageReferenceAttack(regionIndex, stage);
  const balance = ADVENTURE_STAGE_BALANCE;
  return {
    id: `${region.themeId}-${stage}`,
    nameZh: boss ? `${region.creatureZh}王` : region.creatureZh,
    themeId: region.themeId,
    isBoss: boss,
    maxHp: Math.round(reference * balance.enemyHpPerAttack * (boss ? balance.bossHpMultiplier : 1)),
    attack: Math.round(reference * ADVENTURE_BALANCE.heroHpPerAttack * balance.enemyDamageShare),
  };
}

export interface AdventureReward {
  readonly spiritStones: number;
  readonly demonCores: number;
  /** A boss's first clear also gives a pill of this kind and quality (0 雜品 … 5 天品). */
  readonly pill: { readonly id: PillId; readonly quality: number } | null;
}

/** What a clear pays: the full reward the first time, a share of it on repeats (null once the day's repeats are used). */
export function getAdventureReward(regionIndex: number, stage: number, firstClear: boolean, roll: Roll = Math.random): AdventureReward {
  const realmId = getTowerStage(getStageTowerNumber(regionIndex, stage)).expectedRealmId;
  const balance = ADVENTURE_STAGE_BALANCE;
  const scale = (isBossStage(stage) ? balance.bossRewardMultiplier : 1) * (firstClear ? 1 : balance.repeatShare);
  const pill = firstClear && isBossStage(stage)
    ? { id: PILL_CATALOG[Math.min(PILL_CATALOG.length - 1, Math.floor(roll() * PILL_CATALOG.length))].id, quality: Math.min(4, Math.floor(regionIndex / 2)) }
    : null;
  return {
    spiritStones: Math.round(getSpiritStonesPerSecond(realmId) * balance.firstClearStoneSeconds * scale),
    demonCores: Math.round(demonCoresPerSecond[realmId] * balance.firstClearCoreSeconds * scale),
    pill,
  };
}

export interface AdventureVictory {
  readonly progress: AdventureProgress;
  readonly firstClear: boolean;
  /** Null when a repeat clear came after the day's rewarded repeats. */
  readonly reward: AdventureReward | null;
}

/** Records a won stage: advances the region on a first clear and pays the reward. */
export function settleAdventureVictory(progress: AdventureProgress, regionIndex: number, stage: number, now: number, roll: Roll = Math.random): AdventureVictory {
  if (!canChallengeStage(progress, regionIndex, stage)) return { progress, firstClear: false, reward: null };
  const region = adventureRegions[regionIndex];
  const firstClear = stage > getClearedStages(progress, regionIndex);
  if (firstClear) {
    return { progress: { ...progress, cleared: { ...progress.cleared, [region.themeId]: stage } }, firstClear, reward: getAdventureReward(regionIndex, stage, true, roll) };
  }
  const today = localDateKey(now);
  const used = progress.dailyDate === today ? progress.dailyRepeats : 0;
  if (used >= ADVENTURE_STAGE_BALANCE.dailyRepeats) return { progress: { ...progress, dailyDate: today, dailyRepeats: used }, firstClear, reward: null };
  return { progress: { ...progress, dailyDate: today, dailyRepeats: used + 1 }, firstClear, reward: getAdventureReward(regionIndex, stage, false, roll) };
}

export function repeatsLeftToday(progress: AdventureProgress, now: number): number {
  return ADVENTURE_STAGE_BALANCE.dailyRepeats - (progress.dailyDate === localDateKey(now) ? progress.dailyRepeats : 0);
}

/** The furthest stage the hero can fight: the next uncleared stage of the furthest open region. */
export function getFrontierStage(progress: AdventureProgress): { readonly regionIndex: number; readonly stage: number } {
  let regionIndex = 0;
  while (regionIndex + 1 < adventureRegions.length && isRegionOpen(progress, regionIndex + 1)) regionIndex += 1;
  return { regionIndex, stage: Math.min(ADVENTURE_STAGES_PER_REGION, getClearedStages(progress, regionIndex) + 1) };
}
