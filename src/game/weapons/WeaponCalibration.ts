import type { NormalizedPoint, WeaponConfig } from "./WeaponConfig";

export interface WeaponCalibrationOffsets {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly rotation: number;
}

/** Optional per-sword overrides of where it is held and where its blade runs (0–1 of its image). */
export interface WeaponGeometryOverrides {
  readonly gripPoint?: NormalizedPoint;
  readonly bladeStart?: NormalizedPoint;
  readonly tip?: NormalizedPoint;
}

/** Applies the scene's display scale and the sword's calibration (offsets and geometry overrides) to a weapon config copy. */
export function applyWeaponCalibration(weapon: WeaponConfig, calibration: WeaponCalibrationOffsets & WeaponGeometryOverrides, sceneScale: number): WeaponConfig {
  return {
    ...weapon,
    gripPoint: calibration.gripPoint ?? weapon.gripPoint,
    bladeGeometry: {
      bladeStart: calibration.bladeStart ?? weapon.bladeGeometry.bladeStart,
      tip: calibration.tip ?? weapon.bladeGeometry.tip,
    },
    displayScale: weapon.displayScale * sceneScale * calibration.scale,
    socketOffset: {
      ...weapon.socketOffset,
      x: weapon.socketOffset.x + calibration.offsetX,
      y: weapon.socketOffset.y + calibration.offsetY,
      rotation: weapon.socketOffset.rotation + calibration.rotation,
    },
  };
}
