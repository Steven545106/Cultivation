import { useEffect, useState } from "react";
import { getTowerCountdown, type TowerChallengeState } from "../../features/tower";

interface TowerCountdownBarProps {
  readonly challenge: TowerChallengeState;
  readonly retryAt: number | null;
  /** The battle clock the challenge runs on (game time); retries use real time. */
  readonly battleNow: () => number;
}

/**
 * Owns the 250ms countdown tick so only this bar re-renders, not the whole
 * battle page and weapon grid.
 */
export function TowerCountdownBar({ challenge, retryAt, battleNow }: TowerCountdownBarProps): JSX.Element {
  const [, setTick] = useState(0);
  const ticking = challenge.status === "active" || challenge.status === "failed";

  useEffect(() => {
    if (!ticking) return undefined;
    const timer = window.setInterval(() => setTick(tick => tick + 1), 250);
    return () => window.clearInterval(timer);
  }, [challenge.startedAt, ticking]);

  const remaining = getTowerCountdown(challenge, battleNow(), null);
  const countdown = { ...getTowerCountdown(challenge, Date.now(), retryAt), remainingSeconds: remaining.remainingSeconds, remainingPercent: remaining.remainingPercent };
  return challenge.status === "failed" ? (
    <div className="tower-countdown tower-countdown--retry" aria-label={`挑戰失敗，${countdown.retrySeconds} 秒後重新挑戰`}>
      <span>挑戰失敗　{countdown.retrySeconds} 秒後重新挑戰</span>
      <div className="tower-countdown__track" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={countdown.retrySeconds}>
        <b style={{ width: `${countdown.retryPercent}%` }} />
      </div>
    </div>
  ) : (
    <div className="tower-countdown" aria-label={`挑戰剩餘 ${countdown.remainingSeconds} 秒`}>
      <span>挑戰倒數　{countdown.remainingSeconds} 秒</span>
      <div className="tower-countdown__track" role="progressbar" aria-valuemin={0} aria-valuemax={challenge.stage.timeLimitSeconds} aria-valuenow={countdown.remainingSeconds}>
        <b style={{ width: `${countdown.remainingPercent}%` }} />
      </div>
    </div>
  );
}
