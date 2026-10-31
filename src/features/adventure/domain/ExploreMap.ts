/**
 * 探索 (exploration): a region's walkable map. The hero walks it with the
 * direction keys; trees, rocks, water and buildings block him, and the
 * region's creatures roam it. Walking into one starts that stage's fight.
 *
 * Everything here is in world units (one unit is one CSS pixel at scale 1),
 * with y growing downward and every position a figure's feet.
 */

export interface ExplorePoint {
  readonly x: number;
  readonly y: number;
}

/** Something the hero cannot walk through. */
export type ExploreObstacle =
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  | { readonly kind: "circle"; readonly x: number; readonly y: number; readonly radius: number }
  | { readonly kind: "ellipse"; readonly x: number; readonly y: number; readonly rx: number; readonly ry: number };

/** A scenery piece drawn standing in the world, sorted by its feet so the hero can pass behind it. */
export interface ExploreProp {
  readonly kind: "pine" | "rock" | "pavilion" | "lantern" | "bamboo";
  readonly x: number;
  readonly y: number;
  /** Size relative to the prop's usual size. */
  readonly scale: number;
}

/** Where a creature lives on the map: the stage it is, its home and how far it wanders from it. */
export interface ExploreSpawn {
  readonly stage: number;
  readonly home: ExplorePoint;
  readonly roam: number;
}

export interface ExploreMapSpec {
  readonly regionIndex: number;
  readonly width: number;
  readonly height: number;
  readonly start: ExplorePoint;
  readonly obstacles: readonly ExploreObstacle[];
  readonly props: readonly ExploreProp[];
  readonly spawns: readonly ExploreSpawn[];
}

/** Radius of the hero's feet for collisions. */
export const HERO_FOOT_RADIUS = 16;
/** World units per second the hero walks. */
export const HERO_WALK_SPEED = 260;
/** How close the hero must come to a creature to start the fight. */
export const ENCOUNTER_RADIUS = 52;

/** The blocking footprint of each prop, from its feet, at scale 1. */
const PROP_FOOTPRINT: Record<ExploreProp["kind"], (prop: ExploreProp) => ExploreObstacle> = {
  pine: prop => ({ kind: "circle", x: prop.x, y: prop.y - 6 * prop.scale, radius: 22 * prop.scale }),
  bamboo: prop => ({ kind: "circle", x: prop.x, y: prop.y - 4 * prop.scale, radius: 18 * prop.scale }),
  rock: prop => ({ kind: "ellipse", x: prop.x, y: prop.y - 14 * prop.scale, rx: 44 * prop.scale, ry: 22 * prop.scale }),
  lantern: prop => ({ kind: "circle", x: prop.x, y: prop.y - 6 * prop.scale, radius: 12 * prop.scale }),
  pavilion: prop => ({ kind: "rect", x: prop.x - 110 * prop.scale, y: prop.y - 70 * prop.scale, width: 220 * prop.scale, height: 70 * prop.scale }),
};

const pines = (points: readonly (readonly [number, number, number?])[]): ExploreProp[] =>
  points.map(([x, y, scale = 1]) => ({ kind: "pine", x, y, scale }));

/**
 * 雲霧山門: a stone path climbs from the foot of the mountain (bottom) to the
 * sect's gate under the cliffs (top), past a misty pond on the left, a pavilion
 * on the right and stands of pine. The cloud cranes roam along the way and
 * their king guards the gate.
 */
export const MIST_GATE_MAP: ExploreMapSpec = {
  regionIndex: 0,
  width: 1800,
  height: 1500,
  start: { x: 900, y: 1420 },
  obstacles: [
    // The cliffs along the top, with the gate in a gap between them.
    { kind: "rect", x: 0, y: 0, width: 1800, height: 210 },
    { kind: "rect", x: 0, y: 210, width: 690, height: 60 },
    { kind: "rect", x: 1110, y: 210, width: 690, height: 60 },
    // The gate's two pillars stand either side of the path.
    { kind: "rect", x: 742, y: 250, width: 56, height: 50 },
    { kind: "rect", x: 1002, y: 250, width: 56, height: 50 },
    // The misty pond.
    { kind: "ellipse", x: 390, y: 820, rx: 250, ry: 150 },
    // The stream that falls from the cliffs into the pond.
    { kind: "rect", x: 300, y: 260, width: 70, height: 440 },
  ],
  props: [
    ...pines([
      [120, 380, 1.2], [210, 470], [560, 380, 1.1], [610, 520], [180, 1060, 1.2], [90, 1220], [300, 1300, 1.1],
      [610, 1120], [560, 1380, 1.2], [1250, 380, 1.1], [1520, 360, 1.2], [1690, 520], [1180, 940], [1640, 980, 1.2],
      [1500, 1140], [1700, 1300, 1.1], [1280, 1360, 1.2], [1060, 1240, 0.9], [760, 600, 0.9],
    ]),
    { kind: "bamboo", x: 1560, y: 760, scale: 1 }, { kind: "bamboo", x: 1610, y: 800, scale: 1.1 }, { kind: "bamboo", x: 1520, y: 820, scale: 0.9 },
    { kind: "rock", x: 700, y: 930, scale: 1 }, { kind: "rock", x: 1140, y: 640, scale: 1.2 }, { kind: "rock", x: 420, y: 1210, scale: 0.9 }, { kind: "rock", x: 1400, y: 1260, scale: 0.8 },
    { kind: "pavilion", x: 1380, y: 700, scale: 1 },
    { kind: "lantern", x: 820, y: 360, scale: 1 }, { kind: "lantern", x: 980, y: 360, scale: 1 }, { kind: "lantern", x: 820, y: 900, scale: 1 }, { kind: "lantern", x: 980, y: 1160, scale: 1 },
  ],
  spawns: [
    { stage: 1, home: { x: 760, y: 1250 }, roam: 90 },
    { stage: 2, home: { x: 1150, y: 1060 }, roam: 110 },
    { stage: 3, home: { x: 520, y: 1010 }, roam: 70 },
    { stage: 4, home: { x: 1240, y: 820 }, roam: 90 },
    { stage: 5, home: { x: 700, y: 640 }, roam: 90 },
    { stage: 6, home: { x: 900, y: 420 }, roam: 30 },
  ],
};

