import { useEffect } from "react";
import { createPortal } from "react-dom";

/** One major-breakthrough roll, as the player should see it. */
export type BreakthroughOutcome =
  | { readonly ok: true; readonly realmNameZh: string; readonly stageNameZh: string }
  | { readonly ok: false; readonly lostText: string; readonly nextRateText: string | null };

/** Seconds the effect stays up unless the player taps it away. */
const SHOW_MS = { success: 3_600, failure: 3_000 } as const;

/**
 * Full-screen breakthrough moment. Success: heavenly light bursts from the
 * centre, rays turn, a ring of qi expands, and the new realm's name rises in
 * gold. Failure: a dark shockwave cracks outward and the text shakes, then
 * names the loss and the raised odds for next time. Tap or wait to close.
 */
export function BreakthroughEffect({ outcome, onDone }: { readonly outcome: BreakthroughOutcome; readonly onDone: () => void }): JSX.Element {
  useEffect(() => {
    const timer = window.setTimeout(onDone, outcome.ok ? SHOW_MS.success : SHOW_MS.failure);
    return () => window.clearTimeout(timer);
  }, [outcome, onDone]);
  return createPortal(
    <div
      className={outcome.ok ? "breakthrough-effect is-success" : "breakthrough-effect is-failure"}
      role="alert"
      onClick={onDone}
    >
      <div className="breakthrough-effect__burst" aria-hidden="true">
        <span className="breakthrough-effect__rays" />
        <span className="breakthrough-effect__ring" />
        <span className="breakthrough-effect__ring breakthrough-effect__ring--late" />
        <span className="breakthrough-effect__core" />
      </div>
      <div className="breakthrough-effect__text">
        {outcome.ok ? (
          <>
            <strong>突破成功</strong>
            <span className="breakthrough-effect__realm">{outcome.realmNameZh}</span>
            <small>踏入{outcome.stageNameZh}</small>
          </>
        ) : (
          <>
            <strong>突破失敗</strong>
            <small>{outcome.lostText}</small>
            {outcome.nextRateText && <small>{outcome.nextRateText}</small>}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
