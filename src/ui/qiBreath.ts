/**
 * The breathing cycle behind the home page's qi effect, as pure functions of
 * time so it can be drawn statelessly and tested. One cycle (0..1) is
 * inhale, circulate, peak, exhale, then it repeats.
 */
export interface QiCycleStage {
  /** Qi streams in from the surroundings toward the core. */
  readonly inhale: number;
  /** A ribbon of qi circles the body. */
  readonly circulate: number;
  /** Rings of light spread out and the halos shine. */
  readonly peak: number;
  /** The glow disperses outward. */
  readonly exhale: number;
  /** 0..1..0 over the cycle: how full the lungs are, for the aura. */
  readonly breath: number;
}

export const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** A 0..1 window that fades in over `rise` and out over `fall` around [start, end]. */
export const window01 = (start: number, end: number, rise: number, fall: number, value: number): number =>
  smoothstep(start - rise, start, value) * (1 - smoothstep(end, end + fall, value));

/** Where in the cycle (0 ≤ p < 1) a point in time falls. */
export function cyclePhase(timeMs: number, periodMs: number): number {
  const period = Math.max(1, periodMs);
  return ((timeMs % period) + period) % period / period;
}

export function qiStage(phase: number): QiCycleStage {
  return {
    inhale: window01(0.02, 0.36, 0.04, 0.06, phase),
    circulate: window01(0.38, 0.66, 0.06, 0.08, phase),
    peak: window01(0.56, 0.8, 0.08, 0.08, phase),
    exhale: window01(0.8, 0.96, 0.04, 0.04, phase),
    breath: 0.5 - 0.5 * Math.cos(phase * Math.PI * 2),
  };
}

/** Cheap, repeatable pseudo-random number in [0, 1) for a particle index and a salt. */
export function hash01(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export const easeInQuad = (t: number): number => Math.min(1, Math.max(0, t)) ** 2;
