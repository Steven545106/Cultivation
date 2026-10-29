import { beastCatalog, DEFAULT_BEAST_ID, getBeastById, isBeastId, type BeastId } from "./BeastCatalog";
import { getBeastRealmStartIndex, normalizeBeastStageIndex } from "./BeastRealm";
import { getBeastStartStageIndex, isBeastUnlocked } from "./BeastRules";

export interface BeastRealmProgress {
  /** Index into the realm stages (0 = 凝氣一層 … 42 = 永恆). */
  readonly stageIndex: number;
  /** True once this beast unlocked and received its inherited starting realm. */
  readonly unlockSettled: boolean;
}

export interface BeastProgress {
  readonly deployedBeastId: BeastId;
  readonly beasts: Readonly<Partial<Record<BeastId, BeastRealmProgress>>>;
}

export function createBeastProgress(): BeastProgress {
  return { deployedBeastId: DEFAULT_BEAST_ID, beasts: {} };
}

export function normalizeBeastProgress(raw: unknown): BeastProgress {
  const record = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  const savedBeasts = typeof record.beasts === "object" && record.beasts !== null ? record.beasts as Record<string, unknown> : {};
  const beasts: Partial<Record<BeastId, BeastRealmProgress>> = {};
  for (const [beastId, value] of Object.entries(savedBeasts)) {
    if (!isBeastId(beastId) || typeof value !== "object" || value === null) continue;
    const entry = value as Record<string, unknown>;
    beasts[beastId] = { stageIndex: normalizeBeastStageIndex(entry.stageIndex), unlockSettled: entry.unlockSettled === true };
  }
  return { deployedBeastId: isBeastId(record.deployedBeastId) ? record.deployedBeastId : DEFAULT_BEAST_ID, beasts };
}

/** The beast's realm stage, never below its starting realm (older saves rise to it). */
export function getBeastStageIndex(progress: BeastProgress, beastId: BeastId): number {
  const beast = getBeastById(beastId);
  return Math.max(progress.beasts[beastId]?.stageIndex ?? 0, beast ? getBeastStartStageIndex(beast) : 0);
}

/**
 * Gives every newly unlocked beast its starting realm: its own starting realm,
 * or the first stage of the major realm the strongest beast has reached if higher (like swords inheriting
 * refinement), so switching to a new beast never throws progress away.
 * Returns the same object when nothing changed.
 */
export function settleBeastUnlocks(progress: BeastProgress, highestClearedTowerStage: number): BeastProgress {
  const pending = beastCatalog.filter(beast => isBeastUnlocked(beast, highestClearedTowerStage) && !progress.beasts[beast.beastId]?.unlockSettled);
  if (pending.length === 0) return progress;
  const highest = Math.max(0, ...Object.values(progress.beasts).map(entry => entry?.unlockSettled ? entry.stageIndex : 0));
  const inherited = getBeastRealmStartIndex(highest);
  const beasts = { ...progress.beasts };
  for (const beast of pending) {
    const current = beasts[beast.beastId]?.stageIndex ?? 0;
    beasts[beast.beastId] = { stageIndex: Math.max(current, inherited, getBeastStartStageIndex(beast)), unlockSettled: true };
  }
  return { ...progress, beasts };
}
