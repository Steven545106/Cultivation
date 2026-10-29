import { describe, expect, it } from "vitest";
import v1Manifest from "../../../../public/assets/player/rig/bai-rig.json";
import v2Manifest from "../../../../public/assets/player/rig-v2-leg/bai-rig-v2-leg.json";
import { attackClips, sampleAttackClip, type AttackClipPhase } from "./attackClips";
import { computeWorldTransforms, partPointToWorld, validateRig, type Pose, type RigDefinition } from "./CutoutRig";
import { getSoleWorldPositions, plantFeet } from "./footPlanting";
import { SQUAT_POSE } from "./labPoses";
import { getContactPoints, getRestContacts, plantLegsIk } from "./legPlanting";

const v1 = v1Manifest as unknown as RigDefinition;
const v2 = v2Manifest as unknown as RigDefinition;
const ik = v2.legIk!;
const ORIGIN = { x: 640, y: 460 };
const PHASES: readonly AttackClipPhase[] = ["windup", "swing", "recovery"];
const CLIPS = Object.keys(attackClips) as (keyof typeof attackClips)[];
const STEPS = 40;
/** Lunges longer than the jointed leg can reach even on tiptoe; their planted foot must drag. */
const REACH_LIMITED = new Set(["thrust", "thrustBurst"]);

/** V1 leg id ↔ V2 leg key. */
const LEGS = [["leg_front", "front"], ["leg_back", "back"]] as const;

function frames(): { clip: string; pose: Pose }[] {
  const list: { clip: string; pose: Pose }[] = [];
  for (const clip of CLIPS) {
    for (const phase of PHASES) {
      for (let step = 0; step <= STEPS; step += 1) list.push({ clip, pose: sampleAttackClip(attackClips[clip], phase, step / STEPS) });
    }
  }
  return list;
}

const v1Rest = getSoleWorldPositions(v1, v1.footPlant!, {}, ORIGIN);

/** V1's sole (world) for each leg after V1 planting. */
function v1Soles(pose: Pose) {
  const planted = plantFeet(v1, v1.footPlant!, pose, ORIGIN, v1Rest);
  return getSoleWorldPositions(v1, v1.footPlant!, planted, ORIGIN);
}

/** The same physical sole point on V2's foot, after V2 planting. */
function v2Soles(pose: Pose) {
  const solved = plantLegsIk(v2, ik, pose, ORIGIN);
  const transforms = computeWorldTransforms(v2, solved.pose, ORIGIN);
  const soles = new Map(LEGS.map(([v1Id, key]) => [v1Id, partPointToWorld(v2, transforms, ik.legs[key].foot, ik.legs[key].sole!)]));
  return { solved, soles };
}

interface Metrics {
  /** Largest sideways drift of the foot that should stay put (grounded lunges and leans). */
  slide: number;
  /** Largest sinking of any grounded foot below where it stood. */
  sink: number;
}

/** Same rules as V1's footPlanting.test: slide judged on the planted leg of grounded lunges/leans; sink on every grounded foot. */
function measure(poses: readonly Pose[], soles: (pose: Pose) => Map<string, { x: number; y: number }>): Metrics {
  let slide = 0;
  let sink = 0;
  for (const pose of poses) {
    const shift = pose.body?.x ?? 0;
    const lift = -(pose.body?.y ?? 0);
    if (lift > 40) continue;
    const world = soles(pose);
    for (const [leg] of LEGS) sink = Math.max(sink, world.get(leg)!.y - v1Rest.get(leg)!.y);
    if (Math.abs(shift) < 30) continue;
    const planted = shift >= 0 ? v1.footPlant!.plantWhenForward : v1.footPlant!.plantWhenBack;
    slide = Math.max(slide, Math.abs(world.get(planted)!.x - v1Rest.get(planted)!.x));
  }
  return { slide, sink };
}

