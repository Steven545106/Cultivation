import { gameSaveService } from "../../../game/save/GameSaveService";
import type { MountId } from "../domain/MountCatalog";
import { deployMount, readMountProgress, upgradeMount, type MountProgress, type MountUpgradeResult } from "../domain/MountRules";

/** Mount progress lives in the save's free-form `otherProgress`, so the save schema does not change. */
const write = (progress: MountProgress, spiritStones?: number): void => {
  const save = gameSaveService.getSnapshot().save;
  gameSaveService.patchProgress({ otherProgress: { ...save.otherProgress, mounts: progress }, ...(spiritStones === undefined ? {} : { spiritStones }) });
};

export const mountCommands = {
  deploy: (id: MountId): void => {
    const save = gameSaveService.getSnapshot().save;
    const current = readMountProgress(save.otherProgress);
    const next = deployMount(current, id);
    if (next !== current) write(next);
  },
  upgrade: (id: MountId): MountUpgradeResult => {
    const save = gameSaveService.getSnapshot().save;
    const result = upgradeMount(readMountProgress(save.otherProgress), id, save.spiritStones);
    if (result.ok) write(result.progress, save.spiritStones - result.cost);
    return result;
  },
};
