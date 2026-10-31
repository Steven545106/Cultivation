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

/** The standing scenery pieces of a map, each its own picture. */
export type ExplorePropKind = "pine-a" | "pine-b" | "pine-c" | "bamboo" | "crag" | "rock" | "lantern" | "pavilion";

/** A scenery piece drawn standing in the world, sorted by its feet so the hero can pass behind it. */
export interface ExploreProp {
  readonly kind: ExplorePropKind;
  readonly x: number;
  readonly y: number;
  /** Size relative to the prop's usual size. */
  readonly scale: number;
  /** Drawn mirrored, so the same picture does not repeat exactly. */
  readonly flip?: boolean;
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
  /** The painted ground, the size of the map. */
  readonly ground: string;
  /** The folder holding the map's prop pictures, one `<kind>.webp` each. */
  readonly propFolder: string;
  readonly start: ExplorePoint;
  readonly obstacles: readonly ExploreObstacle[];
  readonly props: readonly ExploreProp[];
  readonly spawns: readonly ExploreSpawn[];
}

/** Radius of the hero's feet for collisions. */
export const HERO_FOOT_RADIUS = 12;
/** World units per second the hero walks. */
export const HERO_WALK_SPEED = 200;
/** How close the hero must come to a creature to start the fight. */
export const ENCOUNTER_RADIUS = 42;

/**
 * Each prop's width in world units at scale 1, and the patch of ground it
 * stands on (an ellipse, as fractions of that width, centred `lift` above its feet).
 */
export const PROP_SIZES: Readonly<Record<ExplorePropKind, { readonly width: number; readonly rx: number; readonly ry: number; readonly lift: number }>> = {
  "pine-a": { width: 230, rx: 0.26, ry: 0.08, lift: 0.07 },
  "pine-b": { width: 140, rx: 0.34, ry: 0.12, lift: 0.1 },
  "pine-c": { width: 190, rx: 0.28, ry: 0.09, lift: 0.08 },
  bamboo: { width: 120, rx: 0.32, ry: 0.12, lift: 0.1 },
  crag: { width: 170, rx: 0.4, ry: 0.15, lift: 0.14 },
  rock: { width: 100, rx: 0.38, ry: 0.15, lift: 0.14 },
  lantern: { width: 50, rx: 0.3, ry: 0.16, lift: 0.18 },
  pavilion: { width: 250, rx: 0.4, ry: 0.16, lift: 0.2 },
};

function propFootprint(prop: ExploreProp): ExploreObstacle {
  const size = PROP_SIZES[prop.kind];
  const width = size.width * prop.scale;
  return { kind: "ellipse", x: prop.x, y: prop.y - size.lift * width, rx: size.rx * width, ry: size.ry * width };
}

/**
 * 雲霧山門, on its painted map (1374 × 1145): a stone path winds from the foot
 * of the mountain (bottom) up white jade steps to the sect gate under the
 * cliffs (top). A waterfall on the left feeds a lotus pond that spills on down
 * the left edge; clouds close the right and bottom edges. The cloud cranes roam
 * the meadow and their king waits at the foot of the steps.
 */
export const MIST_GATE_MAP: ExploreMapSpec = {
  regionIndex: 0,
  width: 1374,
  height: 1145,
  ground: "/assets/explore/mist/ground.webp",
  propFolder: "/assets/explore/mist",
  start: { x: 745, y: 1100 },
  obstacles: [
    // The cliffs and the gate along the top; only the steps climb into them, up to the gate's threshold.
    { kind: "rect", x: 0, y: 0, width: 635, height: 305 },
    { kind: "rect", x: 745, y: 0, width: 629, height: 295 },
    { kind: "rect", x: 635, y: 0, width: 110, height: 228 },
    // The waterfall's rocks and the stream down into the pond.
    { kind: "rect", x: 0, y: 305, width: 292, height: 165 },
    { kind: "rect", x: 80, y: 470, width: 212, height: 70 },
    // The lotus pond in its stone rim.
    { kind: "ellipse", x: 330, y: 630, rx: 275, ry: 145 },
    // The left edge: the cliff and the stream spilling on from the pond.
    { kind: "rect", x: 0, y: 470, width: 80, height: 675 },
    { kind: "rect", x: 80, y: 690, width: 110, height: 310 },
    { kind: "rect", x: 140, y: 880, width: 110, height: 120 },
    // The bushes and clouds along the bottom left.
    { kind: "rect", x: 0, y: 1000, width: 300, height: 145 },
    { kind: "rect", x: 300, y: 1082, width: 260, height: 63 },
    // The cliffs and clouds down the right edge.
    { kind: "rect", x: 1235, y: 295, width: 139, height: 235 },
    { kind: "rect", x: 1290, y: 530, width: 84, height: 350 },
    { kind: "rect", x: 1200, y: 870, width: 174, height: 275 },
  ],
  props: [
    { kind: "pine-a", x: 1120, y: 470, scale: 1 },
    { kind: "pine-b", x: 520, y: 460, scale: 1 },
    { kind: "pine-c", x: 380, y: 1060, scale: 1, flip: true },
    { kind: "pine-b", x: 1150, y: 1090, scale: 0.9, flip: true },
    { kind: "pine-c", x: 960, y: 760, scale: 0.85 },
    { kind: "bamboo", x: 1215, y: 760, scale: 1 },
    { kind: "crag", x: 540, y: 960, scale: 0.8 },
    { kind: "rock", x: 880, y: 570, scale: 1 },
    { kind: "rock", x: 1060, y: 960, scale: 0.8, flip: true },
    { kind: "pavilion", x: 1030, y: 640, scale: 0.85 },
    { kind: "lantern", x: 605, y: 350, scale: 1 },
    { kind: "lantern", x: 775, y: 350, scale: 1 },
    { kind: "lantern", x: 830, y: 1010, scale: 1 },
  ],
  spawns: [
    { stage: 1, home: { x: 920, y: 1050 }, roam: 60 },
    { stage: 2, home: { x: 400, y: 880 }, roam: 60 },
    { stage: 3, home: { x: 1110, y: 860 }, roam: 50 },
    { stage: 4, home: { x: 420, y: 380 }, roam: 50 },
    { stage: 5, home: { x: 960, y: 400 }, roam: 60 },
    { stage: 6, home: { x: 690, y: 330 }, roam: 8 },
  ],
};

export const exploreMaps: readonly ExploreMapSpec[] = [MIST_GATE_MAP];

export function getExploreMap(regionIndex: number): ExploreMapSpec | null {
  return exploreMaps.find(map => map.regionIndex === regionIndex) ?? null;
}

/** Every obstacle of the map: its own, plus each prop's footprint. */
export function getMapObstacles(map: ExploreMapSpec): readonly ExploreObstacle[] {
  return [...map.obstacles, ...map.props.map(propFootprint)];
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
  return { x: clamp(hero.x, map.width, viewWidth), y: clamp(hero.y - 30, map.height, viewHeight) };
}
