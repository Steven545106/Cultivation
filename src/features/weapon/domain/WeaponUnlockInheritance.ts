import { getInheritedRefinementLevel, normalizeRefinementLevel } from "../../refinement/domain/RefinementRules";
import { weaponCatalog } from "./WeaponCatalog";
import { isWeaponUnlocked, type WeaponUnlockContext } from "./WeaponUnlockRules";

export interface WeaponProgressState {
  readonly refinementLevel: number;
  /** True once this sword's unlock has granted its inherited starting refinement. */
  readonly unlockSettled: boolean;
}

/**
 * Settles every newly unlocked sword, in catalog order: it starts at the
 * inherited refinement of the highest sword so far, and never loses levels it
 * already has. Already-settled or still-locked swords are untouched. Returns
 * the same object when nothing changed.
 */
export function settleWeaponUnlocks<T extends WeaponProgressState>(
  weapons: Readonly<Record<string, T>>,
  context: WeaponUnlockContext,
  create: (refinementLevel: number) => T,
): Readonly<Record<string, T>> {
  let next: Record<string, T> | null = null;
  let highest = Math.max(0, ...weaponCatalog
    .map(weapon => weapons[weapon.weaponId])
    .filter(progress => progress?.unlockSettled)
    .map(progress => normalizeRefinementLevel(progress.refinementLevel)));
  for (const weapon of weaponCatalog) {
    const progress = weapons[weapon.weaponId];
    if (!progress || progress.unlockSettled || !isWeaponUnlocked(weapon, context)) continue;
    const refinementLevel = Math.max(normalizeRefinementLevel(progress.refinementLevel), getInheritedRefinementLevel(highest));
    next ??= { ...weapons };
    next[weapon.weaponId] = create(refinementLevel);
    highest = Math.max(highest, refinementLevel);
  }
  return next ?? weapons;
}
