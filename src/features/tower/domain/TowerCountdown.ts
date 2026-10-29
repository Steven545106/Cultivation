import type { TowerChallengeState } from "./TowerChallenge";

/** A timed-out attempt retries the same stage after this delay; it is not a terminal state. */
export const TOWER_RETRY_DELAY_MS = 5_000;
/** Pause between a first clear and auto-advancing to the next stage. */
export const TOWER_AUTO_ADVANCE_DELAY_MS = 650;

export interface TowerCountdown {
  readonly remainingSeconds: number;
  readonly remainingPercent: number;
  readonly retrySeconds: number;
  readonly retryPercent: number;
}

/** Display values for the challenge timer and the failed-attempt retry timer. */
export function getTowerCountdown(challenge: TowerChallengeState | null, now: number, retryAt: number | null): TowerCountdown {
  return {
    remainingSeconds: challenge
      ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000))
      : 0,
    remainingPercent: challenge
      ? Math.max(0, Math.min(100, (challenge.expiresAt - now) / (challenge.stage.timeLimitSeconds * 1000) * 100))
      : 0,
    retrySeconds: retryAt === null
      ? 0
      : Math.max(0, Math.ceil((retryAt - now) / 1000)),
    retryPercent: retryAt === null
      ? 0
      : Math.max(0, Math.min(100, (retryAt - now) / TOWER_RETRY_DELAY_MS * 100)),
  };
}
