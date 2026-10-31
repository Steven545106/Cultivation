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
  /**
   * For maps of islands in a void (clouds, sky): the only ground there is.
   * The feet must lie wholly inside one of these outlines, so a bridge's
   * outline should reach well into the islands it joins.
   */
  readonly walkable?: readonly (readonly (readonly [number, number])[])[];
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

const FROST_PROP_SIZES: Readonly<Record<string, ExplorePropSize>> = {
  "pine-a": { width: 200, rx: 0.26, ry: 0.08, lift: 0.07 },
  "pine-b": { width: 230, rx: 0.26, ry: 0.08, lift: 0.07 },
  "frost-tree": { width: 220, rx: 0.22, ry: 0.08, lift: 0.07 },
  crystals: { width: 120, rx: 0.36, ry: 0.14, lift: 0.14 },
  boulder: { width: 120, rx: 0.38, ry: 0.15, lift: 0.14 },
  stone: { width: 75, rx: 0.4, ry: 0.17, lift: 0.16 },
  lantern: { width: 55, rx: 0.3, ry: 0.16, lift: 0.18 },
  pavilion: { width: 170, rx: 0.42, ry: 0.17, lift: 0.2 },
};

/**
 * 寒霜冰原, on its painted map (1374 × 1145): a frosted path climbs from the
 * bottom, crosses a glowing glacial crevasse on an arch of ice, and ends at the
 * steps of an ice palace under the frozen falls (top). The crevasse cuts the
 * whole map; the frozen lake in the lower right is solid and can be walked on.
 * The frost wolves roam the snowfield and their king waits at the palace steps.
 */
export const FROSTBOUND_GLACIER_MAP: ExploreMapSpec = {
  regionIndex: 3,
  width: 1374,
  height: 1145,
  ground: "/assets/explore/frost/ground.webp",
  propFolder: "/assets/explore/frost",
  propSizes: FROST_PROP_SIZES,
  start: { x: 690, y: 1100 },
  obstacles: [
    // The glacier cliffs and the palace along the top; only its steps climb into them.
    { kind: "rect", x: 0, y: 0, width: 1374, height: 215 },
    { kind: "rect", x: 0, y: 215, width: 615, height: 85 },
    { kind: "rect", x: 780, y: 215, width: 594, height: 85 },
    { kind: "rect", x: 0, y: 300, width: 100, height: 100 },
    { kind: "rect", x: 1150, y: 300, width: 224, height: 30 },
    { kind: "rect", x: 1300, y: 330, width: 74, height: 90 },
    // The crevasse west of the ice bridge, stepping down from the left edge.
    { kind: "polygon", points: [[0, 400], [380, 410], [375, 470], [590, 470], [670, 600], [380, 600], [380, 540], [0, 540]] },
    // The crevasse east of the bridge, out to the right edge.
    { kind: "polygon", points: [[705, 455], [760, 490], [1374, 490], [1374, 610], [795, 600]] },
    // The frozen cliffs down the left side and along the bottom left.
    { kind: "rect", x: 0, y: 610, width: 130, height: 535 },
    { kind: "rect", x: 130, y: 620, width: 70, height: 100 },
    { kind: "rect", x: 130, y: 820, width: 140, height: 325 },
    { kind: "rect", x: 270, y: 930, width: 310, height: 215 },
    // The cliffs along the bottom right and up the right edge.
    { kind: "rect", x: 920, y: 980, width: 454, height: 165 },
    { kind: "rect", x: 1150, y: 950, width: 224, height: 30 },
    { kind: "rect", x: 1310, y: 780, width: 64, height: 170 },
  ],
  props: [
    { kind: "pine-a", x: 180, y: 395, scale: 1 },
    { kind: "pavilion", x: 470, y: 400, scale: 1 },
    { kind: "pine-b", x: 1180, y: 420, scale: 1 },
    { kind: "frost-tree", x: 250, y: 720, scale: 1 },
    { kind: "boulder", x: 520, y: 690, scale: 1 },
    { kind: "crystals", x: 1280, y: 650, scale: 1 },
    { kind: "crystals", x: 560, y: 960, scale: 0.8, flip: true },
    { kind: "stone", x: 880, y: 990, scale: 1 },
    { kind: "stone", x: 1230, y: 990, scale: 0.8, flip: true },
    { kind: "lantern", x: 640, y: 640, scale: 1 },
    { kind: "lantern", x: 820, y: 640, scale: 1 },
  ],
  spawns: [
    { stage: 1, home: { x: 400, y: 760 }, roam: 60 },
    { stage: 2, home: { x: 1010, y: 800 }, roam: 70 },
    { stage: 3, home: { x: 430, y: 870 }, roam: 40 },
    { stage: 4, home: { x: 280, y: 335 }, roam: 45 },
    { stage: 5, home: { x: 980, y: 385 }, roam: 60 },
    { stage: 6, home: { x: 697, y: 322 }, roam: 6 },
  ],
};

