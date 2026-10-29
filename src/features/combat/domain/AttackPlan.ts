import type { AttackTimelineConfig } from "../../weapon";
import type { FinalCombatStats } from "./CombatStats";
import type { ComboMove, ComboMoveId } from "./ComboMoves";

/** "sweep" is the shared greatsword arc; "thrust" is the moonlight sword's short forward stab. */
export type AttackStyle = "sweep" | "thrust";

/** Renderer-neutral easing names, sampled by `samplePhaseAngle`. */
export type AttackEase = "sineOut" | "sineInOut" | "quadIn" | "quadInOut" | "cubicIn";

export interface AttackPhase {
  readonly fromAngle: number;
  readonly toAngle: number;
  /**
   * Optional overshoot: the blade first carries on to this angle (over the
   * first `followShare` of the phase), then eases back to `toAngle`.
   */
  readonly followAngle?: number;
  readonly followShare?: number;
  /** Duration at 1× dev playback; divide by the calibration playback rate read when the phase starts. */
  readonly baseDurationMs: number;
  readonly ease: AttackEase;
  /** Body shift applied as the phase starts; null keeps the current pose. */
  readonly bodyWeight: number | null;
}

export interface AttackPlan {
  readonly style: AttackStyle;
  /** Body clip to play: the combo move, or the style's basic move without a combo. */
  readonly clip: ComboMoveId;
  /** Swing progress range that can damage; re-derived per move so it covers the same blade angles. */
  readonly activeStart: number;
  readonly activeEnd: number;
  readonly damageMultiplier: number;
  readonly finisher: boolean;
  /** Blade angle sampled before the windup starts; becomes the first trail point. */
  readonly initialAngle: number;
  readonly windup: AttackPhase;
  readonly swing: AttackPhase;
  readonly recovery: AttackPhase;
  readonly restAngle: number;
  /** Pause after recovery at 1× dev playback, so one full cycle lasts 1000 / attack speed ms. */
  readonly baseCooldownMs: number;
}

const THRUST_WEAPON_IDS: ReadonlySet<string> = new Set(["weapon_03"]);
/** Degrees the blade carries past the end of the swing before returning. */
const SWEEP_FOLLOW_THROUGH = 18;
const THRUST_FOLLOW_THROUGH = 5;
const FOLLOW_SHARE = 0.35;
const MIN_COOLDOWN_MS = 70;
const MIN_PLAYBACK_RATE = 0.1;
/** Radius of the procedural test monster's body used by the blade sweep test. */
export const MONSTER_HIT_RADIUS = 72;

export interface AttackPlanWeapon {
  readonly weaponId: string;
  readonly attackSpeed: number;
  readonly socketOffset: { readonly rotation: number };
  readonly attackTimeline: AttackTimelineConfig;
}

export interface AttackCycleTiming {
  /** Total milliseconds per attack: 1000 / final attack speed. */
  readonly cycleMs: number;
  /** ≥ 1; speeds the windup/swing/recovery up only when they would not fit in the cycle. */
  readonly animationRate: number;
  readonly cooldownMs: number;
}

/**
 * Locks the real attack cadence to the displayed attack speed:
 * rate = max(1, animation / (cycle − 70)), cooldown = cycle − animation / rate.
 */
export function getAttackCycleTiming(timeline: AttackTimelineConfig, finalAttackSpeed: number): AttackCycleTiming {
  const cycleMs = 1000 / Math.max(0.01, finalAttackSpeed);
  const animationMs = timeline.windupMs + timeline.swingMs + timeline.recoveryMs;
  const animationRate = Math.max(1, animationMs / Math.max(1, cycleMs - MIN_COOLDOWN_MS));
  return { cycleMs, animationRate, cooldownMs: Math.max(MIN_COOLDOWN_MS, cycleMs - animationMs / animationRate) };
}

export function getAttackStyle(weaponId: string): AttackStyle {
  return THRUST_WEAPON_IDS.has(weaponId) ? "thrust" : "sweep";
}

/**
 * `finalAttackSpeed` is the refined/effect-boosted speed; it defaults to the sword's base speed.
 * Without a combo `move` this is the sword's basic attack.
 */
