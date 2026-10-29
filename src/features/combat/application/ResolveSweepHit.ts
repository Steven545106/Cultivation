import type { AttackTimelineConfig } from "../../weapon";
import { isInActiveWindow } from "../domain/AttackPlan";
import { sweptBladeHitsCircle, type BladeSegment, type Point } from "../domain/SweepGeometry";

export interface SweepHitQuery {
  /** True once this attack has already landed; each attack hits a target at most once. */
  readonly alreadyHit: boolean;
  readonly targetAlive: boolean;
  /** The attack's damage window (an AttackPlan or a weapon timeline). */
  readonly timeline: Pick<AttackTimelineConfig, "activeStart" | "activeEnd">;
  /** Swing tween progress in the 0–1 range. */
  readonly progress: number;
  readonly previous: BladeSegment;
  readonly current: BladeSegment;
  readonly targetCentre: Point;
  readonly hitRadius: number;
}

/** One swing sample: lands only inside the active window, on a live target, once per attack. */
export function resolveSweepHit(query: SweepHitQuery): boolean {
  return !query.alreadyHit
    && query.targetAlive
    && isInActiveWindow(query.timeline, query.progress)
    && sweptBladeHitsCircle(query.previous, query.current, query.targetCentre, query.hitRadius);
}
