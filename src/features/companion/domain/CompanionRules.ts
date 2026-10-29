import { getRealmStage, realmConfigs, type RealmId } from "../../cultivation/domain/RealmCatalog";
import { companionCatalog, getCompanionById, isCompanionId, type CompanionConfig, type CompanionId } from "./CompanionCatalog";

/** Saved companion state: the dual-cultivation partner and each companion's affinity; unlocks follow the realm. */
export interface CompanionProgress {
  readonly partnerId: CompanionId | null;
  /** Seconds each companion has spent as the dual partner (默契), offline time included. */
  readonly affinitySeconds: Readonly<Partial<Record<CompanionId, number>>>;
}

export function createCompanionProgress(): CompanionProgress {
  return { partnerId: null, affinitySeconds: {} };
}

export function normalizeCompanionProgress(raw: unknown): CompanionProgress {
  const record = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  const savedAffinity = typeof record.affinitySeconds === "object" && record.affinitySeconds !== null ? record.affinitySeconds as Record<string, unknown> : {};
  const affinitySeconds: Partial<Record<CompanionId, number>> = {};
  for (const [companionId, seconds] of Object.entries(savedAffinity)) {
    if (isCompanionId(companionId) && typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) affinitySeconds[companionId] = seconds;
  }
  return { partnerId: isCompanionId(record.partnerId) ? record.partnerId : null, affinitySeconds };
}

/**
 * Affinity (默契): hours as the dual partner needed for each level, 1 to 10.
 * Each level strengthens her dual-cultivation effect by AFFINITY_BONUS_PER_LEVEL
 * (×1.5 at level 10); her possession bonus is unchanged.
 */
export const AFFINITY_LEVEL_HOURS = [0.5, 1, 2, 4, 6, 9, 12, 16, 20, 24] as const;
export const AFFINITY_BONUS_PER_LEVEL = 0.05;
export const MAX_AFFINITY_LEVEL = AFFINITY_LEVEL_HOURS.length;

export function getAffinityLevel(seconds: number): number {
  return AFFINITY_LEVEL_HOURS.filter(hours => seconds >= hours * 3600).length;
}

/** Level, and progress towards the next one (null at the top level). */
export function getAffinityProgress(seconds: number): { readonly level: number; readonly nextLevelSeconds: number | null; readonly share: number } {
  const level = getAffinityLevel(seconds);
  if (level >= MAX_AFFINITY_LEVEL) return { level, nextLevelSeconds: null, share: 1 };
  const from = level === 0 ? 0 : AFFINITY_LEVEL_HOURS[level - 1] * 3600;
  const to = AFFINITY_LEVEL_HOURS[level] * 3600;
  return { level, nextLevelSeconds: to - seconds, share: (seconds - from) / (to - from) };
}

/** How much stronger her dual effect is at this affinity level. */
export function getAffinityMultiplier(level: number): number {
  return 1 + AFFINITY_BONUS_PER_LEVEL * Math.max(0, Math.min(MAX_AFFINITY_LEVEL, level));
}

export function getCompanionAffinityLevel(progress: CompanionProgress, companionId: CompanionId): number {
  return getAffinityLevel(progress.affinitySeconds[companionId] ?? 0);
}

/** Credits `seconds` of dual cultivation to the partner a hero in `realmId` has (the default one if none chosen). */
export function accrueAffinity(progress: CompanionProgress, realmId: RealmId, seconds: number): CompanionProgress {
  const partner = resolveDualPartner(progress.partnerId, realmId);
  if (!partner || !(seconds > 0)) return progress;
  return { ...progress, affinitySeconds: { ...progress.affinitySeconds, [partner.companionId]: (progress.affinitySeconds[partner.companionId] ?? 0) + seconds } };
}

const realmOrder: readonly RealmId[] = [...new Set(realmConfigs.map(stage => stage.realmId))];

export function isCompanionUnlocked(companion: CompanionConfig, realmId: RealmId): boolean {
  return realmOrder.indexOf(realmId) >= realmOrder.indexOf(companion.unlockRealmId);
}

export function getUnlockedCompanions(realmId: RealmId): readonly CompanionConfig[] {
  return companionCatalog.filter(companion => isCompanionUnlocked(companion, realmId));
}

