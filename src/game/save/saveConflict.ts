import { getRealmStage, realmConfigs } from "../../features/cultivation/domain/RealmCatalog";

/** The parts of a save that show how far a player has come. */
export interface SaveProgress {
  readonly cultivation: { readonly stageId: string };
  readonly tower: { readonly highestClearedStage: number };
  readonly spiritStones: number;
  readonly updatedAt: number;
}

/** A short, player-facing description of one side of a conflict. */
export interface SaveSummary {
  readonly realmNameZh: string;
  readonly towerCleared: number;
  readonly spiritStones: number;
  readonly updatedAt: number;
}

const stageIndex = (save: SaveProgress): number => realmConfigs.findIndex(stage => stage.stageId === save.cultivation.stageId);

/**
 * On sign-in the cloud save is the primary copy. Only when this device has
 * progress the cloud lacks (a higher realm stage or more tower clears, e.g.
 * uploads failed while offline) is the player asked instead of overwriting it.
 * Timestamps are not compared: the local save is re-stamped every second.
 */
export function chooseSaveOnSignIn(local: SaveProgress, cloud: SaveProgress): "cloud" | "ask" {
  const localAhead = stageIndex(local) > stageIndex(cloud) || local.tower.highestClearedStage > cloud.tower.highestClearedStage;
  return localAhead ? "ask" : "cloud";
}

export function summarizeSave(save: SaveProgress): SaveSummary {
  return {
    realmNameZh: getRealmStage(save.cultivation.stageId).displayNameZh,
    towerCleared: save.tower.highestClearedStage,
    spiritStones: save.spiritStones,
    updatedAt: save.updatedAt,
  };
}
