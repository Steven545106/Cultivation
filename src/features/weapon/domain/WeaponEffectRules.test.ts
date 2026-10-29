import { describe, expect, it } from "vitest";
import { weaponCatalog } from "./WeaponCatalog";
import { getActiveWeaponEffects } from "./WeaponEffectRules";

describe("weapon possession and equipped effects", () => {
  it("keeps possession effects from every unlocked sword and adds only the equipped effect", () => {
    const [thunder, starMoon] = weaponCatalog;
    const effects = getActiveWeaponEffects([thunder, starMoon], starMoon);
    expect(effects.possession).toMatchObject({ attackPercent: 0.005, critRateBonus: 0.0075, attackSpeedBonus: 0 });
    expect(effects.equipped).toMatchObject({ attackPercent: 0, critRateBonus: 0, attackSpeedBonus: 0.1 });
    expect(effects.total).toMatchObject({ attackPercent: 0.005, critRateBonus: 0.0075, attackSpeedBonus: 0.1 });
  });

  it("gives every sword a stronger possession effect than the one before it", () => {
    const strength = weaponCatalog.map(weapon => {
      const { attackPercent, critRateBonus, attackSpeedBonus } = weapon.possessionEffect.combat;
      return attackPercent + critRateBonus + attackSpeedBonus;
    });
    for (let index = 1; index < strength.length; index += 1) {
      expect(strength[index], weaponCatalog[index].nameZh).toBeGreaterThan(strength[index - 1]);
    }
  });
});
