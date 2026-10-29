import { describe, expect, it } from "vitest";
import { weaponConfigs } from "./weaponConfigs";
import { applyWeaponCalibration } from "./WeaponCalibration";
import { DEFAULT_WEAPON_CALIBRATION, WeaponCalibrationStore } from "./WeaponCalibrationStore";
import { defaultWeaponGeometry } from "./weaponGeometry";

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: key => void data.delete(key) };
}

describe("per-sword geometry", () => {
  it("gives every sword its own entry, seeded with the grip and blade all ten shared before", () => {
    for (const weapon of weaponConfigs) {
      expect(defaultWeaponGeometry[weapon.weaponId], weapon.weaponId).toBeDefined();
      expect(weapon.gripPoint).toEqual({ x: 0.5, y: 0.18 });
      expect(weapon.bladeGeometry).toEqual({ bladeStart: { x: 0.5, y: 0.27 }, tip: { x: 0.5, y: 0.91 } });
    }
    // Only the curved 星穹弦月刃 is flagged: its blade strays from the straight hit line.
    expect(weaponConfigs.filter(weapon => weapon.bladeShape === "curved").map(weapon => weapon.weaponId)).toEqual(["weapon_02"]);
  });
});

describe("weapon calibration store", () => {
  it("keeps each sword's calibration apart and survives a reload", () => {
    const storage = memoryStorage();
    const store = new WeaponCalibrationStore(storage);
    store.update("weapon_01", { offsetX: 6, tip: { x: 0.5, y: 0.97 } });
    expect(store.get("weapon_01")).toMatchObject({ offsetX: 6, tip: { x: 0.5, y: 0.97 } });
    expect(store.get("weapon_02")).toEqual(DEFAULT_WEAPON_CALIBRATION);
    const reloaded = new WeaponCalibrationStore(storage);
    expect(reloaded.get("weapon_01")).toMatchObject({ offsetX: 6, tip: { x: 0.5, y: 0.97 } });
    expect(reloaded.isCustomized("weapon_01")).toBe(true);
  });

  it("resets one sword or all of them to the defaults", () => {
    const storage = memoryStorage();
    const store = new WeaponCalibrationStore(storage);
    store.update("weapon_01", { rotation: 4 });
    store.update("weapon_03", { scale: 1.2 });
    store.reset("weapon_01");
    expect(store.get("weapon_01")).toEqual(DEFAULT_WEAPON_CALIBRATION);
    expect(store.isCustomized("weapon_03")).toBe(true);
    store.resetAll();
    expect(store.getAll()).toEqual({});
    expect(storage.data.size).toBe(0);
  });

  it("ignores malformed saved data and clamps points into the image", () => {
    const storage = memoryStorage();
    storage.setItem("cultivation.weaponCalibration.v1", JSON.stringify({ weapon_01: { scale: "big", gripPoint: { x: 2, y: -1 } } }));
    expect(new WeaponCalibrationStore(storage).get("weapon_01")).toEqual({ ...DEFAULT_WEAPON_CALIBRATION, gripPoint: { x: 1, y: 0 } });
    storage.setItem("cultivation.weaponCalibration.v1", "not json");
    expect(new WeaponCalibrationStore(storage).getAll()).toEqual({});
  });

  it("applies grip and blade overrides, and leaves a default sword exactly as configured", () => {
    const weapon = weaponConfigs[0];
    expect(applyWeaponCalibration(weapon, DEFAULT_WEAPON_CALIBRATION, 1)).toEqual(weapon);
    const calibrated = applyWeaponCalibration(weapon, { ...DEFAULT_WEAPON_CALIBRATION, gripPoint: { x: 0.48, y: 0.2 }, tip: { x: 0.5, y: 0.98 } }, 1);
    expect(calibrated.gripPoint).toEqual({ x: 0.48, y: 0.2 });
    expect(calibrated.bladeGeometry).toEqual({ bladeStart: weapon.bladeGeometry.bladeStart, tip: { x: 0.5, y: 0.98 } });
  });
});