export const exploreMaps: readonly ExploreMapSpec[] = [MIST_GATE_MAP];

export function getExploreMap(regionIndex: number): ExploreMapSpec | null {
  return exploreMaps.find(map => map.regionIndex === regionIndex) ?? null;
}

/** Every obstacle of the map: its own, plus each prop's footprint. */
export function getMapObstacles(map: ExploreMapSpec): readonly ExploreObstacle[] {
  return [...map.obstacles, ...map.props.map(prop => PROP_FOOTPRINT[prop.kind](prop))];
}

/** Whether a circle of `radius` at `point` overlaps the obstacle. */
export function overlapsObstacle(point: ExplorePoint, radius: number, obstacle: ExploreObstacle): boolean {
  switch (obstacle.kind) {
    case "rect": {
      const nearestX = Math.max(obstacle.x, Math.min(point.x, obstacle.x + obstacle.width));
      const nearestY = Math.max(obstacle.y, Math.min(point.y, obstacle.y + obstacle.height));
      return (point.x - nearestX) ** 2 + (point.y - nearestY) ** 2 < radius ** 2;
    }
    case "circle":
      return (point.x - obstacle.x) ** 2 + (point.y - obstacle.y) ** 2 < (radius + obstacle.radius) ** 2;
    case "ellipse": {
      // Grow the ellipse by the radius: close enough for round feet against a pond or a rock.
      const dx = (point.x - obstacle.x) / (obstacle.rx + radius);
      const dy = (point.y - obstacle.y) / (obstacle.ry + radius);
      return dx * dx + dy * dy < 1;
    }
  }
}

export function isBlocked(map: ExploreMapSpec, obstacles: readonly ExploreObstacle[], point: ExplorePoint, radius = HERO_FOOT_RADIUS): boolean {
  if (point.x < radius || point.y < radius || point.x > map.width - radius || point.y > map.height - radius) return true;
  return obstacles.some(obstacle => overlapsObstacle(point, radius, obstacle));
}

/**
 * One step from `from` by (dx, dy): each axis moves on its own, so walking
 * diagonally into a wall slides along it instead of stopping dead.
 */
export function moveWithCollision(map: ExploreMapSpec, obstacles: readonly ExploreObstacle[], from: ExplorePoint, dx: number, dy: number, radius = HERO_FOOT_RADIUS): ExplorePoint {
  let next = from;
  const alongX = { x: next.x + dx, y: next.y };
  if (dx !== 0 && !isBlocked(map, obstacles, alongX, radius)) next = alongX;
  const alongY = { x: next.x, y: next.y + dy };
  if (dy !== 0 && !isBlocked(map, obstacles, alongY, radius)) next = alongY;
  return next;
}

/** The (dx, dy) of one frame of walking: diagonal steps are no faster than straight ones. */
export function walkStep(direction: ExplorePoint, seconds: number, speed = HERO_WALK_SPEED): ExplorePoint {
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) return { x: 0, y: 0 };
  const distance = speed * Math.min(seconds, 0.05);
  return { x: (direction.x / length) * distance, y: (direction.y / length) * distance };
}

/** The top-left of a `viewWidth` × `viewHeight` camera centred on the hero, kept inside the map. */
export function cameraOrigin(map: ExploreMapSpec, hero: ExplorePoint, viewWidth: number, viewHeight: number): ExplorePoint {
  const clamp = (value: number, size: number, view: number) => (view >= size ? (size - view) / 2 : Math.max(0, Math.min(size - view, value - view / 2)));
  return { x: clamp(hero.x, map.width, viewWidth), y: clamp(hero.y - 40, map.height, viewHeight) };
}
