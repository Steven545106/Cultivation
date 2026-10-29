import { computeWorldTransforms, partView, type PartId, type Pose, type RigDefinition, type Vec2, type WorldTransform } from "./CutoutRig";
import { MAX_STRETCH, solveTwoBone, wrapAngle } from "./legIk";

/**
 * Foot planting for jointed legs (V2-Leg): thigh → shin → foot, solved with
 * two-bone IK so a planted foot holds both its place and its height.
 *
 * Like V1 (footPlanting.ts), lunging forwards plants one foot and leaning back
 * the other, handing over around a centred body, and nothing is planted in
 * the air. Per planted foot, in order of preference:
 *   - plant:  the foot stays flat where it stood;
 *   - tiptoe: out of reach, it rolls up onto its toe (or heel) to reach further;
 *   - drag:   still out of reach at the largest roll, the contact slides along
 *             the ground towards the hip (a lunge's trailing drag).
 * Any grounded foot is then lifted out of the ground if it would sink.
 *
 * Only thigh, shin and foot rotations change; the body, torso, arms and sword
 * are untouched, so the blade path and hit timing stay exactly as keyed.
 */
export interface IkLeg {
  readonly thigh: PartId;
  readonly shin: PartId;
  readonly foot: PartId;
  /** The one-piece V1 leg this thigh stands in for; attack clips key that id. */
  readonly clipPart: PartId;
  /** Ground contact points, in the foot image's pixels: the foot rolls about heel or toe. */
  readonly heel: Vec2;
  readonly toe: Vec2;
  /** Ball of the foot (V1's single sole point): where a flat planted foot is held, also when it mirrors. */
  readonly sole: Vec2;
  /**
   * The leg's resting angles (degrees, local) under every pose, e.g. a far leg drawn like the near one but
   * angled back so its foot stands where the original stood. Omitted: the parts' drawn angles (0).
   */
  readonly rest?: { readonly thigh?: number; readonly shin?: number; readonly foot?: number };
}

export interface LegIkConfig {
  readonly legs: Readonly<Record<string, IkLeg>>;
  /** Leg (key of `legs`) planted while the body lunges forwards, and while it leans back. */
  readonly plantWhenForward: string;
  readonly plantWhenBack: string;
  /** Largest roll onto the toe (heel lifted) and onto the heel (toe lifted), degrees. */
  readonly maxHeelLift: number;
  readonly maxToeLift: number;
}

export type FootMode = "plant" | "tiptoe" | "drag" | "free";

export interface LegReport {
  /** How the planted solution held the foot ("free": this leg was not planted this frame). */
  readonly mode: FootMode;
  /** Share (0–1) of the planted solution blended in. */
  readonly weight: number;
  /** Roll onto toe or heel, degrees. */
  readonly roll: number;
  /** The IK target was beyond (or inside) what the leg can reach and was clamped. */
  readonly clamped: boolean;
  /** Hip–knee–ankle bend in degrees: positive bends the knee forward, negative would be a reversed knee. */
  readonly kneeBend: number;
  /** The ground guard lifted this foot out of the ground (world px). */
  readonly lifted: number;
}

export interface LegIkResult {
  readonly pose: Pose;
  readonly legs: Readonly<Record<string, LegReport>>;
}

