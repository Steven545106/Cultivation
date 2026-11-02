import { DEFAULT_MOUNT_ID, getMount, isMountId, mountCatalog, MOUNT_MAX_LEVEL, type MountConfig, type MountId, type MountStat } from "./MountCatalog";

/** Mount progress, kept in the save's `otherProgress.mounts`. */
export interface MountProgress {
  readonly deployedMountId: MountId;
  /** Level of each mount the hero owns (1 = just obtained). */
  readonly levels: Readonly<Partial<Record<MountId, number>>>;
}

/** A mount is obtained once its art exists and its tower stage has been cleared. */
export function isMountUnlocked(mount: MountConfig, highestClearedStage: number): boolean {
  return mount.sprite !== null && highestClearedStage >= mount.unlockStage;
}

export function createMountProgress(): MountProgress {
  return { deployedMountId: DEFAULT_MOUNT_ID, levels: { [DEFAULT_MOUNT_ID]: 1 } };
}

const clampLevel = (value: unknown): number => {
  const level = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.min(MOUNT_MAX_LEVEL, Math.max(1, level));
};

/** Reads the progress out of `otherProgress`, mending anything missing or invalid; mounts obtained since start at level 1. */
export function readMountProgress(otherProgress: Readonly<Record<string, unknown>>, highestClearedStage: number): MountProgress {
  const raw = otherProgress.mounts;
  const record = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  const savedLevels = typeof record.levels === "object" && record.levels !== null ? record.levels as Record<string, unknown> : {};
  const levels: Partial<Record<MountId, number>> = {};
  for (const mount of mountCatalog) {
    if (isMountUnlocked(mount, highestClearedStage)) levels[mount.id] = clampLevel(savedLevels[mount.id]);
  }
  const deployed = isMountId(record.deployedMountId) && levels[record.deployedMountId] !== undefined ? record.deployedMountId : DEFAULT_MOUNT_ID;
  return { deployedMountId: deployed, levels };
}

export function getMountLevel(progress: MountProgress, id: MountId): number {
  return progress.levels[id] ?? 0;
}

/** The mount's bonus at a level (0 when not owned). */
export function getMountBonus(mount: MountConfig, level: number): number {
  return level <= 0 ? 0 : mount.baseBonus + mount.bonusPerLevel * (Math.min(MOUNT_MAX_LEVEL, level) - 1);
}

/** Spirit stones to raise a mount from `level` to the next one, or null at the top. */
export function getMountUpgradeCost(level: number): number | null {
  if (level >= MOUNT_MAX_LEVEL) return null;
  return Math.round(2000 * 1.35 ** (level - 1));
}

/** Only the deployed mount gives its bonus. */
export function getDeployedMountBonuses(progress: MountProgress): Readonly<Record<MountStat, number>> {
  const mount = getMount(progress.deployedMountId);
  const bonus = getMountBonus(mount, getMountLevel(progress, mount.id));
  return { cultivationSpeed: mount.stat === "cultivationSpeed" ? bonus : 0, spiritStoneSpeed: mount.stat === "spiritStoneSpeed" ? bonus : 0 };
}

export type MountUpgradeResult =
  | { readonly ok: true; readonly progress: MountProgress; readonly cost: number }
  | { readonly ok: false; readonly reason: "locked" | "max-level" | "insufficient-spirit-stones"; readonly cost?: number };

export function upgradeMount(progress: MountProgress, id: MountId, spiritStones: number): MountUpgradeResult {
  const level = getMountLevel(progress, id);
  if (level <= 0) return { ok: false, reason: "locked" };
  const cost = getMountUpgradeCost(level);
  if (cost === null) return { ok: false, reason: "max-level" };
  if (spiritStones < cost) return { ok: false, reason: "insufficient-spirit-stones", cost };
  return { ok: true, cost, progress: { ...progress, levels: { ...progress.levels, [id]: level + 1 } } };
}

export function deployMount(progress: MountProgress, id: MountId): MountProgress {
  return getMountLevel(progress, id) > 0 ? { ...progress, deployedMountId: id } : progress;
}
