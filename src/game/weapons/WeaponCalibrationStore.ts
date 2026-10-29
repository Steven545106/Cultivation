import type { NormalizedPoint } from "./WeaponConfig";
import type { WeaponCalibrationOffsets } from "./WeaponCalibration";

/**
 * One sword's calibration: the live offsets plus optional grip / blade-start /
 * tip overrides (0–1 of its image). Overrides left out keep the sword's
 * default geometry (weaponGeometry.ts).
 */
export interface WeaponCalibration extends WeaponCalibrationOffsets {
  readonly gripPoint?: NormalizedPoint;
  readonly bladeStart?: NormalizedPoint;
  readonly tip?: NormalizedPoint;
}

export const DEFAULT_WEAPON_CALIBRATION: WeaponCalibration = Object.freeze({ scale: 1, offsetX: 0, offsetY: 0, rotation: 0 });

const STORAGE_KEY = "cultivation.weaponCalibration.v1";

type Saved = Record<string, WeaponCalibration>;

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function readPoint(value: unknown): NormalizedPoint | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { x, y } = value as Record<string, unknown>;
  return isNumber(x) && isNumber(y) ? { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) } : undefined;
}

/** Drops anything malformed, so a hand-edited or old entry can never break a sword. */
export function normalizeWeaponCalibration(value: unknown): WeaponCalibration {
  const raw = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const pick = (key: keyof WeaponCalibrationOffsets) => isNumber(raw[key]) ? raw[key] as number : DEFAULT_WEAPON_CALIBRATION[key];
  const gripPoint = readPoint(raw.gripPoint);
  const bladeStart = readPoint(raw.bladeStart);
  const tip = readPoint(raw.tip);
  return {
    scale: Math.min(3, Math.max(0.2, pick("scale"))),
    offsetX: pick("offsetX"),
    offsetY: pick("offsetY"),
    rotation: pick("rotation"),
    ...(gripPoint ? { gripPoint } : {}),
    ...(bladeStart ? { bladeStart } : {}),
    ...(tip ? { tip } : {}),
  };
}

function isDefault(calibration: WeaponCalibration): boolean {
  return calibration.scale === 1 && calibration.offsetX === 0 && calibration.offsetY === 0 && calibration.rotation === 0
    && !calibration.gripPoint && !calibration.bladeStart && !calibration.tip;
}

/**
 * Per-sword calibration, kept in this browser's localStorage (a developer
 * tool: never part of the game save or the cloud). Every sword can be reset
 * on its own, or all at once.
 */
export class WeaponCalibrationStore {
  private saved: Saved;
  private readonly listeners = new Set<() => void>();

  public constructor(private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = safeLocalStorage()) {
    this.saved = this.load();
  }

  public get(weaponId: string): WeaponCalibration {
    return this.saved[weaponId] ?? DEFAULT_WEAPON_CALIBRATION;
  }

  public isCustomized(weaponId: string): boolean {
    return weaponId in this.saved;
  }

  public getAll(): Readonly<Saved> {
    return this.saved;
  }

  public update(weaponId: string, change: Partial<WeaponCalibration>): void {
    const next = normalizeWeaponCalibration({ ...this.get(weaponId), ...change });
    const { [weaponId]: _previous, ...others } = this.saved;
    this.saved = isDefault(next) ? others : { ...others, [weaponId]: next };
    this.persist();
  }

  /** Back to the sword's defaults. */
  public reset(weaponId: string): void {
    if (!this.isCustomized(weaponId)) return;
    const { [weaponId]: _removed, ...others } = this.saved;
    this.saved = others;
    this.persist();
  }

  public resetAll(): void {
    this.saved = {};
    this.persist();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private load(): Saved {
    try {
      const parsed = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? "{}") as unknown;
      if (typeof parsed !== "object" || parsed === null) return {};
      return Object.fromEntries(Object.entries(parsed).map(([weaponId, value]) => [weaponId, normalizeWeaponCalibration(value)]));
    } catch {
      return {};
    }
  }

  private persist(): void {
    try {
      if (Object.keys(this.saved).length === 0) this.storage?.removeItem(STORAGE_KEY);
      else this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.saved));
    } catch {
      // Storage blocked: the calibration still applies for this session.
    }
    this.listeners.forEach(listener => listener());
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
