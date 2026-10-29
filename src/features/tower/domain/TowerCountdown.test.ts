import { describe, expect, it } from "vitest";
import { createTowerProgress } from "./TowerState";
import { startTowerChallenge } from "./TowerChallenge";
import { getTowerCountdown, TOWER_RETRY_DELAY_MS } from "./TowerCountdown";

const startedAt = 1_000_000;
const challenge = startTowerChallenge(createTowerProgress(), 1, startedAt);
const limitMs = challenge.stage.timeLimitSeconds * 1000;

describe("tower countdown", () => {
  it("is all zero without a challenge or retry", () => {
    expect(getTowerCountdown(null, startedAt, null)).toEqual({ remainingSeconds: 0, remainingPercent: 0, retrySeconds: 0, retryPercent: 0 });
  });

  it("rounds remaining seconds up and reports the remaining share", () => {
    const countdown = getTowerCountdown(challenge, startedAt + limitMs / 2 + 100, null);
    expect(countdown.remainingSeconds).toBe(Math.ceil((limitMs / 2 - 100) / 1000));
    expect(countdown.remainingPercent).toBeCloseTo((limitMs / 2 - 100) / limitMs * 100);
  });

  it("clamps after expiry", () => {
    expect(getTowerCountdown(challenge, startedAt + limitMs + 5_000, null)).toMatchObject({ remainingSeconds: 0, remainingPercent: 0 });
  });

  it("counts down the retry delay", () => {
    const now = 2_000_000;
    expect(getTowerCountdown(challenge, now, now + TOWER_RETRY_DELAY_MS)).toMatchObject({ retrySeconds: 5, retryPercent: 100 });
    expect(getTowerCountdown(challenge, now + 2_500, now + TOWER_RETRY_DELAY_MS)).toMatchObject({ retrySeconds: 3, retryPercent: 50 });
  });
});
