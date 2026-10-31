import { describe, expect, it } from "vitest";
import { ADVENTURE_STAGES_PER_REGION } from "./AdventureStages";
import { ENCOUNTER_RADIUS, MIST_GATE_MAP, cameraOrigin, getMapObstacles, isBlocked, moveWithCollision, walkStep, type ExploreMapSpec } from "./ExploreMap";

const map = MIST_GATE_MAP;
const obstacles = getMapObstacles(map);

/** Every walkable point reachable from the start, on a coarse grid. */
function reachable(spec: ExploreMapSpec, step = 20): Set<string> {
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

describe("雲霧山門 exploration map", () => {
  it("starts the hero on open ground", () => {
    expect(isBlocked(map, obstacles, map.start)).toBe(false);
  });

  it("has one creature per stage, each standing where the hero can walk up to it", () => {
    expect(map.spawns.map(spawn => spawn.stage)).toEqual(Array.from({ length: ADVENTURE_STAGES_PER_REGION }, (_, index) => index + 1));
    const open = [...reachable(map)].map(key => key.split(",").map(Number));
    for (const spawn of map.spawns) {
      expect(isBlocked(map, obstacles, spawn.home), `stage ${spawn.stage} stands in an obstacle`).toBe(false);
      expect(open.some(([x, y]) => Math.hypot(x - spawn.home.x, y - spawn.home.y) < ENCOUNTER_RADIUS), `stage ${spawn.stage} cannot be reached`).toBe(true);
    }
  });

  it("stops the hero at a wall but lets him slide along it", () => {
    const belowCliff = { x: 400, y: 320 };
    const up = moveWithCollision(map, obstacles, belowCliff, 0, -200);
    expect(up).toEqual(belowCliff);
    const diagonal = moveWithCollision(map, obstacles, belowCliff, 10, -200);
    expect(diagonal).toEqual({ x: 410, y: 320 });
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
