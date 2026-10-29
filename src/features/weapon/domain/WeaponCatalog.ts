import type { WeaponConfig } from "../../../game/weapons/WeaponConfig";
import { weaponConfigById, weaponConfigs } from "../../../game/weapons/weaponConfigs";

export type WeaponId = WeaponConfig["weaponId"];

/** Read-only catalog facade. All presentation and application code reads weapon data here. */
export const weaponCatalog: readonly WeaponConfig[] = weaponConfigs;

/** Derived from config, preventing a second hand-maintained asset manifest. */
export const weaponAssetManifest: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(weaponCatalog.map(weapon => [weapon.spriteKey, weapon.assetPath])),
);

export function getWeaponById(weaponId: string): WeaponConfig | null {
  return weaponConfigById.get(weaponId) ?? null;
}

export function isWeaponId(weaponId: string): weaponId is WeaponId {
  return weaponConfigById.has(weaponId);
}

export function getDefaultWeapon(): WeaponConfig {
  return weaponCatalog[0];
}
