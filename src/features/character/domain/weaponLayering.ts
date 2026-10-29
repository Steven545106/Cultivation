import { partView, type PartId, type RigDefinition, type Vec2, type WorldTransform } from "./CutoutRig";

/**
 * When the sword may pass behind a part (the head). The sword hand is the far
 * arm in this three-quarter view, so a blade raised past the head belongs
 * behind it; elsewhere the sword keeps its usual place over the body.
 */
export interface WeaponLayering {
  /** The part the weapon passes behind. */
  readonly occluder: PartId;
  /** Ellipse covering the occluder's opaque area, in its front image's pixels. */
  readonly zone: { readonly x: number; readonly y: number; readonly rx: number; readonly ry: number };
  /** Depths while behind: the weapon sprite, and parts drawn with it (the fist). */
  readonly behind: { readonly weapon: number; readonly parts: Readonly<Record<PartId, number>> };
}

/** "front": the rig's own depths (V1). "behind": the weapon and fist tuck under the occluder. */
export type WeaponLayer = "front" | "behind";

/** A world point in a part's image pixels (inverse of partPointToWorld). */
function worldToPart(rig: RigDefinition, transforms: Map<PartId, WorldTransform>, partId: PartId, point: Vec2): Vec2 {
  const part = rig.parts.find(candidate => candidate.id === partId)!;
  const transform = transforms.get(partId)!;
  const pivot = partView(part, transform.back).pivot;
  const dx = point.x - transform.x;
  const dy = point.y - transform.y;
  const cos = Math.cos(-transform.rotation);
  const sin = Math.sin(-transform.rotation);
  return {
    x: (dx * cos - dy * sin) / transform.scaleX + pivot.x,
    y: (dx * sin + dy * cos) / transform.scaleY + pivot.y,
  };
}

function segmentDistanceToOrigin(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, -(a.x * dx + a.y * dy) / lengthSq));
  return Math.hypot(a.x + dx * t, a.y + dy * t);
}

function containsOrigin(polygon: readonly Vec2[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    if ((a.y > 0) !== (b.y > 0) && 0 < (b.x - a.x) * (0 - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Whether a world-space outline (the weapon sprite's and fist's bounding
 * quads) overlaps the occluder's zone ellipse. Tested in the ellipse's unit
 * space, where the zone is the unit circle and the outline stays a polygon.
 */
export function overlapsOccluder(rig: RigDefinition, layering: WeaponLayering, transforms: Map<PartId, WorldTransform>, outline: readonly Vec2[]): boolean {
  const { zone } = layering;
  const unit = outline.map(point => {
    const local = worldToPart(rig, transforms, layering.occluder, point);
    return { x: (local.x - zone.x) / zone.rx, y: (local.y - zone.y) / zone.ry };
  });
  if (containsOrigin(unit)) return true;
  return unit.some((point, index) => segmentDistanceToOrigin(point, unit[(index + 1) % unit.length]) <= 1);
}

/**
 * Behind only while the weapon actually overlaps the occluder seen from the
 * front, not by blade angle alone: of the body, only the head lies between the
 * two depths, so the switch cannot pop anywhere the sword is not over the head.
 * Away from the head the sword stays over the body, the monster and the swing
 * effects exactly as before. The back view keeps V1.
 */
export function chooseWeaponLayer(rig: RigDefinition, transforms: Map<PartId, WorldTransform>, outlines: readonly (readonly Vec2[])[]): WeaponLayer {
  const layering = rig.weaponLayering;
  if (!layering) return "front";
  if (transforms.get(layering.occluder)?.back ?? true) return "front";
  return outlines.some(outline => overlapsOccluder(rig, layering, transforms, outline)) ? "behind" : "front";
}
