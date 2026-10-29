import { useSyncExternalStore } from "react";
import { gameSaveStore, type GameSaveSnapshot } from "../../features/persistence";

export function useGameSave(): GameSaveSnapshot {
  return useSyncExternalStore(gameSaveStore.subscribe, gameSaveStore.getSnapshot, gameSaveStore.getSnapshot);
}
