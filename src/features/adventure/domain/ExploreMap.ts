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
  | { readonly kind: "ellipse"; readonly x: number; readonly y: number; readonly rx: number; readonly ry: number }
  /** Any outline, for a winding stream or river bank; its points go round it in order. */
  | { readonly kind: "polygon"; readonly points: readonly (readonly [number, number])[] };

/** A scenery piece drawn standing in the world, sorted by its feet so the hero can pass behind it. */
export interface ExploreProp {
  /** Which of the map's prop pictures (a key of its `propSizes`). */
  readonly kind: string;
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
  readonly propSizes: Readonly<Record<string, ExplorePropSize>>;
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
 * A prop picture's width in world units at scale 1, and the patch of ground it
 * stands on (an ellipse, as fractions of that width, centred `lift` above its feet).
 */
export interface ExplorePropSize {
  readonly width: number;
  readonly rx: number;
  readonly ry: number;
  readonly lift: number;
}

const MIST_PROP_SIZES: Readonly<Record<string, ExplorePropSize>> = {
  "pine-a": { width: 230, rx: 0.26, ry: 0.08, lift: 0.07 },
  "pine-b": { width: 140, rx: 0.34, ry: 0.12, lift: 0.1 },
  "pine-c": { width: 190, rx: 0.28, ry: 0.09, lift: 0.08 },
  bamboo: { width: 120, rx: 0.32, ry: 0.12, lift: 0.1 },
  crag: { width: 170, rx: 0.4, ry: 0.15, lift: 0.14 },
  rock: { width: 100, rx: 0.38, ry: 0.15, lift: 0.14 },
  lantern: { width: 50, rx: 0.3, ry: 0.16, lift: 0.18 },
  pavilion: { width: 250, rx: 0.4, ry: 0.16, lift: 0.2 },
};

function propFootprint(map: ExploreMapSpec, prop: ExploreProp): ExploreObstacle {
  const size = map.propSizes[prop.kind];
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
  propSizes: MIST_PROP_SIZES,
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

const FOREST_PROP_SIZES: Readonly<Record<string, ExplorePropSize>> = {
  "tree-a": { width: 230, rx: 0.24, ry: 0.08, lift: 0.07 },
  "tree-b": { width: 270, rx: 0.22, ry: 0.07, lift: 0.07 },
  "tree-c": { width: 215, rx: 0.22, ry: 0.08, lift: 0.08 },
  stump: { width: 150, rx: 0.36, ry: 0.13, lift: 0.12 },
  boulder: { width: 110, rx: 0.38, ry: 0.15, lift: 0.14 },
  stone: { width: 70, rx: 0.4, ry: 0.17, lift: 0.16 },
  lantern: { width: 50, rx: 0.3, ry: 0.16, lift: 0.18 },
  shrine: { width: 150, rx: 0.42, ry: 0.17, lift: 0.2 },
};

/**
 * 青翠靈林, on its painted map (1374 × 1145): a forest path climbs from the
 * bottom, crosses a stream on a mossy stone bridge, and ends at the steps of an
 * altar among the roots of a giant spirit tree (top). The stream falls from the
 * upper right and runs out at the left edge; a fairy ring of glowing mushrooms
 * lies in the lower right. The spirit deer roam the glades and their god waits
 * at the altar steps.
 */
export const VERDANT_FOREST_MAP: ExploreMapSpec = {
  regionIndex: 1,
  width: 1374,
  height: 1145,
  ground: "/assets/explore/forest/ground.webp",
  propFolder: "/assets/explore/forest",
  propSizes: FOREST_PROP_SIZES,
  start: { x: 690, y: 1100 },
  obstacles: [
    // The spirit tree and the forest along the top; only the altar steps climb into it.
    { kind: "rect", x: 0, y: 0, width: 1374, height: 180 },
    { kind: "rect", x: 0, y: 180, width: 645, height: 112 },
    { kind: "rect", x: 750, y: 180, width: 624, height: 120 },
    { kind: "rect", x: 645, y: 180, width: 105, height: 48 },
    // The stream west of the bridge, from the bridge's arch out to the left edge.
    { kind: "polygon", points: [[0, 530], [130, 500], [260, 465], [450, 465], [540, 420], [618, 400], [676, 545], [600, 572], [450, 615], [300, 645], [150, 655], [0, 655]] },
    // The stream east of the bridge, up to the waterfall.
    { kind: "polygon", points: [[728, 392], [900, 345], [1150, 300], [1374, 300], [1374, 470], [1250, 466], [1100, 480], [950, 505], [840, 512], [776, 538]] },
    // The forest down the left edge and the roots along the bottom left.
    { kind: "rect", x: 0, y: 292, width: 90, height: 240 },
    { kind: "rect", x: 0, y: 655, width: 130, height: 490 },
    { kind: "rect", x: 130, y: 830, width: 170, height: 315 },
    { kind: "rect", x: 300, y: 945, width: 290, height: 200 },
    // The forest down the right edge and the ferns along the bottom right.
    { kind: "rect", x: 1262, y: 466, width: 112, height: 240 },
    { kind: "rect", x: 1300, y: 706, width: 74, height: 170 },
    { kind: "rect", x: 1150, y: 870, width: 224, height: 275 },
    { kind: "rect", x: 850, y: 1010, width: 300, height: 135 },
  ],
  props: [
    { kind: "tree-b", x: 420, y: 400, scale: 1 },
    { kind: "tree-c", x: 130, y: 470, scale: 1, flip: true },
    { kind: "tree-a", x: 220, y: 790, scale: 1 },
    { kind: "stump", x: 420, y: 935, scale: 0.9 },
    { kind: "boulder", x: 430, y: 700, scale: 1 },
    { kind: "stone", x: 560, y: 880, scale: 1 },
    { kind: "stone", x: 1230, y: 640, scale: 0.8, flip: true },
    { kind: "shrine", x: 1100, y: 650, scale: 1 },
    { kind: "lantern", x: 800, y: 590, scale: 1 },
    { kind: "lantern", x: 585, y: 680, scale: 1 },
  ],
  spawns: [
    { stage: 1, home: { x: 470, y: 820 }, roam: 50 },
    { stage: 2, home: { x: 900, y: 680 }, roam: 60 },
    { stage: 3, home: { x: 1070, y: 790 }, roam: 45 },
    { stage: 4, home: { x: 230, y: 400 }, roam: 50 },
    { stage: 5, home: { x: 860, y: 318 }, roam: 12 },
    { stage: 6, home: { x: 697, y: 312 }, roam: 6 },
  ],
};

const FLAME_PROP_SIZES: Readonly<Record<string, ExplorePropSize>> = {
  "spire-a": { width: 160, rx: 0.34, ry: 0.12, lift: 0.12 },
  "spire-b": { width: 170, rx: 0.36, ry: 0.13, lift: 0.13 },
  crystals: { width: 120, rx: 0.34, ry: 0.13, lift: 0.13 },
  brazier: { width: 70, rx: 0.34, ry: 0.15, lift: 0.16 },
  tree: { width: 230, rx: 0.26, ry: 0.08, lift: 0.08 },
  boulder: { width: 90, rx: 0.4, ry: 0.16, lift: 0.16 },
  stalagmite: { width: 110, rx: 0.32, ry: 0.12, lift: 0.12 },
  altar: { width: 170, rx: 0.42, ry: 0.17, lift: 0.2 },
};

/**
 * 赤焰洞府, on its painted map (1374 × 1145): a path of glowing flagstones
 * climbs from the bottom, crosses a river of lava on a chained basalt bridge,
 * and ends at the steps of an immortal's cave mansion (top). The lava pours
 * from a fall in the upper left and runs across the cavern to the right edge;
 * a fire array is carved into the floor on the upper right. The fire spirits
 * roam the cavern floor and their king waits at the mansion steps.
 */
export const CRIMSON_GROTTO_MAP: ExploreMapSpec = {
  regionIndex: 2,
  width: 1374,
  height: 1145,
  ground: "/assets/explore/flame/ground.webp",
  propFolder: "/assets/explore/flame",
  propSizes: FLAME_PROP_SIZES,
  start: { x: 690, y: 1100 },
  obstacles: [
    // The cavern wall and the mansion along the top; only its steps climb into them.
    { kind: "rect", x: 0, y: 0, width: 1374, height: 200 },
    { kind: "rect", x: 0, y: 200, width: 615, height: 65 },
    { kind: "rect", x: 785, y: 200, width: 589, height: 62 },
    { kind: "rect", x: 615, y: 200, width: 170, height: 25 },
    // The lava fall's basin and the river west of the bridge.
    { kind: "polygon", points: [[0, 265], [335, 265], [335, 300], [272, 380], [300, 460], [360, 486], [500, 506], [605, 515], [640, 522], [640, 690], [560, 656], [400, 650], [280, 640], [200, 600], [0, 590]] },
    // The river east of the bridge, out to the right edge.
    { kind: "polygon", points: [[780, 522], [820, 540], [1000, 555], [1300, 560], [1374, 560], [1374, 722], [1150, 702], [1000, 692], [860, 682], [780, 690]] },
    // The rock walls down both sides.
    { kind: "rect", x: 1310, y: 262, width: 64, height: 300 },
    { kind: "rect", x: 0, y: 590, width: 280, height: 300 },
    { kind: "rect", x: 0, y: 890, width: 210, height: 255 },
    { kind: "rect", x: 1300, y: 700, width: 74, height: 220 },
    // The rocks along the bottom, either side of the path.
    { kind: "rect", x: 210, y: 1010, width: 390, height: 135 },
    { kind: "rect", x: 765, y: 950, width: 240, height: 195 },
    { kind: "rect", x: 1005, y: 920, width: 369, height: 225 },
  ],
  props: [
    { kind: "tree", x: 410, y: 330, scale: 1 },
    { kind: "crystals", x: 900, y: 305, scale: 1 },
    { kind: "spire-a", x: 310, y: 705, scale: 1 },
    { kind: "stalagmite", x: 300, y: 930, scale: 1, flip: true },
    { kind: "spire-b", x: 1230, y: 930, scale: 1 },
    { kind: "crystals", x: 1270, y: 760, scale: 0.8, flip: true },
    { kind: "altar", x: 1140, y: 885, scale: 1 },
    { kind: "boulder", x: 830, y: 905, scale: 1 },
    { kind: "boulder", x: 1255, y: 500, scale: 0.7, flip: true },
    { kind: "brazier", x: 590, y: 735, scale: 1 },
    { kind: "brazier", x: 795, y: 735, scale: 1 },
  ],
  spawns: [
    { stage: 1, home: { x: 430, y: 790 }, roam: 50 },
    { stage: 2, home: { x: 940, y: 770 }, roam: 60 },
    { stage: 3, home: { x: 500, y: 920 }, roam: 40 },
    { stage: 4, home: { x: 500, y: 400 }, roam: 50 },
    { stage: 5, home: { x: 1080, y: 400 }, roam: 50 },
    { stage: 6, home: { x: 700, y: 322 }, roam: 6 },
  ],
};

export const exploreMaps: readonly ExploreMapSpec[] = [MIST_GATE_MAP, VERDANT_FOREST_MAP, CRIMSON_GROTTO_MAP];

export function getExploreMap(regionIndex: number): ExploreMapSpec | null {
  return exploreMaps.find(map => map.regionIndex === regionIndex) ?? null;
}

/** Every obstacle of the map: its own, plus each prop's footprint. */
export function getMapObstacles(map: ExploreMapSpec): readonly ExploreObstacle[] {
  return [...map.obstacles, ...map.props.map(prop => propFootprint(map, prop))];
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
    case "polygon": {
      const points = obstacle.points;
      let inside = false;
      for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
        const [x1, y1] = points[index];
        const [x2, y2] = points[previous];
        if ((y1 > point.y) !== (y2 > point.y) && point.x < ((x2 - x1) * (point.y - y1)) / (y2 - y1) + x1) inside = !inside;
        // Near an edge counts too: the feet are a circle, not a point.
        const length = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        const along = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - x1) * (x2 - x1) + (point.y - y1) * (y2 - y1)) / length));
        if ((point.x - (x1 + along * (x2 - x1))) ** 2 + (point.y - (y1 + along * (y2 - y1))) ** 2 < radius ** 2) return true;
      }
      return inside;
    }
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