const THUNDER_PROP_SIZES: Readonly<Record<string, ExplorePropSize>> = {
  "pine-a": { width: 210, rx: 0.26, ry: 0.08, lift: 0.08 },
  "pine-b": { width: 230, rx: 0.28, ry: 0.08, lift: 0.08 },
  "dead-tree": { width: 200, rx: 0.24, ry: 0.08, lift: 0.08 },
  stele: { width: 70, rx: 0.36, ry: 0.15, lift: 0.14 },
  drum: { width: 140, rx: 0.4, ry: 0.16, lift: 0.16 },
  crag: { width: 110, rx: 0.38, ry: 0.15, lift: 0.14 },
  rock: { width: 75, rx: 0.4, ry: 0.16, lift: 0.16 },
  pagoda: { width: 110, rx: 0.36, ry: 0.15, lift: 0.14 },
};

/**
 * 雷鳴天海, on its painted map (1374 × 1145): four islands float on a sea of
 * storm clouds. A rune path crosses the south island, a chained bridge leads
 * up to the great central island, a hanging bridge climbs from there to the
 * north island's thunder altar, and a narrow chain bridge reaches a hidden
 * islet in the upper left. Only the islands and bridges can be walked. The
 * thunder lynxes roam the islands; one guards the hidden islet and their king
 * waits at the top of the hanging bridge, below the altar.
 */
export const THUNDER_SKY_MAP: ExploreMapSpec = {
  regionIndex: 4,
  width: 1374,
  height: 1145,
  ground: "/assets/explore/thunder/ground.webp",
  propFolder: "/assets/explore/thunder",
  propSizes: THUNDER_PROP_SIZES,
  start: { x: 700, y: 1100 },
  obstacles: [],
  walkable: [
    // The south island, where the path starts.
    [[400, 880], [600, 852], [640, 832], [790, 832], [830, 852], [1050, 880], [1040, 950], [980, 1000], [1000, 1145], [450, 1145], [420, 1000], [380, 950]],
    // The chained bridge up to the central island.
    [[652, 650], [748, 650], [752, 880], [648, 880]],
    // The central island.
    [[80, 495], [300, 470], [420, 425], [560, 410], [780, 405], [900, 410], [960, 440], [1100, 475], [1290, 505], [1295, 575], [1150, 600], [1000, 640], [800, 660], [760, 690], [650, 690], [560, 660], [420, 640], [250, 610], [90, 560]],
    // The narrow chain bridge to the hidden islet.
    [[150, 240], [228, 240], [228, 318], [352, 470], [360, 525], [270, 530], [150, 330]],
    // The hidden islet.
    [[60, 190], [140, 175], [270, 185], [285, 230], [250, 262], [130, 266], [50, 235]],
    // The hanging bridge up to the north island.
    [[842, 225], [934, 225], [912, 445], [768, 445]],
    // The north island, around the altar; only the altar's steps climb onto it.
    [[480, 195], [560, 160], [740, 150], [760, 210], [850, 215], [855, 185], [935, 185], [940, 215], [1040, 210], [1060, 145], [1200, 150], [1265, 200], [1240, 262], [1080, 282], [940, 268], [840, 268], [700, 282], [560, 262], [485, 235]],
  ],
  props: [
    { kind: "pagoda", x: 600, y: 250, scale: 1 },
    { kind: "stele", x: 1150, y: 245, scale: 1 },
    { kind: "rock", x: 720, y: 262, scale: 0.9 },
    { kind: "drum", x: 470, y: 530, scale: 1 },
    { kind: "dead-tree", x: 150, y: 545, scale: 1 },
    { kind: "pine-a", x: 1200, y: 565, scale: 1 },
    { kind: "rock", x: 590, y: 615, scale: 1, flip: true },
    { kind: "pine-b", x: 990, y: 1010, scale: 1, flip: true },
    { kind: "crag", x: 420, y: 1060, scale: 1 },
  ],
  spawns: [
    { stage: 1, home: { x: 530, y: 950 }, roam: 35 },
    { stage: 2, home: { x: 880, y: 930 }, roam: 35 },
    { stage: 3, home: { x: 260, y: 540 }, roam: 45 },
    { stage: 4, home: { x: 1000, y: 560 }, roam: 50 },
    { stage: 5, home: { x: 170, y: 218 }, roam: 18 },
    { stage: 6, home: { x: 893, y: 240 }, roam: 4 },
  ],
};

