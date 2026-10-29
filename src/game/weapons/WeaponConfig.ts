export type WeaponElement = "雷" | "星月" | "月" | "時空" | "星光" | "冰月" | "冰風" | "冰" | "木" | "冰花";

export type WeaponType = "重型大劍" | "彎刃劍" | "輕型長劍" | "星盤法劍" | "聖光長劍" | "細劍" | "羽紋仙劍" | "寒冰重劍" | "木靈花劍" | "寒花仙劍";

export interface NormalizedPoint { x: number; y: number; }
export interface WeaponSocketOffset { x: number; y: number; rotation: number; }
export interface WeaponHitboxConfig { shape: "blade-sweep"; thickness: number; }
export interface WeaponTrailConfig { color: number; width: number; alpha: number; }
export interface WeaponImpactConfig { color: number; knockback: number; hitStopMs: number; cameraShake: number; }
export interface WeaponSoundConfig { swingKey: string; impactKey: string; }

/** Additive modifiers applied after the base weapon/refinement calculation. */
export interface WeaponCombatEffect {
  readonly attackPercent: number;
  readonly critRateBonus: number;
  readonly attackSpeedBonus: number;
}

export interface WeaponEffectConfig {
  readonly nameZh: string;
  readonly descriptionZh: string;
  readonly combat: WeaponCombatEffect;
}

export interface AttackTimelineConfig {
  windupMs: number;
  swingMs: number;
  impactMs: number;
  recoveryMs: number;
  windupAngle: number;
  swingAngle: number;
  recoveryAngle: number;
  activeStart: number;
  activeEnd: number;
}

export interface WeaponConfig {
  weaponId: string;
  nameZh: string;
  element: WeaponElement;
  weaponType: WeaponType;
  assetPath: string;
  spriteKey: string;
  baseDamage: number;
  attackSpeed: number;
  /** Base critical probability in the 0–1 range. */
  baseCritRate: number;
  gripPoint: NormalizedPoint;
  socketOffset: WeaponSocketOffset;
  displayScale: number;
  rotationOffset: number;
  attackAnimation: string;
  attackTimeline: AttackTimelineConfig;
  bladeGeometry: { bladeStart: NormalizedPoint; tip: NormalizedPoint; };
  /** Curved blades are not represented well by the straight base→tip hit line (see weaponGeometry.ts). */
  bladeShape?: "straight" | "curved";
  hitboxConfig: WeaponHitboxConfig;
  trailConfig: WeaponTrailConfig;
  impactConfig: WeaponImpactConfig;
  soundConfig: WeaponSoundConfig;
  /** Applies while this sword has been unlocked, even if another sword is equipped. */
  possessionEffect: WeaponEffectConfig;
  /** Applies only while this exact sword is equipped. */
  equippedEffect: WeaponEffectConfig;
}