const DEG = Math.PI / 180;
/** Same hand-over and lift-off as V1, in image px of body offset. */
const HANDOVER_PX = 30;
const LIFT_START_PX = 40;
const LIFT_END_PX = 110;
/** Reach used for planting, a hair inside the IK's own limit so it never clamps by rounding. */
const PLANT_REACH = MAX_STRETCH * 0.99999;
const ROLL_STEP_DEG = 0.25;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function rotate(vector: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

/** Throws when a leg names a part the rig lacks or a leg key that does not exist. */
export function validateLegIk(rig: RigDefinition, config: LegIkConfig): void {
  const ids = new Set(rig.parts.map(part => part.id));
  for (const [key, leg] of Object.entries(config.legs)) {
    for (const id of [leg.thigh, leg.shin, leg.foot]) {
      if (!ids.has(id)) throw new Error(`${rig.id}: legIk.${key} part ${id} is not a part`);
    }
    const shin = rig.parts.find(part => part.id === leg.shin)!;
    const foot = rig.parts.find(part => part.id === leg.foot)!;
    if (shin.parent !== leg.thigh || foot.parent !== leg.shin) throw new Error(`${rig.id}: legIk.${key} must chain thigh → shin → foot`);
  }
  for (const key of [config.plantWhenForward, config.plantWhenBack]) {
    if (!config.legs[key]) throw new Error(`${rig.id}: legIk plants unknown leg ${key}`);
  }
}

/** One leg's bone geometry for the current pose: hip, bone lengths and rest directions in world terms. */
interface Chain {
  readonly hip: Vec2;
  readonly parentRotation: number;
  readonly upperLength: number;
  readonly lowerLength: number;
  /** World direction of each bone when its part's world rotation is 0. */
  readonly upperRest: number;
  readonly lowerRest: number;
  /** Foot contact offsets from the ankle (world px, unrotated). */
  readonly heel: Vec2;
  readonly toe: Vec2;
  readonly sole: Vec2;
  readonly facing: 1 | -1;
}

function chainFor(rig: RigDefinition, leg: IkLeg, transforms: Map<PartId, WorldTransform>): Chain {
  const byId = (id: PartId) => rig.parts.find(part => part.id === id)!;
  const thighT = transforms.get(leg.thigh)!;
  const thigh = partView(byId(leg.thigh), thighT.back);
  const shin = partView(byId(leg.shin), transforms.get(leg.shin)!.back);
  const foot = partView(byId(leg.foot), transforms.get(leg.foot)!.back);
  const scale = (v: Vec2): Vec2 => ({ x: v.x * thighT.scaleX, y: v.y * thighT.scaleY });
  const upper = scale({ x: shin.anchor.x - thigh.pivot.x, y: shin.anchor.y - thigh.pivot.y });
  const lower = scale({ x: foot.anchor.x - shin.pivot.x, y: foot.anchor.y - shin.pivot.y });
  return {
    hip: { x: thighT.x, y: thighT.y },
    parentRotation: transforms.get(byId(leg.thigh).parent!)!.rotation,
    upperLength: Math.hypot(upper.x, upper.y),
    lowerLength: Math.hypot(lower.x, lower.y),
    upperRest: Math.atan2(upper.y, upper.x),
    lowerRest: Math.atan2(lower.y, lower.x),
    heel: scale({ x: leg.heel.x - foot.pivot.x, y: leg.heel.y - foot.pivot.y }),
    toe: scale({ x: leg.toe.x - foot.pivot.x, y: leg.toe.y - foot.pivot.y }),
    sole: scale({ x: leg.sole.x - foot.pivot.x, y: leg.sole.y - foot.pivot.y }),
    facing: thighT.scaleX < 0 ? -1 : 1,
  };
}

/** Local rotations (degrees) of thigh, shin and foot. */
interface LegAngles {
  readonly thigh: number;
  readonly shin: number;
  readonly foot: number;
}

/** World positions of knee, ankle, heel and toe for local leg angles. */
function forward(chain: Chain, angles: LegAngles): { knee: Vec2; ankle: Vec2; heel: Vec2; toe: Vec2; sole: Vec2; footWorld: number } {
  const thighWorld = chain.parentRotation + angles.thigh * DEG;
  const shinWorld = thighWorld + angles.shin * DEG;
  const footWorld = shinWorld + angles.foot * DEG;
  const up = rotate({ x: chain.upperLength * Math.cos(chain.upperRest), y: chain.upperLength * Math.sin(chain.upperRest) }, thighWorld);
  const knee = { x: chain.hip.x + up.x, y: chain.hip.y + up.y };
  const low = rotate({ x: chain.lowerLength * Math.cos(chain.lowerRest), y: chain.lowerLength * Math.sin(chain.lowerRest) }, shinWorld);
  const ankle = { x: knee.x + low.x, y: knee.y + low.y };
  const at = (offset: Vec2): Vec2 => {
    const turned = rotate(offset, footWorld);
    return { x: ankle.x + turned.x, y: ankle.y + turned.y };
  };
  return { knee, ankle, heel: at(chain.heel), toe: at(chain.toe), sole: at(chain.sole), footWorld };
}

/** Local angles that put the ankle at `target` with the foot at world rotation `footWorld`. */
function solveLeg(chain: Chain, target: Vec2, footWorld: number): { angles: LegAngles; clamped: boolean } {
  const solved = solveTwoBone(chain.hip, target, chain.upperLength, chain.lowerLength, chain.facing > 0 ? -1 : 1);
  const thighWorld = solved.upper - chain.upperRest;
  const shinWorld = solved.lower - chain.lowerRest;
  return {
    angles: {
      thigh: wrapAngle(thighWorld - chain.parentRotation) / DEG,
      shin: wrapAngle(shinWorld - thighWorld) / DEG,
      foot: wrapAngle(footWorld - shinWorld) / DEG,
    },
    clamped: solved.clamped !== "none",
  };
}

function kneeBend(chain: Chain, angles: LegAngles): number {
  const points = forward(chain, angles);
  const upper = Math.atan2(points.knee.y - chain.hip.y, points.knee.x - chain.hip.x);
  const lower = Math.atan2(points.ankle.y - points.knee.y, points.ankle.x - points.knee.x);
  return wrapAngle(lower - upper) * chain.facing / DEG;
}

interface PlantedSolution {
  readonly angles: LegAngles;
  readonly mode: Exclude<FootMode, "free">;
  readonly roll: number;
  readonly clamped: boolean;
}

/**
 * The planted foot: flat with its ball where it stood, else rolled onto toe or
 * heel by the smallest angle that reaches, else dragged at the largest roll.
 */
function plantLeg(chain: Chain, sole: Vec2, config: LegIkConfig): PlantedSolution {
  const reach = (chain.upperLength + chain.lowerLength) * PLANT_REACH;
  const flat = { x: sole.x - chain.sole.x, y: sole.y - chain.sole.y };
  // Heel and toe of that flat foot: rolling starts from where they touch now, so tiptoe grows smoothly out of plant.
  const contact = { heel: { x: flat.x + chain.heel.x, y: flat.y + chain.heel.y }, toe: { x: flat.x + chain.toe.x, y: flat.y + chain.toe.y } };
  /** Ankle with `pivot` (heel or toe) held where it touches flat, and the foot at world rotation `footWorld`. */
  const ankleAbout = (pivot: "heel" | "toe", footWorld: number): Vec2 => {
    const offset = rotate(chain[pivot], footWorld);
    return { x: contact[pivot].x - offset.x, y: contact[pivot].y - offset.y };
  };
  const distance = (point: Vec2) => Math.hypot(point.x - chain.hip.x, point.y - chain.hip.y);
  if (distance(flat) <= reach) return { ...solveLeg(chain, flat, 0), mode: "plant", roll: 0 };
  // Rolling onto the toe lifts the heel; onto the heel lifts the toe. Each turns the foot the way that raises its other end.
  const rolls = (["toe", "heel"] as const).map(pivot => {
    const other = pivot === "toe" ? "heel" : "toe";
    const sign = rotate(chain[other], DEG).y - rotate(chain[pivot], DEG).y < chain[other].y - chain[pivot].y ? 1 : -1;
    return { pivot, sign, max: pivot === "toe" ? config.maxHeelLift : config.maxToeLift };
  });
  type Candidate = { pivot: "heel" | "toe"; footWorld: number; roll: number; distance: number };
  let reaching: Candidate | null = null;
  let closest: Candidate | null = null;
  for (const option of rolls) {
    for (let roll = ROLL_STEP_DEG; roll <= option.max + 1e-9; roll += ROLL_STEP_DEG) {
      const footWorld = option.sign * roll * DEG;
      const candidate = { pivot: option.pivot, footWorld, roll, distance: distance(ankleAbout(option.pivot, footWorld)) };
      if (candidate.distance <= reach) {
        // The smallest roll that reaches, over both ways of rolling.
        if (!reaching || roll < reaching.roll) reaching = candidate;
        break;
      }
      if (!closest || candidate.distance < closest.distance) closest = candidate;
    }
  }
  if (reaching) return { ...solveLeg(chain, ankleAbout(reaching.pivot, reaching.footWorld), reaching.footWorld), mode: "tiptoe", roll: reaching.roll };
  const chosen = closest!;
  const ankle = ankleAbout(chosen.pivot, chosen.footWorld);
  // Drag: keep the roll, and slide the contact along the hip→ankle line until the leg reaches.
  const pull = reach / chosen.distance;
  const dragged = { x: chain.hip.x + (ankle.x - chain.hip.x) * pull, y: chain.hip.y + (ankle.y - chain.hip.y) * pull };
  return { ...solveLeg(chain, dragged, chosen.footWorld), mode: "drag", roll: chosen.roll };
}

/** Each leg's contact points standing at rest; `ground` is the lowest of them (the drawn feet tilt a little). */
export function getRestContacts(rig: RigDefinition, config: LegIkConfig, origin: Vec2): Map<string, { heel: Vec2; toe: Vec2; sole: Vec2; ground: number }> {
  const transforms = computeWorldTransforms(rig, {}, origin);
  return new Map(Object.entries(config.legs).map(([key, leg]) => {
    const points = forward(chainFor(rig, leg, transforms), { thigh: leg.rest?.thigh ?? 0, shin: leg.rest?.shin ?? 0, foot: leg.rest?.foot ?? 0 });
    return [key, { heel: points.heel, toe: points.toe, sole: points.sole, ground: Math.max(points.heel.y, points.toe.y, points.sole.y) }];
  }));
}

/** The pose with the legs at their rest angles, the thighs taking their V1 clip keys, and nothing planted. */
export function keyedLegPose(config: LegIkConfig, pose: Pose): Pose {
  const keyed: Record<PartId, Pose[PartId]> = { ...pose };
  for (const leg of Object.values(config.legs)) {
    const clip = pose[leg.clipPart]?.rotation ?? 0;
    keyed[leg.thigh] = { ...pose[leg.thigh], rotation: (pose[leg.thigh]?.rotation ?? 0) + clip + (leg.rest?.thigh ?? 0) };
    if (leg.rest?.shin) keyed[leg.shin] = { ...pose[leg.shin], rotation: (pose[leg.shin]?.rotation ?? 0) + leg.rest.shin };
    if (leg.rest?.foot) keyed[leg.foot] = { ...pose[leg.foot], rotation: (pose[leg.foot]?.rotation ?? 0) + leg.rest.foot };
  }
  return keyed;
}

/** Plants the legs (see the file comment). `pose` is the full body pose (idle + clip), keyed for V1's one-piece legs. */
export function plantLegsIk(rig: RigDefinition, config: LegIkConfig, pose: Pose, origin: Vec2): LegIkResult {
  const root = rig.parts.find(part => !part.parent)!;
  const body = pose[root.id] ?? {};
  const grounded = 1 - clamp01((-(body.y ?? 0) - LIFT_START_PX) / (LIFT_END_PX - LIFT_START_PX));
  const t = clamp01(((body.x ?? 0) + HANDOVER_PX) / (2 * HANDOVER_PX));
  const lean = t * t * (3 - 2 * t);
  const keyed = keyedLegPose(config, pose);
  const transforms = computeWorldTransforms(rig, keyed, origin);
  // Feet stay where they stood, also while the body turns round (spin): its stance is never re-mirrored.
  const rest = getRestContacts(rig, config, origin);
  const result: Record<PartId, Pose[PartId]> = { ...keyed };
  const reports: Record<string, LegReport> = {};
  for (const [key, leg] of Object.entries(config.legs)) {
    const chain = chainFor(rig, leg, transforms);
    const keyedAngles: LegAngles = {
      thigh: keyed[leg.thigh]?.rotation ?? 0,
      shin: keyed[leg.shin]?.rotation ?? 0,
      foot: keyed[leg.foot]?.rotation ?? 0,
    };
    const share = (key === config.plantWhenForward ? lean : 0) + (key === config.plantWhenBack ? 1 - lean : 0);
    // Planting holds through the spin's turn: squashed legs keep their length, and the knee only
    // changes side as scaleX crosses 0, when the leg is drawn with no width.
    const weight = clamp01(share) * grounded;
    let angles = keyedAngles;
    let mode: FootMode = "free";
    let roll = 0;
    let clamped = false;
    if (weight > 0) {
      const planted = plantLeg(chain, rest.get(key)!.sole, config);
      angles = {
        thigh: keyedAngles.thigh + weight * wrapAngle((planted.angles.thigh - keyedAngles.thigh) * DEG) / DEG,
        shin: keyedAngles.shin + weight * wrapAngle((planted.angles.shin - keyedAngles.shin) * DEG) / DEG,
        foot: keyedAngles.foot + weight * wrapAngle((planted.angles.foot - keyedAngles.foot) * DEG) / DEG,
      };
      ({ mode, roll, clamped } = planted);
    }
    // Ground guard: a grounded foot never ends below where it stood.
    let lifted = 0;
    const guard = grounded;
    if (guard > 0) {
      const points = forward(chain, angles);
      const sink = Math.max(points.heel.y, points.toe.y, points.sole.y) - rest.get(key)!.ground;
      if (sink > 0.01) {
        lifted = sink * guard;
        const raised = solveLeg(chain, { x: points.ankle.x, y: points.ankle.y - lifted }, points.footWorld);
        angles = raised.angles;
        clamped ||= raised.clamped;
      }
    }
    result[leg.thigh] = { ...keyed[leg.thigh], rotation: angles.thigh };
    result[leg.shin] = { ...keyed[leg.shin], rotation: angles.shin };
    result[leg.foot] = { ...keyed[leg.foot], rotation: angles.foot };
    reports[key] = { mode, weight, roll, clamped, kneeBend: kneeBend(chain, angles), lifted };
  }
  return { pose: result, legs: reports };
}

/** Heel, toe and sole world positions of every leg for a solved pose (for measurements). */
export function getContactPoints(rig: RigDefinition, config: LegIkConfig, pose: Pose, origin: Vec2): Map<string, { heel: Vec2; toe: Vec2; sole: Vec2 }> {
  const transforms = computeWorldTransforms(rig, pose, origin);
  return new Map(Object.entries(config.legs).map(([key, leg]) => {
    const chain = chainFor(rig, leg, transforms);
    const points = forward(chain, {
      thigh: pose[leg.thigh]?.rotation ?? 0,
      shin: pose[leg.shin]?.rotation ?? 0,
      foot: pose[leg.foot]?.rotation ?? 0,
    });
    return [key, { heel: points.heel, toe: points.toe, sole: points.sole }];
  }));
}
