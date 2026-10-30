import { describe, expect, it } from "vitest";
import { beastCatalog } from "../../features/beast";
import { beastIncomeBonuses, GameSaveService } from "./GameSaveService";

describe("game save commands", () => {
  it("never refines or equips a sword the save has not unlocked", () => {
    const service = new GameSaveService();
    service.patchProgress({ spiritStones: 1_000_000 });
    // The second sword needs 築基 and floor 10; a new game is at 凝氣一層.
    expect(service.refineWeapon("weapon_02")).toEqual({ ok: false, reason: "locked" });
    service.setEquippedWeapon("weapon_02");
    expect(service.getSnapshot().save.equippedWeaponId).toBe("weapon_01");
    expect(service.refineWeapon("weapon_01")).toMatchObject({ ok: true });
  });

  it("refines and feeds in one go, as far as the currency goes", () => {
    const service = new GameSaveService();
    service.patchProgress({ spiritStones: 1_000 });
    const refined = service.refineWeaponMax("weapon_01");
    expect(refined.ok).toBe(true);
    expect(refined.levels).toBeGreaterThan(1);
    expect(service.getSnapshot().save.weapons.weapon_01.refinementLevel).toBe(refined.levels);
    expect(service.getSnapshot().save.spiritStones).toBe(1_000 - refined.cost!);
    expect(service.refineWeaponMax("weapon_02")).toEqual({ ok: false, reason: "locked" });
  });

  it("a fed beast's larger possession bonus counts toward income", () => {
    const save = new GameSaveService().getSnapshot().save;
    const starter = beastCatalog[0];
    const fed = { ...save, beasts: { ...save.beasts, beasts: { ...save.beasts.beasts, [starter.beastId]: { stageIndex: 20, unlockSettled: true } } } };
    expect(beastIncomeBonuses(fed)[starter.possession.stat]).toBeGreaterThan(beastIncomeBonuses(save)[starter.possession.stat]);
  });
});
