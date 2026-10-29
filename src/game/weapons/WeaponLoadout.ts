import type { WeaponConfig } from "./WeaponConfig";
import { getDefaultWeapon, getWeaponById } from "../../features/weapon/domain/WeaponCatalog";

type WeaponChangeListener = (weapon: WeaponConfig) => void;

/** Owns the one-and-only weapon equipped by Bai Xiaochun. */
export class WeaponLoadout {
  private equippedWeapon = getDefaultWeapon();
  private readonly listeners = new Set<WeaponChangeListener>();

  public getEquipped(): WeaponConfig {
    return this.equippedWeapon;
  }

  public equip(weaponId: string): boolean {
    const nextWeapon = getWeaponById(weaponId);
    if (!nextWeapon || nextWeapon.weaponId === this.equippedWeapon.weaponId) return false;
    this.equippedWeapon = nextWeapon;
    this.listeners.forEach(listener => listener(nextWeapon));
    return true;
  }

  public subscribe(listener: WeaponChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