describe("V2-Leg rig", () => {
  it("is a valid rig: V1.1's ten other parts unchanged, each leg thigh → shin → foot plus a knee guard", () => {
    expect(() => validateRig(v2)).not.toThrow();
    expect(v2.parts).toHaveLength(18);
    for (const part of v1.parts.filter(part => !part.id.startsWith("leg_"))) {
      expect(v2.parts.find(candidate => candidate.id === part.id), part.id).toEqual(part);
    }
    expect(v2.footPlant).toBeUndefined();
  });

  it("stands exactly where V1 stands at rest", () => {
    const rest = getRestContacts(v2, ik, ORIGIN);
    const { soles } = v2Soles({});
    for (const [leg] of LEGS) {
      // The sole point is stored to 0.1 image px (0.03 world px).
      expect(soles.get(leg)!.x).toBeCloseTo(v1Rest.get(leg)!.x, 1);
      expect(soles.get(leg)!.y).toBeCloseTo(v1Rest.get(leg)!.y, 1);
    }
    expect(rest.get("front")!.toe.x).toBeGreaterThan(rest.get("front")!.heel.x);
  });
});

describe("V2-Leg planting", () => {
  const all = frames();

  it("never produces NaN, never folds a knee backwards, and keeps grounded feet out of the ground", () => {
    for (const { clip, pose } of [...all, { clip: "squat", pose: SQUAT_POSE }]) {
      const { pose: solved, legs } = plantLegsIk(v2, ik, pose, ORIGIN);
      for (const part of Object.values(solved)) {
        for (const value of Object.values(part)) expect(Number.isFinite(value), clip).toBe(true);
      }
      for (const [key, report] of Object.entries(legs)) {
        // Knees only ever bend forward (the drawn legs are slightly bent forward too).
        expect(report.kneeBend, `${clip} ${key}`).toBeGreaterThan(0);
      }
      if (-(pose.body?.y ?? 0) <= 40) {
        const rest = getRestContacts(v2, ik, ORIGIN);
        for (const [key, contact] of getContactPoints(v2, ik, solved, ORIGIN)) {
          expect(Math.max(contact.heel.y, contact.toe.y, contact.sole.y) - rest.get(key)!.ground, `${clip} ${key}`).toBeLessThan(0.5);
        }
      }
    }
  });

  it("only changes leg parts: torso, arms, head and so the sword are exactly V1's", () => {
    const legParts = new Set(Object.values(ik.legs).flatMap(leg => [leg.thigh, leg.shin, leg.foot]));
    for (const { pose } of all) {
      const solved = plantLegsIk(v2, ik, pose, ORIGIN).pose;
      const v1World = computeWorldTransforms(v1, plantFeet(v1, v1.footPlant!, pose, ORIGIN, v1Rest), ORIGIN);
      const v2World = computeWorldTransforms(v2, solved, ORIGIN);
      for (const part of v2.parts) {
        if (legParts.has(part.id) || part.id.startsWith("leg_")) continue;
        expect(v2World.get(part.id), part.id).toEqual(v1World.get(part.id));
      }
    }
  });

  it("holds the squat without sinking, by bending both knees", () => {
    const v1Squat = measure([SQUAT_POSE], v1Soles);
    const v2Squat = measure([SQUAT_POSE], pose => v2Soles(pose).soles);
    expect(v1Squat.sink).toBeGreaterThan(10);
    expect(v2Squat.sink).toBeLessThan(0.5);
    const { legs } = plantLegsIk(v2, ik, SQUAT_POSE, ORIGIN);
    expect(legs.front.kneeBend).toBeGreaterThan(20);
    expect(legs.back.kneeBend).toBeGreaterThan(20);
  });

  it("slides and sinks no more than V1 in any clip, and much less wherever the leg can reach", () => {
    const rows: string[] = ["| clip | V1 slide | V2 slide (ball) | V2 slide (contact) | V1 sink | V2 sink | tiptoe | drag | clamped |", "|---|---|---|---|---|---|---|---|---|"];
    let before = 0;
    let after = 0;
    for (const clip of CLIPS) {
      const poses = PHASES.flatMap(phase => Array.from({ length: STEPS + 1 }, (_, step) => sampleAttackClip(attackClips[clip], phase, step / STEPS)));
      const old = measure(poses, v1Soles);
      const now = measure(poses, pose => v2Soles(pose).soles);
      let tiptoe = 0;
      let drag = 0;
      let clamped = 0;
      let contactSlide = 0;
      const rest = getRestContacts(v2, ik, ORIGIN);
      for (const pose of poses) {
        const solved = plantLegsIk(v2, ik, pose, ORIGIN);
        for (const report of Object.values(solved.legs)) {
          if (report.weight < 0.5) continue;
          if (report.mode === "tiptoe") tiptoe += 1;
          if (report.mode === "drag") drag += 1;
          if (report.clamped) clamped += 1;
        }
        // The planted foot's point actually on the ground (heel, ball or toe, whichever is lowest):
        // on tiptoe the ball lifts and moves while the toe holds.
        const shift = pose.body?.x ?? 0;
        if (Math.abs(shift) < 30 || -(pose.body?.y ?? 0) > 40) continue;
        const key = shift >= 0 ? ik.plantWhenForward : ik.plantWhenBack;
        const points = getContactPoints(v2, ik, solved.pose, ORIGIN).get(key)!;
        const resting = rest.get(key)!;
        // Turned round, heel and toe swap sides; the ball is the point held.
        const lowest = (pose.body?.scaleX ?? 1) < 0 ? "sole" : (["heel", "sole", "toe"] as const).reduce((a, b) => (points[b].y > points[a].y ? b : a));
        contactSlide = Math.max(contactSlide, Math.abs(points[lowest].x - resting[lowest].x));
      }
      rows.push(`| ${clip} | ${old.slide.toFixed(1)} | ${now.slide.toFixed(1)} | ${contactSlide.toFixed(1)} | ${old.sink.toFixed(1)} | ${now.sink.toFixed(1)} | ${tiptoe} | ${drag} | ${clamped} |`);
      expect(now.slide, clip).toBeLessThanOrEqual(old.slide + 0.5);
      expect(contactSlide, clip).toBeLessThanOrEqual(old.slide + 0.5);
      expect(now.sink, clip).toBeLessThan(0.5);
      if (REACH_LIMITED.has(clip)) continue;
      before += old.slide;
      after += contactSlide;
    }
    console.log(`\nV1.1 vs V2-Leg, world px, ${PHASES.length * (STEPS + 1)} frames per clip:\n${rows.join("\n")}`);
    // 直刺 and 破空突刺 lunge further than a straight leg on tiptoe reaches: those feet drag (see docs/rig-v2-leg.md).
    expect(after / before).toBeLessThan(0.4);
  });

  it("stands a leg with rest angles at its rest contacts, and plants it there", () => {
    const angled: RigDefinition = { ...v2, legIk: { ...ik, legs: { ...ik.legs, back: { ...ik.legs.back, rest: { thigh: 10, foot: -10 } } } } };
    const config = angled.legIk!;
    const rest = getRestContacts(angled, config, ORIGIN);
    const standing = plantLegsIk(angled, config, {}, ORIGIN);
    expect(standing.pose.leg_back_thigh.rotation).toBeCloseTo(10, 6);
    expect(standing.pose.leg_back_foot.rotation).toBeCloseTo(-10, 6);
    const contacts = getContactPoints(angled, config, standing.pose, ORIGIN).get("back")!;
    expect(contacts.sole.x).toBeCloseTo(rest.get("back")!.sole.x, 6);
    expect(contacts.sole.y).toBeCloseTo(rest.get("back")!.sole.y, 6);
    // Angled back, its foot stands behind where the unangled leg's did.
    expect(rest.get("back")!.sole.x).toBeLessThan(getRestContacts(v2, ik, ORIGIN).get("back")!.sole.x);
    // A lunge plants it where it stood.
    const lunge = sampleAttackClip(attackClips.cleave, "swing", 0.6);
    const planted = getContactPoints(angled, config, plantLegsIk(angled, config, lunge, ORIGIN).pose, ORIGIN).get("back")!;
    expect(Math.abs(planted.toe.x - rest.get("back")!.toe.x)).toBeLessThan(10);
  });

  it("lets go of the ground in the air: the free legs keep their keyed angles", () => {
    const leap = sampleAttackClip(attackClips.leap, "swing", 0.45);
    const { pose, legs } = plantLegsIk(v2, ik, leap, ORIGIN);
    expect(legs.front.weight).toBe(0);
    expect(legs.back.weight).toBe(0);
    expect(pose.leg_front_thigh.rotation).toBeCloseTo(leap.leg_front.rotation ?? 0, 9);
    expect(pose.leg_back_thigh.rotation).toBeCloseTo(leap.leg_back.rotation ?? 0, 9);
  });
});
