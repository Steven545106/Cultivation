import type { RealmId, RealmStageConfig } from "./RealmCatalog";

/**
 * Major-breakthrough risk. Success odds fall as realms rise; each consecutive
 * failure adds pity, and the fifth attempt in a row always succeeds. A failure
 * costs a share of the stage requirement, never a realm.
 */
export const breakthroughConfig = {
  /** Base success chance, keyed by the realm being broken into. */
  baseSuccessRateByTargetRealm: {
    qi: 1,
    foundation: 0.95,
    core: 0.9,
    nascentSoul: 0.85,
    celestial: 0.8,
    demigod: 0.75,
    venerable: 0.7,
    archaic: 0.65,
    sovereign: 0.6,
    eternal: 0.55,
  } satisfies Readonly<Record<RealmId, number>>,
  pityPerFailure: 0.1,
  /** After this many failures in a row, the next attempt is guaranteed. */
  guaranteedAfterFailures: 4,
  /** Share of the stage's cultivation requirement lost on failure. */
  failureCultivationLossRate: 0.1,
} as const;

/** Outside help on a major breakthrough, e.g. a dao companion's (道侶) dual-cultivation effect. */
export interface BreakthroughModifiers {
  /** Added to the success chance (0.08 = 8 percentage points). */
  readonly successBonus?: number;
  /** A failure costs no cultivation; it still counts for pity. */
  readonly protectFailure?: boolean;
}

export function getBreakthroughSuccessRate(targetRealmId: RealmId, consecutiveFailures: number, successBonus = 0): number {
  const failures = Math.max(0, Math.floor(consecutiveFailures));
  if (failures >= breakthroughConfig.guaranteedAfterFailures) return 1;
  return Math.min(1, breakthroughConfig.baseSuccessRateByTargetRealm[targetRealmId] + failures * breakthroughConfig.pityPerFailure + Math.max(0, successBonus));
}

export function getBreakthroughFailureLoss(stage: RealmStageConfig): number {
  return Math.floor((stage.cultivationRequired ?? 0) * breakthroughConfig.failureCultivationLossRate);
}