export function createAttackPlan(weapon: AttackPlanWeapon, finalAttackSpeed = weapon.attackSpeed, move?: ComboMove): AttackPlan {
  const style = getAttackStyle(weapon.weaponId);
  const timeline = weapon.attackTimeline;
  const timing = getAttackCycleTiming(timeline, finalAttackSpeed);
  const rest = weapon.socketOffset.rotation;
  const windupAngle = rest + timeline.windupAngle;
  const swingAngle = rest + timeline.swingAngle;
  const isThrust = style === "thrust";
  const baseEase: AttackEase = isThrust ? "quadIn" : "quadInOut";
  const direction = Math.sign(timeline.swingAngle - timeline.windupAngle) || 1;

  const isThrustMove = move ? move.id.startsWith("thrust") : isThrust;
  const ease: AttackEase = move ? (isThrustMove ? "quadIn" : "quadInOut") : baseEase;
  let from = windupAngle;
  let to = swingAngle;
  if (move?.direction === "forward") {
    from = windupAngle - direction * move.extendStart;
    to = swingAngle + direction * move.extendEnd;
  } else if (move?.direction === "reverse") {
    from = swingAngle + direction * move.extendStart;
    to = windupAngle - direction * move.extendEnd;
  }
  // A spin winds up to the same blade angle but sweeps one extra full turn first.
  const windupTarget = from;
  if (move?.spin) from -= (Math.sign(to - from) || 1) * 360;
  const active = move
    ? remapActiveWindow(timeline, windupAngle, swingAngle, baseEase, from, to, ease)
    : { start: timeline.activeStart, end: timeline.activeEnd };

  // Phase shares are renormalised so every move keeps the base animation length (and so the cadence).
  const share = move?.timeShare ?? { windup: 1, swing: 1, recovery: 1 };
  const total = timeline.windupMs + timeline.swingMs + timeline.recoveryMs;
  const weighted = timeline.windupMs * share.windup + timeline.swingMs * share.swing + timeline.recoveryMs * share.recovery;
  const ms = (duration: number, factor: number) => duration * factor * (total / weighted) / timing.animationRate;

  // Follow through in the direction of the swing, then return all the way to
  // rest within the recovery, so no frame ever snaps the blade.
  const moveDirection = Math.sign(to - from) || 1;
  const followAngle = to + moveDirection * (isThrustMove ? THRUST_FOLLOW_THROUGH : SWEEP_FOLLOW_THROUGH);
  return {
    style,
    clip: move?.id ?? (isThrust ? "thrust" : "cleave"),
    activeStart: active.start,
    activeEnd: active.end,
    damageMultiplier: move?.damageMultiplier ?? 1,
    finisher: move?.finisher ?? false,
    initialAngle: rest,
    // sineInOut keeps the blade rising until the swing takes over, instead of
    // reaching the apex early and freezing there.
    windup: { fromAngle: rest, toAngle: windupTarget, baseDurationMs: ms(timeline.windupMs, share.windup), ease: "sineInOut", bodyWeight: isThrustMove ? -0.28 : -0.7 },
    // quadInOut: the arc is visible through the middle of the cut, not crammed into its last frames.
    swing: { fromAngle: from, toAngle: to, baseDurationMs: ms(timeline.swingMs, share.swing), ease, bodyWeight: isThrustMove ? 1.35 : 0.8 },
    recovery: { fromAngle: to, toAngle: rest, followAngle, followShare: FOLLOW_SHARE, baseDurationMs: ms(timeline.recoveryMs, share.recovery), ease: "sineInOut", bodyWeight: null },
    restAngle: rest,
    baseCooldownMs: timing.cooldownMs,
  };
}

/** Progress at which an eased 0..1 curve reaches `value` (the curves are monotonic). */
function invertEase(name: AttackEase, value: number): number {
  const target = Math.min(1, Math.max(0, value));
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (easeAttack(name, mid) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** The move's progress range in which the blade crosses the angles the base active window covers. */
function remapActiveWindow(timeline: AttackTimelineConfig, baseFrom: number, baseTo: number, baseEase: AttackEase, from: number, to: number, ease: AttackEase): { start: number; end: number } {
  const angleAt = (progress: number) => baseFrom + (baseTo - baseFrom) * easeAttack(baseEase, progress);
  const progressAt = (angle: number) => (to === from ? 0 : invertEase(ease, (angle - from) / (to - from)));
  const a = progressAt(angleAt(timeline.activeStart));
  const b = progressAt(angleAt(timeline.activeEnd));
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** Final attack speed used for timing; before React publishes stats, the sword's base speed. */
export function getFinalAttackSpeed(weaponAttackSpeed: number, stats: FinalCombatStats | null): number {
  return stats && stats.attackSpeed > 0 ? stats.attackSpeed : weaponAttackSpeed;
}

/** Dev-tool slow motion only; real cadence comes from the attack plan's cycle timing. */
export function getAttackPlaybackRate(calibrationRate: number): number {
  return Math.max(MIN_PLAYBACK_RATE, calibrationRate);
}

export function isInActiveWindow(timeline: Pick<AttackTimelineConfig, "activeStart" | "activeEnd">, progress: number): boolean {
  return progress >= timeline.activeStart && progress <= timeline.activeEnd;
}

export function easeAttack(name: AttackEase, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  switch (name) {
    case "sineOut": return Math.sin(x * Math.PI / 2);
    case "sineInOut": return 0.5 - Math.cos(Math.PI * x) / 2;
    case "quadIn": return x * x;
    case "quadInOut": return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
    case "cubicIn": return x * x * x;
  }
}

/** Blade angle at linear time progress t of a phase, including any follow-through overshoot. */
export function samplePhaseAngle(phase: AttackPhase, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  if (phase.followAngle === undefined) {
    return phase.fromAngle + (phase.toAngle - phase.fromAngle) * easeAttack(phase.ease, x);
  }
  const share = phase.followShare ?? FOLLOW_SHARE;
  if (x <= share) {
    return phase.fromAngle + (phase.followAngle - phase.fromAngle) * easeAttack("sineOut", x / share);
  }
  return phase.followAngle + (phase.toAngle - phase.followAngle) * easeAttack(phase.ease, (x - share) / (1 - share));
}

/**
 * Blade angles at the start and end of the swing's damaging window. Pass the
 * swing's ease so the result matches where the blade really is at those times.
 */
export function getActiveSweepAngles(timeline: AttackTimelineConfig, restRotation: number, swingEase?: AttackEase): { readonly start: number; readonly end: number } {
  const windup = restRotation + timeline.windupAngle;
  const arc = timeline.swingAngle - timeline.windupAngle;
  const at = (progress: number) => (swingEase ? easeAttack(swingEase, progress) : progress);
  return { start: windup + arc * at(timeline.activeStart), end: windup + arc * at(timeline.activeEnd) };
}

export function getSweepHitRadius(bladeThickness: number, targetRadius = MONSTER_HIT_RADIUS): number {
  return targetRadius + bladeThickness * 0.5;
}