const STAR_PROP_SIZES: Readonly<Record<string, ExplorePropSize>> = {
  "tree-a": { width: 200, rx: 0.26, ry: 0.09, lift: 0.08 },
  "tree-b": { width: 220, rx: 0.24, ry: 0.08, lift: 0.08 },
  orb: { width: 90, rx: 0.36, ry: 0.15, lift: 0.14 },
  armillary: { width: 130, rx: 0.4, ry: 0.16, lift: 0.16 },
  "meteor-a": { width: 110, rx: 0.3, ry: 0.12, lift: 0.12 },
  "meteor-b": { width: 60, rx: 0.3, ry: 0.12, lift: 0.12 },
  arch: { width: 170, rx: 0.42, ry: 0.1, lift: 0.08 },
  obelisk: { width: 70, rx: 0.36, ry: 0.15, lift: 0.14 },
};

/**
 * 星河虛空, on its painted map (1374 × 1145): white jade platforms float in a
 * starry void, joined by bridges of starlight. A winding bridge climbs from the
 * hexagonal south platform to a great observatory plaza with a star chart on
 * its floor; from there one bridge reaches a crescent platform on the left and
 * another climbs to the moon gate on the north platform. Only the platforms and
 * bridges can be walked. The star foxes roam the platforms, one keeps the
 * crescent, and their king waits at the foot of the moon gate's steps.
 */
export const STARRY_VOID_MAP: ExploreMapSpec = {
  regionIndex: 5,
  width: 1374,
  height: 1145,
  ground: "/assets/explore/star/ground.webp",
  propFolder: "/assets/explore/star",
  propSizes: STAR_PROP_SIZES,
  start: { x: 690, y: 1100 },
  obstacles: [],
  walkable: [
    // The hexagonal south platform, where the path starts.
    [[540, 912], [860, 912], [935, 1030], [925, 1145], [445, 1145], [440, 1040]],
    // The winding starlight bridge up to the plaza.
    [[640, 640], [650, 700], [700, 760], [700, 820], [680, 880], [680, 950], [775, 950], [780, 880], [830, 820], [835, 760], [770, 700], [748, 640]],
    // The observatory plaza.
    [[1030, 532], [1004, 591], [930, 642], [820, 675], [690, 687], [560, 675], [450, 642], [376, 591], [350, 532], [376, 473], [450, 422], [560, 389], [690, 377], [820, 389], [930, 422], [1004, 473]],
    // The bridge to the crescent platform.
    [[215, 378], [300, 398], [405, 448], [415, 515], [340, 482], [250, 448], [205, 442]],
    // The crescent platform.
    [[190, 280], [100, 300], [30, 340], [15, 385], [60, 425], [180, 440], [270, 432], [250, 395], [130, 385], [110, 345], [150, 305]],
    // The bridge up to the north platform.
    [[770, 420], [795, 350], [878, 312], [928, 245], [1005, 245], [992, 300], [905, 372], [880, 425]],
    // The north platform around the moon gate; only its steps reach the gate.
    [[720, 215], [780, 175], [900, 165], [910, 215], [1060, 222], [1150, 190], [1200, 165], [1270, 220], [1260, 280], [1150, 300], [1000, 302], [880, 306], [760, 265]],
  ],
  props: [
    { kind: "armillary", x: 790, y: 245, scale: 1 },
    { kind: "tree-a", x: 1200, y: 262, scale: 1 },
    { kind: "arch", x: 560, y: 405, scale: 1 },
    { kind: "orb", x: 690, y: 540, scale: 1 },
    { kind: "tree-b", x: 980, y: 625, scale: 0.85, flip: true },
    { kind: "obelisk", x: 478, y: 1085, scale: 1 },
    { kind: "meteor-a", x: 1180, y: 780, scale: 1 },
    { kind: "meteor-b", x: 250, y: 840, scale: 1, flip: true },
    { kind: "meteor-b", x: 1250, y: 470, scale: 0.8 },
  ],
  spawns: [
    { stage: 1, home: { x: 560, y: 1045 }, roam: 35 },
    { stage: 2, home: { x: 830, y: 1045 }, roam: 35 },
    { stage: 3, home: { x: 480, y: 570 }, roam: 45 },
    { stage: 4, home: { x: 900, y: 520 }, roam: 45 },
    { stage: 5, home: { x: 72, y: 385 }, roam: 10 },
    { stage: 6, home: { x: 990, y: 268 }, roam: 4 },
  ],
};

