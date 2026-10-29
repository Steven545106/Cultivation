import { samplePhaseAngle, type AttackPlan, type BladeSegment } from "../../features/combat";

/** Largest swing progress covered by one hit sample (~6 samples per 160ms swing at any fps). */
const MAX_SWING_PROGRESS_STEP = 0.04;

export interface AttackRunnerHooks {
  /** Moves the weapon to this blade angle and returns the resulting blade segment. */
  readonly syncWeapon: (angle: number) => BladeSegment;
  readonly setBodyWeight: (weight: number) => void;
  readonly resetPose: () => void;
  /** Read at the start of every phase so live calibration changes apply mid-attack. */
  readonly playbackRate: () => number;
  /** Called at the start and on every frame of each phase, before the weapon moves, so the body pose leads. */
  readonly onPhaseProgress?: (phase: "windup" | "swing" | "recovery", progress: number) => void;
  /** Called on every windup frame with the blade sample and windup progress. */
  readonly onWindupSample?: (segment: BladeSegment, progress: number) => void;
  /** Called on every swing frame with the previous and current blade samples. */
  readonly onSwingSample: (previous: BladeSegment, current: BladeSegment, progress: number) => void;
  /** Called after recovery with the cooldown before the next automatic attack. */
  readonly onFinished: (cooldownMs: number) => void;
}

type PhaseName = "windup" | "swing" | "recovery";
const PHASE_ORDER: readonly PhaseName[] = ["windup", "swing", "recovery"];

interface ActiveAttack {
  readonly plan: AttackPlan;
  readonly hooks: AttackRunnerHooks;
  phase: number;
  /** Battle ms spent in the current phase. */
  elapsed: number;
  /** Fixed at phase start, so live calibration changes apply from the next phase. */
  duration: number;
  previous: BladeSegment;
  lastSwingProgress: number;
}

/**
 * Plays a domain AttackPlan as windup → swing → recovery on the battle clock.
 * Time left over when a phase ends flows into the next phase (and, via
 * advance's return value, into the cooldown), so slow frames or a sped-up
 * battle never lose time at phase boundaries.
 */
export class AttackRunner {
  private active: ActiveAttack | null = null;

  public get isRunning(): boolean {
    return this.active !== null;
  }

  public run(plan: AttackPlan, hooks: AttackRunnerHooks): void {
    this.active = { plan, hooks, phase: 0, elapsed: 0, duration: 0, previous: hooks.syncWeapon(plan.initialAngle), lastSwingProgress: 0 };
    this.startPhase(this.active);
  }

  /** Advances the attack by deltaMs of battle time; returns the ms left unused once it finishes. */
  public advance(deltaMs: number): number {
    let budget = deltaMs;
    while (this.active) {
      const attack = this.active;
      const step = Math.min(budget, attack.duration - attack.elapsed);
      attack.elapsed += step;
      budget -= step;
      const progress = attack.duration > 0 ? attack.elapsed / attack.duration : 1;
      this.samplePhase(attack, progress);
      if (progress < 1) return 0;
      attack.phase += 1;
      if (attack.phase < PHASE_ORDER.length) {
        this.startPhase(attack);
        continue;
      }
      // Recovery already ends at rest, so this only settles the body pose.
      this.active = null;
      attack.hooks.resetPose();
      attack.hooks.syncWeapon(attack.plan.restAngle);
      attack.hooks.onFinished(attack.plan.baseCooldownMs / attack.hooks.playbackRate());
    }
    return budget;
  }

  public cancel(): void {
    this.active = null;
  }

  private startPhase(attack: ActiveAttack): void {
    const name = PHASE_ORDER[attack.phase];
    const phase = attack.plan[name];
    attack.elapsed = 0;
    attack.duration = phase.baseDurationMs / attack.hooks.playbackRate();
    attack.lastSwingProgress = 0;
    attack.hooks.onPhaseProgress?.(name, 0);
    if (phase.bodyWeight !== null) attack.hooks.setBodyWeight(phase.bodyWeight);
  }

  private samplePhase(attack: ActiveAttack, progress: number): void {
    const name = PHASE_ORDER[attack.phase];
    const { hooks, plan } = attack;
    hooks.onPhaseProgress?.(name, progress);
    if (name === "windup") {
      attack.previous = hooks.syncWeapon(samplePhaseAngle(plan.windup, progress));
      hooks.onWindupSample?.(attack.previous, progress);
    } else if (name === "swing") {
      // A slow frame can jump straight over the short damage window, so the
      // swing is resampled in small progress steps: hits never depend on fps.
      const from = attack.lastSwingProgress;
      const steps = Math.max(1, Math.ceil((progress - from) / MAX_SWING_PROGRESS_STEP));
      for (let step = 1; step <= steps; step += 1) {
        const at = from + (progress - from) * step / steps;
        const current = hooks.syncWeapon(samplePhaseAngle(plan.swing, at));
        hooks.onSwingSample(attack.previous, current, at);
        attack.previous = current;
      }
      attack.lastSwingProgress = progress;
    } else {
      hooks.syncWeapon(samplePhaseAngle(plan.recovery, progress));
    }
  }
}
