/** Renderer-free 2D point; Phaser vectors satisfy this shape structurally. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One blade sample: the edge start near the grip and the tip. */
export interface BladeSegment {
  readonly base: Point;
  readonly tip: Point;
}

function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Same formula as Phaser.Math.Distance.Between, so hit boundaries are unchanged.
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

/** Tests the swept area between two real blade segments to prevent fast-swing misses. */
export function sweptBladeHitsCircle(previous: BladeSegment, current: BladeSegment, centre: Point, radius: number): boolean {
  return [previous.base, previous.tip, current.base, current.tip].some(point => distance(point, centre) <= radius)
    || distanceToSegment(centre, previous.base, previous.tip) <= radius
    || distanceToSegment(centre, current.base, current.tip) <= radius
    || distanceToSegment(centre, previous.tip, current.tip) <= radius;
}
