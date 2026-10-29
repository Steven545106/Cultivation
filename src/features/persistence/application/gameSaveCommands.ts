import { gameSaveService } from "../../../game/save/GameSaveService";
import { resetLocalProgress } from "../../../game/save/progressReset";

/**
 * Application commands are the only write API exposed to React during the
 * migration. They preserve the existing service implementation and save schema.
 */
export const gameSaveCommands = {
  initialize: (): void => gameSaveService.initialize(),
  renameCharacter: (name: string): boolean => gameSaveService.renameCharacter(name),
  selectCompanion: (id: string | null): boolean => gameSaveService.selectCompanion(id),
  craftPill: (id: import("../../alchemy/Alchemy").PillId, count: 1 | 10 = 1) => gameSaveService.craftPill(id, count),
  consumeAlchemyPill: (id: import("../../alchemy/Alchemy").PillId, quality: number): boolean => gameSaveService.consumeAlchemyPill(id, quality),
  discardAlchemyPill: (id: import("../../alchemy/Alchemy").PillId, quality: number, count: number): boolean => gameSaveService.discardAlchemyPill(id, quality, count),
  equipWeapon: (weaponId: string): void => gameSaveService.setEquippedWeapon(weaponId),
  setWeaponRefinement: (weaponId: string, level: number): void => gameSaveService.setWeaponRefinement(weaponId, level),
  refineWeapon: (weaponId: string) => gameSaveService.refineWeapon(weaponId),
  refineWeaponMax: (weaponId: string) => gameSaveService.refineWeaponMax(weaponId),
  deployBeast: (beastId: string): void => gameSaveService.deployBeast(beastId),
  feedBeast: (beastId: string) => gameSaveService.feedBeast(beastId),
  feedBeastMax: (beastId: string) => gameSaveService.feedBeastMax(beastId),
  setTowerProgress: (tower: import("../../tower").TowerProgress): void => gameSaveService.setTowerProgress(tower),
  completeTowerStage: (stageNumber: number) => gameSaveService.completeTowerStage(stageNumber),
  signInWithGoogle: (): Promise<void> => gameSaveService.signInWithGoogle(),
  signOut: (): Promise<void> => gameSaveService.signOut(),
  exportJson: (): string => gameSaveService.exportJson(),
  importJson: (raw: string) => gameSaveService.importJson(raw),
  saveBeforeShutdown: (): Promise<void> => gameSaveService.saveBeforeShutdown(),
  resumeAfterShutdownFailure: (): void => gameSaveService.resumeAfterShutdownFailure(),
  /** Deletes this browser's local progress and reloads into a new game. Cloud saves are untouched. */
  resetLocalProgress: (): void => resetLocalProgress(),
};

/** Read-only observable store exposed to presentation code. */
export const gameSaveStore = gameSaveService;
