import { getDefaultWeapon, getWeaponById, type WeaponId } from "./WeaponCatalog";

export interface EquipmentState {
  readonly equippedWeaponId: WeaponId;
}

export function createEquipmentState(equippedWeaponId = getDefaultWeapon().weaponId): EquipmentState {
  return { equippedWeaponId: (getWeaponById(equippedWeaponId) ?? getDefaultWeapon()).weaponId };
}

/** Ignores unknown legacy/imported IDs rather than leaving the player without a weapon. */
export function normalizeEquipmentState(candidate: unknown): EquipmentState {
  const weaponId = typeof candidate === "object" && candidate !== null && "equippedWeaponId" in candidate
    ? (candidate as { equippedWeaponId?: unknown }).equippedWeaponId
    : candidate;
  return createEquipmentState(typeof weaponId === "string" ? weaponId : undefined);
}
