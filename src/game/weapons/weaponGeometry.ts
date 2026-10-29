import type { NormalizedPoint } from "./WeaponConfig";

/**
 * Where each sword is held and where its blade runs, in its own image
 * (0–1 of width/height). Every sword starts from the values all ten shared
 * before they could be set one by one, so nothing changes until a sword is
 * calibrated (WeaponCalibrationStore) or its entry here is edited.
 *
 * `bladeShape` flags blades a straight base→tip line cannot represent: the
 * curved 星穹弦月刃 strays ~28 world px from that line, about twice its hit
 * half-thickness. Its hit test is still the straight line for now (see
 * docs/rig-v1-quality.md); the flag marks where a curved hit shape is needed.
 */
export interface WeaponGeometry {
  readonly gripPoint: NormalizedPoint;
  readonly bladeGeometry: { readonly bladeStart: NormalizedPoint; readonly tip: NormalizedPoint };
  readonly bladeShape: "straight" | "curved";
}

const legacy = (bladeShape: WeaponGeometry["bladeShape"] = "straight"): WeaponGeometry => ({
  gripPoint: { x: 0.5, y: 0.18 },
  bladeGeometry: { bladeStart: { x: 0.5, y: 0.27 }, tip: { x: 0.5, y: 0.91 } },
  bladeShape,
});

export const defaultWeaponGeometry: Readonly<Record<string, WeaponGeometry>> = {
  weapon_01: legacy(),
  weapon_02: legacy("curved"),
  weapon_03: legacy(),
  weapon_04: legacy(),
  weapon_05: legacy(),
  weapon_06: legacy(),
  weapon_07: legacy(),
  weapon_08: legacy(),
  weapon_09: legacy(),
  weapon_10: legacy(),
};
