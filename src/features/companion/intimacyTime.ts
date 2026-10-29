import { MAX_INTIMACY, normalizeIntimacy } from "./companionCatalog";

/** One intimacy point for every 10 minutes of actual dual cultivation. */
export const INTIMACY_POINT_MS = 10 * 60 * 1000;

/** Preserve time accumulated under the previous 30-minute rule. */
export function migrateIntimacyRemainder(points: unknown, oldRemainderMs: unknown) {
  const remainder = typeof oldRemainderMs === "number" && Number.isFinite(oldRemainderMs) ? Math.max(0, Math.min(30 * 60 * 1000 - 1, Math.floor(oldRemainderMs))) : 0;
  const next = Math.min(MAX_INTIMACY, normalizeIntimacy(points) + Math.floor(remainder / INTIMACY_POINT_MS));
  return { points: next, remainderMs: next === MAX_INTIMACY ? 0 : remainder % INTIMACY_POINT_MS };
}

export function settleIntimacy(points: unknown, remainderMs: number, from: number, now: number, active: boolean) {
  const current = normalizeIntimacy(points);
  const remainder = Number.isFinite(remainderMs) ? Math.max(0, Math.min(INTIMACY_POINT_MS - 1, Math.floor(remainderMs))) : 0;
  if (!Number.isFinite(now) || !Number.isFinite(from) || now <= from) return { points: current, remainderMs: remainder, timestamp: from };
  if (!active || current >= MAX_INTIMACY) return { points: current, remainderMs: active ? 0 : remainder, timestamp: now };
  const elapsed = now - from + remainder;
  const next = Math.min(MAX_INTIMACY, current + Math.floor(elapsed / INTIMACY_POINT_MS));
  return { points: next, remainderMs: next === MAX_INTIMACY ? 0 : elapsed % INTIMACY_POINT_MS, timestamp: now };
}
