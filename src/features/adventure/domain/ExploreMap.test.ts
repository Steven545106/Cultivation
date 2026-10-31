import { describe, expect, it } from "vitest";
import { ADVENTURE_STAGES_PER_REGION } from "./AdventureStages";
import { ENCOUNTER_RADIUS, MIST_GATE_MAP, cameraOrigin, exploreMaps, getMapObstacles, isBlocked, moveWithCollision, overlapsObstacle, walkStep, type ExploreMapSpec } from "./ExploreMap";

const map = MIST_GATE_MAP;
const obstacles = getMapObstacles(map);

/** Every walkable point reachable from the start, on a coarse grid. */
function reachable(spec: ExploreMapSpec, step = 10): Set<string> {
  const obstacles = getMapObstacles(spec);
  const seen = new Set<string>();
  const queue = [{ x: Math.round(spec.start.x / step) * step, y: Math.round(spec.start.y / step) * step }];
  while (queue.length) {
    const point = queue.pop()!;
    const key = `${point.x},${point.y}`;
    if (seen.has(key) || isBlocked(spec, obstacles, point)) continue;
    seen.add(key);
    queue.push({ x: point.x + step, y: point.y }, { x: point.x - step, y: point.y }, { x: point.x, y: point.y + step }, { x: point.x, y: point.y - step });
  }
  return seen;
}

describe.each(exploreMaps.map(spec => [spec.ground, spec] as const))("exploration map %s", (_, spec) => {
  const specObstacles = getMapObstacles(spec);

  it("starts the hero on open ground", () => {
    expect(isBlocked(spec, specObstacles, spec.start)).toBe(false);
  });

  it("has a picture size for every prop", () => {
    for (const prop of spec.props) expect(spec.propSizes[prop.kind], prop.kind).toBeDefined();
  });

  it("has one creature per stage, each standing where the hero can walk up to it", () => {
    expect(spec.spawns.map(spawn => spawn.stage)).toEqual(Array.from({ length: ADVENTURE_STAGES_PER_REGION }, (_, index) => index + 1));
    const open = [...reachable(spec)].map(key => key.split(",").map(Number));
    for (const spawn of spec.spawns) {
      expect(isBlocked(spec, specObstacles, spawn.home), `stage ${spawn.stage} stands in an obstacle`).toBe(false);
      expect(open.some(([x, y]) => Math.hypot(x - spawn.home.x, y - spawn.home.y) < ENCOUNTER_RADIUS), `stage ${spawn.stage} cannot be reached`).toBe(true);
    }
  });
});

describe("exploration movement", () => {
  it("blocks feet inside a polygon or touching its edge, but not beside it", () => {
    const square = { kind: "polygon", points: [[0, 0], [100, 0], [100, 100], [0, 100]] } as const;
    expect(overlapsObstacle({ x: 50, y: 50 }, 10, square)).toBe(true);
    expect(overlapsObstacle({ x: 105, y: 50 }, 10, square)).toBe(true);
    expect(overlapsObstacle({ x: 120, y: 50 }, 10, square)).toBe(false);
  });

  it("stops the hero at a wall but lets him slide along it", () => {
    const belowCliff = { x: 400, y: 320 };
    const up = moveWithCollision(map, obstacles, belowCliff, 0, -200);
    expect(up).toEqual(belowCliff);
    const diagonal = moveWithCollision(map, obstacles, belowCliff, 10, -200);
    expect(diagonal).toEqual({ x: 410, y: 320 });
  });

  it("glances off a slanted edge instead of sticking to it", () => {
    const slope = { kind: "polygon", points: [[0, 0], [100, 100], [0, 100]] } as const;
    const spec = { ...map, obstacles: [slope], props: [] };
    const beside = { x: 70, y: 50 };
    const down = moveWithCollision(spec, [slope], beside, 0, 10);
    expect(down.y).toBeGreaterThan(beside.y);
    expect(down.x).toBeGreaterThan(beside.x);
  });

  it("keeps the hero inside the map", () => {
    const edge = moveWithCollision(map, obstacles, { x: 745, y: map.height - 20 }, 0, 100);
    expect(edge.y).toBe(map.height - 20);
  });

  it("walks no faster diagonally than straight", () => {
    const straight = walkStep({ x: 1, y: 0 }, 0.016);
    const diagonal = walkStep({ x: 1, y: 1 }, 0.016);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(Math.hypot(straight.x, straight.y));
    expect(walkStep({ x: 0, y: 0 }, 0.016)).toEqual({ x: 0, y: 0 });
  });

  it("keeps the camera inside the map", () => {
    expect(cameraOrigin(map, { x: 0, y: 0 }, 720, 540)).toEqual({ x: 0, y: 0 });
    expect(cameraOrigin(map, { x: map.width, y: map.height }, 720, 540)).toEqual({ x: map.width - 720, y: map.height - 540 });
  });
});
