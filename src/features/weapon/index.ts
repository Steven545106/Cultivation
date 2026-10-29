/** Public weapon boundary during the gradual migration. */
export {
  getDefaultWeapon,
  getWeaponById,
  isWeaponId,
  weaponAssetManifest,
  weaponCatalog,
  type WeaponId,
} from "./domain/WeaponCatalog";
export { createEquipmentState, normalizeEquipmentState, type EquipmentState } from "./domain/EquipmentState";
export {
  getFormulaUnlockRequirement,
  getWeaponUnlockStatus,
  isWeaponUnlocked,
  weaponUnlockRequirements,
  type WeaponUnlockContext,
  type WeaponUnlockRequirement,
  type WeaponUnlockStatus,
} from "./domain/WeaponUnlockRules";
export { settleWeaponUnlocks, type WeaponProgressState } from "./domain/WeaponUnlockInheritance";
export { EMPTY_WEAPON_COMBAT_EFFECT, getActiveWeaponEffects, type ActiveWeaponEffects } from "./domain/WeaponEffectRules";
export { weaponConfigById, weaponConfigs } from "../../game/weapons/weaponConfigs";
export type { AttackTimelineConfig, WeaponCombatEffect, WeaponConfig, WeaponEffectConfig } from "../../game/weapons/WeaponConfig";