export function getCompanionUnlockText(companion: CompanionConfig): string {
  return `達到「${getRealmStage(`${companion.unlockRealmId}-1`).realmNameZh}」境界`;
}

/**
 * The companion cultivating with the hero: the saved one if unlocked, else the
 * first unlocked companion (so a newly unlocked one helps at once), else none.
 */
export function resolveDualPartner(partnerId: CompanionId | null, realmId: RealmId): CompanionConfig | null {
  const saved = partnerId ? getCompanionById(partnerId) : undefined;
  if (saved && isCompanionUnlocked(saved, realmId)) return saved;
  return getUnlockedCompanions(realmId)[0] ?? null;
}

export interface CompanionBonuses {
  /** Possession of every unlocked companion plus the partner's dual effect. */
  readonly cultivationSpeed: number;
  readonly spiritStoneSpeed: number;
  readonly attackPercent: number;
  readonly breakthroughSuccessBonus: number;
  readonly breakthroughFailureProtection: boolean;
}

export const NO_COMPANION_BONUSES: CompanionBonuses = {
  cultivationSpeed: 0,
  spiritStoneSpeed: 0,
  attackPercent: 0,
  breakthroughSuccessBonus: 0,
  breakthroughFailureProtection: false,
};

/** Sum of every unlocked companion's possession bonus (cultivation speed). */
export function getCompanionPossessionBonus(realmId: RealmId): number {
  return getUnlockedCompanions(realmId).reduce((total, companion) => total + companion.possessionCultivationSpeed, 0);
}

/**
 * Everything companions add for a hero in `realmId` cultivating with `partnerId`
 * (null: the default partner), her dual effect strengthened by `affinityLevel`.
 */
export function getCompanionBonuses(realmId: RealmId, partnerId: CompanionId | null, affinityLevel = 0): CompanionBonuses {
  const partner = resolveDualPartner(partnerId, realmId);
  const dual = partner?.dualEffect;
  const boost = getAffinityMultiplier(affinityLevel);
  return {
    cultivationSpeed: getCompanionPossessionBonus(realmId) + (dual?.cultivationSpeed ?? 0) * boost,
    spiritStoneSpeed: (dual?.spiritStoneSpeed ?? 0) * boost,
    attackPercent: (dual?.attackPercent ?? 0) * boost,
    breakthroughSuccessBonus: (dual?.breakthroughSuccessBonus ?? 0) * boost,
    breakthroughFailureProtection: dual?.breakthroughFailureProtection ?? false,
  };
}

/** Companion bonuses from saved progress: the resolved partner at her own affinity. */
export function getSavedCompanionBonuses(realmId: RealmId, progress: CompanionProgress): CompanionBonuses {
  const partner = resolveDualPartner(progress.partnerId, realmId);
  return getCompanionBonuses(realmId, progress.partnerId, partner ? getCompanionAffinityLevel(progress, partner.companionId) : 0);
}

const pct = (value: number): string => `${Math.round(value * 1000) / 10}%`;

export function formatCompanionPossession(companion: CompanionConfig): string {
  return `修為速度 +${pct(companion.possessionCultivationSpeed)}`;
}

/** Dual-cultivation effect lines, attack first, at `affinityLevel`. */
export function formatCompanionDualEffect(companion: CompanionConfig, affinityLevel = 0): readonly string[] {
  const effect = companion.dualEffect;
  const boost = getAffinityMultiplier(affinityLevel);
  const lines = [`攻擊 +${pct(effect.attackPercent * boost)}`];
  if (effect.cultivationSpeed) lines.push(`修為速度 +${pct(effect.cultivationSpeed * boost)}`);
  if (effect.spiritStoneSpeed) lines.push(`靈石速度 +${pct(effect.spiritStoneSpeed * boost)}`);
  if (effect.breakthroughFailureProtection) lines.push("突破失敗不扣修為");
  if (effect.breakthroughSuccessBonus) lines.push(`突破成功率 +${Math.round(effect.breakthroughSuccessBonus * boost * 1000) / 10} 個百分點`);
  return lines;
}
