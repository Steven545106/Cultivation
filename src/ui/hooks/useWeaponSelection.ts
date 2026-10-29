import { useEffect, useState } from "react";
import type { GameRuntime } from "../../game/GameRuntime";
import type { FinalCombatStats } from "../../features/combat";
import { gameSaveCommands, type GameSaveSnapshot } from "../../features/persistence";
import { getRefinementBonuses, getRefinementCost } from "../../features/refinement";
import {
  getWeaponUnlockStatus,
  weaponCatalog,
  type ActiveWeaponEffects,
  type WeaponConfig,
  type WeaponUnlockContext,
} from "../../features/weapon";
import { getLoadoutCombatStats } from "./loadoutCombatStats";

export interface WeaponSelection {
  readonly weaponUnlockContext: WeaponUnlockContext;
  readonly selectedWeapon: WeaponConfig;
  /** What the Phaser loadout currently holds; follows the selection once a runtime exists. */
  readonly equippedWeapon: WeaponConfig;
  readonly activeWeaponEffects: ActiveWeaponEffects;
  readonly selectedRefinement: number;
  readonly nextRefinementCost: number | null;
  readonly refinementBonuses: ReturnType<typeof getRefinementBonuses>;
  readonly combatStats: FinalCombatStats;
  /** Selects and persists a sword; `equipNow` also swaps the live Phaser loadout immediately. */
  readonly selectWeapon: (weaponId: string, equipNow?: boolean) => void;
}

/**
 * Keeps the selected sword, the persisted equipment and the Phaser loadout in
 * sync, falling back to the first unlocked sword, and publishes combat stats
 * to the runtime.
 */
export function useWeaponSelection(gameSave: GameSaveSnapshot, runtime: GameRuntime | null): WeaponSelection {
  const [equippedWeapon, setEquippedWeapon] = useState<WeaponConfig>(weaponCatalog[0]);
  const [selectedWeaponId, setSelectedWeaponId] = useState(gameSave.save.equippedWeaponId);

  const weaponUnlockContext: WeaponUnlockContext = {
    realmStageId: gameSave.save.cultivation.stageId,
    highestClearedTowerStage: gameSave.save.tower.highestClearedStage,
  };
  const unlockedWeapons = weaponCatalog.filter(weapon => getWeaponUnlockStatus(weapon, weaponUnlockContext).unlocked);
  const effectiveSelectedWeaponId = unlockedWeapons.some(weapon => weapon.weaponId === selectedWeaponId)
    ? selectedWeaponId
    : unlockedWeapons[0].weaponId;

  useEffect(() => {
    if (!runtime) return undefined;
    runtime.weaponLoadout.equip(effectiveSelectedWeaponId);
    setEquippedWeapon(runtime.weaponLoadout.getEquipped());
    return runtime.weaponLoadout.subscribe(setEquippedWeapon);
  }, [runtime, effectiveSelectedWeaponId]);

  useEffect(() => {
    setSelectedWeaponId(gameSave.save.equippedWeaponId);
  }, [gameSave.save.equippedWeaponId]);

  useEffect(() => {
    if (selectedWeaponId === effectiveSelectedWeaponId) return;
    setSelectedWeaponId(effectiveSelectedWeaponId);
    gameSaveCommands.equipWeapon(effectiveSelectedWeaponId);
  }, [effectiveSelectedWeaponId, selectedWeaponId]);

  const selectedWeapon = weaponCatalog.find(weapon => weapon.weaponId === effectiveSelectedWeaponId) ?? weaponCatalog[0];
  const loadout = getLoadoutCombatStats(gameSave.save, selectedWeapon);
  const activeWeaponEffects = loadout.effects;
  const selectedRefinement = loadout.refinementLevel;
  const combatStats = loadout.stats;

  useEffect(() => {
    runtime?.setCombatStats(combatStats);
  }, [runtime, combatStats]);

  const selectWeapon = (weaponId: string, equipNow = false): void => {
    setSelectedWeaponId(weaponId);
    if (equipNow) runtime?.weaponLoadout.equip(weaponId);
    gameSaveCommands.equipWeapon(weaponId);
  };

  return {
    weaponUnlockContext,
    selectedWeapon,
    equippedWeapon,
    activeWeaponEffects,
    selectedRefinement,
    nextRefinementCost: getRefinementCost(selectedRefinement + 1),
    refinementBonuses: getRefinementBonuses(selectedRefinement),
    combatStats,
    selectWeapon,
  };
}
