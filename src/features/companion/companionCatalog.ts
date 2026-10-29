import { realmConfigs, type RealmId } from "../cultivation/domain/RealmCatalog";

export const companionCatalog = [
  { id: "lin-tingxue", name: "林聽雪", element: "冰雪系", description: "眉間藏雪意，心底有春風。", image: "/assets/companions/lin_tingxue-poster.webp", unlockStage: 0, requiredRealm: "qi", initialStageId: "qi-1", cultivationBonus: 0.05 },
  { id: "su-wanqing", name: "蘇婉清", element: "丹藥系", description: "一爐丹香伴暖意，妙手溫柔護仙途。", image: "/assets/companions/su_wanqing-poster.webp", unlockStage: 200, requiredRealm: "foundation", initialStageId: "foundation-1", cultivationBonus: 0.06 },
  { id: "gu-xinglan", name: "顧星瀾", element: "星象系", description: "觀星河流轉，推演萬千天機。", image: "/assets/companions/gu_xinglan-poster.webp", unlockStage: 400, requiredRealm: "nascentSoul", initialStageId: "nascentSoul-1", cultivationBonus: 0.06 },
  { id: "murong-wanyue", name: "慕容晚月", element: "月華系", description: "月華映清姿，從容自有風華。", image: "/assets/companions/murong_wanyue-poster.webp", unlockStage: 600, requiredRealm: "demigod", initialStageId: "demigod-1", cultivationBonus: 0.06 },
  { id: "nangong-yunshu", name: "南宮雲舒", element: "雲系", description: "閒看雲捲雲舒，笑行天地之間。", image: "/assets/companions/nangong_yunshu-poster.webp", unlockStage: 800, requiredRealm: "archaic", initialStageId: "archaic-1", cultivationBonus: 0.06 },
] as const;

const realmOrder: readonly RealmId[] = [...new Set(realmConfigs.map(stage => stage.realmId))];
export function isCompanionUnlocked(companion: typeof companionCatalog[number], highestClearedStage: number, realmId: RealmId): boolean {
  const current = realmOrder.indexOf(realmId);
  return current >= 0 && highestClearedStage >= companion.unlockStage && current >= realmOrder.indexOf(companion.requiredRealm);
}

export function getActiveCompanion(id: unknown, highestClearedStage: number, realmId: RealmId) {
  return companionCatalog.find(companion => companion.id === id && isCompanionUnlocked(companion, highestClearedStage, realmId)) ?? null;
}

export const INTIMACY_THRESHOLDS = [0, 10, 30, 60, 100] as const;
export const MAX_INTIMACY = 100;
export function normalizeIntimacy(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(MAX_INTIMACY, Math.floor(value))) : 0;
}
export function getIntimacyLevel(points: unknown): number {
  const normalized = normalizeIntimacy(points);
  return INTIMACY_THRESHOLDS.filter(threshold => normalized >= threshold).length;
}
export function getNextIntimacyThreshold(points: unknown): number | null {
  return INTIMACY_THRESHOLDS.find(threshold => threshold > normalizeIntimacy(points)) ?? null;
}
/** A companion advances one small realm stage per intimacy level after unlocking. */
export function getCompanionRealm(companion: typeof companionCatalog[number], points: unknown) {
  const start = realmConfigs.findIndex(stage => stage.stageId === companion.initialStageId);
  return realmConfigs[Math.min(realmConfigs.length - 1, start + getIntimacyLevel(points) - 1)];
}
export function migrateOldIntimacy(value: unknown): number {
  const old = Math.min(40, normalizeIntimacy(value));
  if (old === 40) return 100;
  const level = Math.floor(old / 10);
  const start = INTIMACY_THRESHOLDS[level];
  const end = INTIMACY_THRESHOLDS[level + 1];
  return start + Math.floor((old % 10) * (end - start) / 10);
}
export function getCompanionUnlockBonus(highestClearedStage: number, realmId: RealmId): number {
  return companionCatalog.reduce((total, companion, index) => total + (isCompanionUnlocked(companion, highestClearedStage, realmId) ? (index + 1) * 0.01 : 0), 0);
}
export function getDualCultivationBonus(id: unknown, highestClearedStage: number, realmId: RealmId, points: unknown): number {
  const companion = getActiveCompanion(id, highestClearedStage, realmId);
  return companion ? Math.min(0.10, companion.cultivationBonus + (getIntimacyLevel(points) - 1) * 0.01) : 0;
}

/** Success-rate bonus in percentage points; alchemy is not implemented yet. */
export function getDualAlchemySuccessBonus(id: unknown, highestClearedStage: number, realmId: RealmId, points: unknown): number {
  const companion = getActiveCompanion(id, highestClearedStage, realmId);
  return companion?.id === "su-wanqing" ? 0.10 + (getIntimacyLevel(points) - 1) * 0.05 : 0;
}

export function getDualSpecialty(id: unknown, highestClearedStage: number, realmId: RealmId, points: unknown, weaponElement = "") {
  const companion = getActiveCompanion(id, highestClearedStage, realmId);
  const amount = 0.05 + (getIntimacyLevel(points) - 1) * 0.01;
  return {
    weaponAttackPercent: companion?.id === "lin-tingxue" && weaponElement.includes("冰") || companion?.id === "murong-wanyue" && weaponElement.includes("月") ? amount : 0,
    breakthroughBonus: companion?.id === "gu-xinglan" ? amount : 0,
    skillCooldownReduction: companion?.id === "nangong-yunshu" ? amount : 0,
  };
}

const combatBonuses: Record<string, { attackPercent: number; critRateBonus: number; attackSpeedBonus: number }> = {
  "lin-tingxue": { attackPercent: 0.04, critRateBonus: 0.01, attackSpeedBonus: 0.02 },
  "su-wanqing": { attackPercent: 0.03, critRateBonus: 0.02, attackSpeedBonus: 0.03 },
  "gu-xinglan": { attackPercent: 0.04, critRateBonus: 0.05, attackSpeedBonus: 0.02 },
  "murong-wanyue": { attackPercent: 0.08, critRateBonus: 0.03, attackSpeedBonus: 0.03 },
  "nangong-yunshu": { attackPercent: 0.06, critRateBonus: 0.04, attackSpeedBonus: 0.08 },
};
export function getDualCombatBonus(id: unknown, highestClearedStage: number, realmId: RealmId, points: unknown) {
  const companion = getActiveCompanion(id, highestClearedStage, realmId);
  const bonus = companion ? combatBonuses[companion.id] : undefined;
  const multiplier = 1 + (getIntimacyLevel(points) - 1) * 0.1;
  return bonus ? { attackPercent: bonus.attackPercent * multiplier, critRateBonus: bonus.critRateBonus * multiplier, attackSpeedBonus: bonus.attackSpeedBonus * multiplier } : { attackPercent: 0, critRateBonus: 0, attackSpeedBonus: 0 };
}