export const exploreMaps: readonly ExploreMapSpec[] = [MIST_GATE_MAP, VERDANT_FOREST_MAP, CRIMSON_GROTTO_MAP, FROSTBOUND_GLACIER_MAP, THUNDER_SKY_MAP, STARRY_VOID_MAP];

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
    case "polygon":
      // Near an edge counts too: the feet are a circle, not a point.
      return insidePolygon(obstacle.points, point) || distanceToOutline(obstacle.points, point) < radius;
    case "ellipse": {
      // Grow the ellipse by the radius: close enough for round feet against a pond or a rock.
      const dx = (point.x - obstacle.x) / (obstacle.rx + radius);
      const dy = (point.y - obstacle.y) / (obstacle.ry + radius);
      return dx * dx + dy * dy < 1;
    }
  }
}

function insidePolygon(points: readonly (readonly [number, number])[], point: ExplorePoint): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[previous];
    if ((y1 > point.y) !== (y2 > point.y) && point.x < ((x2 - x1) * (point.y - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function distanceToOutline(points: readonly (readonly [number, number])[], point: ExplorePoint): number {
  let nearest = Infinity;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[previous];
    const length = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    const along = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - x1) * (x2 - x1) + (point.y - y1) * (y2 - y1)) / length));
    nearest = Math.min(nearest, Math.hypot(point.x - (x1 + along * (x2 - x1)), point.y - (y1 + along * (y2 - y1))));
  }
  return nearest;
}

export function isBlocked(map: ExploreMapSpec, obstacles: readonly ExploreObstacle[], point: ExplorePoint, radius = HERO_FOOT_RADIUS): boolean {
  if (point.x < radius || point.y < radius || point.x > map.width - radius || point.y > map.height - radius) return true;
  if (map.walkable && !map.walkable.some(ground => insidePolygon(ground, point) && distanceToOutline(ground, point) >= radius)) return true;
  return obstacles.some(obstacle => overlapsObstacle(point, radius, obstacle));
}

/**
 * One step from `from` by (dx, dy): each axis moves on its own, so walking
 * diagonally into a wall slides along it instead of stopping dead. Walking
 * straight into a slanted edge (a bridge's railing) glances off it at 45°.
 */
export function moveWithCollision(map: ExploreMapSpec, obstacles: readonly ExploreObstacle[], from: ExplorePoint, dx: number, dy: number, radius = HERO_FOOT_RADIUS): ExplorePoint {
  let next = from;
  const alongX = { x: next.x + dx, y: next.y };
  if (dx !== 0 && !isBlocked(map, obstacles, alongX, radius)) next = alongX;
  const alongY = { x: next.x, y: next.y + dy };
  if (dy !== 0 && !isBlocked(map, obstacles, alongY, radius)) next = alongY;
  if (next === from && (dx === 0) !== (dy === 0)) {
    const step = Math.abs(dx + dy) * Math.SQRT1_2;
    const glances = dx === 0
      ? [{ x: from.x + step, y: from.y + Math.sign(dy) * step }, { x: from.x - step, y: from.y + Math.sign(dy) * step }]
      : [{ x: from.x + Math.sign(dx) * step, y: from.y + step }, { x: from.x + Math.sign(dx) * step, y: from.y - step }];
    return glances.find(point => !isBlocked(map, obstacles, point, radius)) ?? from;
  }
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
