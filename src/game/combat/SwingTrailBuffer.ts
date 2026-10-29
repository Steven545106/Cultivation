import type { BladeSegment, Point } from "../../features/combat";

export interface TrailSample {
  readonly base: Point;
  readonly tip: Point;
  readonly time: number;
}

export interface FadedTrailSample extends TrailSample {
  /** 1 for a fresh sample, falling to 0 at the end of its lifetime. */
  readonly strength: number;
}

/** Above this blade rotation between frames (radians), extra samples are inserted. */
const MAX_STEP_RADIANS = 6 * Math.PI / 180;
const MAX_INSERTED_STEPS = 8;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function shortestAngleDelta(from: number, to: number): number {
  const delta = (to - from) % (Math.PI * 2);
  return delta > Math.PI ? delta - Math.PI * 2 : delta < -Math.PI ? delta + Math.PI * 2 : delta;
}

/**
 * Interpolates between two blade samples by rotating around the blade base,
 * so fast swings draw a curved arc instead of a straight chord.
 */
export function interpolateBladeSegments(from: BladeSegment, to: BladeSegment, steps: number): BladeSegment[] {
  const fromAngle = Math.atan2(from.tip.y - from.base.y, from.tip.x - from.base.x);
  const toAngle = Math.atan2(to.tip.y - to.base.y, to.tip.x - to.base.x);
  const delta = shortestAngleDelta(fromAngle, toAngle);
  const fromLength = Math.hypot(from.tip.x - from.base.x, from.tip.y - from.base.y);
  const toLength = Math.hypot(to.tip.x - to.base.x, to.tip.y - to.base.y);
  const result: BladeSegment[] = [];
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const base = { x: lerp(from.base.x, to.base.x, t), y: lerp(from.base.y, to.base.y, t) };
    const angle = fromAngle + delta * t;
    const length = lerp(fromLength, toLength, t);
    result.push({ base, tip: { x: base.x + Math.cos(angle) * length, y: base.y + Math.sin(angle) * length } });
  }
  return result;
}

export function getInterpolationSteps(from: BladeSegment, to: BladeSegment): number {
  const fromAngle = Math.atan2(from.tip.y - from.base.y, from.tip.x - from.base.x);
  const toAngle = Math.atan2(to.tip.y - to.base.y, to.tip.x - to.base.x);
  return Math.min(MAX_INSERTED_STEPS, Math.max(1, Math.ceil(Math.abs(shortestAngleDelta(fromAngle, toAngle)) / MAX_STEP_RADIANS)));
}

/** Time-stamped blade samples that fade out after `lifetimeMs`. Renderer-free. */
export class SwingTrailBuffer {
  private samples: TrailSample[] = [];

  public constructor(private readonly lifetimeMs: number, private readonly maxSamples = 64) {}

  public push(segment: BladeSegment, now: number): void {
    const last = this.samples[this.samples.length - 1];
    if (last) {
      const steps = getInterpolationSteps(last, segment);
      // Inserted samples share timestamps spread across the frame gap so they fade smoothly.
      interpolateBladeSegments(last, segment, steps).forEach((inserted, index) => {
        this.samples.push({ ...inserted, time: lerp(last.time, now, (index + 1) / steps) });
      });
    }
    this.samples.push({ base: { ...segment.base }, tip: { ...segment.tip }, time: now });
    if (this.samples.length > this.maxSamples) this.samples.splice(0, this.samples.length - this.maxSamples);
  }

  /** Live samples, oldest first, with their fade strength. Expired samples are dropped. */
  public getFaded(now: number): FadedTrailSample[] {
    this.samples = this.samples.filter(sample => now - sample.time < this.lifetimeMs);
    return this.samples.map(sample => ({ ...sample, strength: Math.max(0, 1 - (now - sample.time) / this.lifetimeMs) }));
  }

  public clear(): void {
    this.samples = [];
  }

  public get size(): number {
    return this.samples.length;
  }
}
