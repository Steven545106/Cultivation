import Phaser from "phaser";
import type { WeaponConfig } from "./WeaponConfig";

export interface BladeSegment { base: Phaser.Math.Vector2; tip: Phaser.Math.Vector2; }

/** Depths of the weapon sprite and the effects that copy it. */
export interface WeaponDepths {
  readonly sprite: number;
  readonly glow: number;
  readonly afterimage: number;
  readonly echo: number;
}

/** Over the whole body (V1): sprite 8, its +11 halo just under it, afterimages under that. */
export const FRONT_WEAPON_DEPTHS: WeaponDepths = { sprite: 8, glow: 7.9, afterimage: 7.5, echo: 7.4 };

/** The same stack at another sprite depth, squeezed tenfold to fit the narrow gap under the head. */
export function tuckedWeaponDepths(sprite: number): WeaponDepths {
  return { sprite, glow: sprite - 0.01, afterimage: sprite - 0.05, echo: sprite - 0.06 };
}

/** Alpha at which a sword pixel counts as drawn, and the row/column step of the scan. */
const VISIBLE_ALPHA = 64;
const HULL_SCAN_STEP = 8;
const hullCache = new Map<string, readonly { x: number; y: number }[]>();

/** Convex hull (0–1 image coordinates) of a texture's visible pixels, computed once per texture. */
export function visibleHull(texture: Phaser.Textures.Texture): readonly { x: number; y: number }[] {
  const cached = hullCache.get(texture.key);
  if (cached) return cached;
  const source = texture.getSourceImage() as HTMLImageElement;
  const { width, height } = source;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(source, 0, 0);
  const alpha = context.getImageData(0, 0, width, height).data;
  // The leftmost and rightmost drawn pixel of every scanned row bound the hull.
  const points: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y += HULL_SCAN_STEP) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x += 1) {
      if (alpha[(y * width + x) * 4 + 3] < VISIBLE_ALPHA) continue;
      if (left < 0) left = x;
      right = x;
    }
    if (left >= 0) points.push({ x: left / width, y: y / height }, { x: (right + 1) / width, y: y / height });
  }
  const hull = points.length >= 3 ? convexHull(points) : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  hullCache.set(texture.key, hull);
  return hull;
}

/** Andrew's monotone chain. */
function convexHull(points: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (input: readonly { x: number; y: number }[]) => {
    const chain: { x: number; y: number }[] = [];
    for (const point of input) {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0) chain.pop();
      chain.push(point);
    }
    chain.pop();
    return chain;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** Enough of the weapon sprite's transform to draw an afterimage copy of it. */
export interface WeaponSpriteState {
  readonly textureKey: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly originX: number;
  readonly originY: number;
  readonly scale: number;
  readonly depths: WeaponDepths;
}

/** Positions a weapon by its configured grip point, never by its image centre. */
export class WeaponAttachmentController {
  private readonly sprite: Phaser.GameObjects.Image;
  private weapon?: WeaponConfig;
  private depths = FRONT_WEAPON_DEPTHS;

  public constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.image(0, 0, "__DEFAULT").setVisible(false).setDepth(FRONT_WEAPON_DEPTHS.sprite);
  }

  public equip(weapon: WeaponConfig): void {
    this.weapon = weapon;
    this.sprite.setTexture(weapon.spriteKey).setOrigin(weapon.gripPoint.x, weapon.gripPoint.y).setScale(weapon.displayScale).setVisible(true);
  }

  public sync(hand: Phaser.Math.Vector2, bladeAngle: number): BladeSegment {
    if (!this.weapon) throw new Error("Weapon must be equipped before syncing its attachment.");
    const rotation = Phaser.Math.DegToRad(bladeAngle + this.weapon.rotationOffset - 90);
    this.sprite.setPosition(hand.x, hand.y).setRotation(rotation);
    return { base: this.pointWorld(this.weapon.bladeGeometry.bladeStart, hand, rotation), tip: this.pointWorld(this.weapon.bladeGeometry.tip, hand, rotation) };
  }

  /** Draw order only; position, blade segment and hits are untouched. */
  public setDepths(depths: WeaponDepths): void {
    this.depths = depths;
    this.sprite.setDepth(depths.sprite);
  }

  /** Rig lab only: hides the equipped sword to measure what it covers. */
  public setVisible(visible: boolean): void {
    this.sprite.setVisible(visible && this.weapon !== undefined);
  }

  /**
   * The drawn sword's outline in world space, for layering tests: the convex
   * hull of its visible pixels. The images carry wide transparent margins, so
   * the image rectangle would reach the head from almost any pose.
   */
  public getOutline(): Phaser.Math.Vector2[] {
    if (!this.weapon) return [];
    const hand = new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
    return visibleHull(this.sprite.texture).map(point => this.pointWorld(point, hand, this.sprite.rotation));
  }

  public getSpriteState(): WeaponSpriteState {
    const sprite = this.sprite;
    return { textureKey: sprite.texture.key, x: sprite.x, y: sprite.y, rotation: sprite.rotation, originX: sprite.originX, originY: sprite.originY, scale: sprite.scaleX, depths: this.depths };
  }

  private pointWorld(point: { x: number; y: number }, hand: Phaser.Math.Vector2, rotation: number): Phaser.Math.Vector2 {
    const source = this.sprite.texture.getSourceImage() as HTMLImageElement;
    const weapon = this.weapon!;
    const localX = (point.x - weapon.gripPoint.x) * source.width * weapon.displayScale;
    const localY = (point.y - weapon.gripPoint.y) * source.height * weapon.displayScale;
    return new Phaser.Math.Vector2(hand.x + localX * Math.cos(rotation) - localY * Math.sin(rotation), hand.y + localX * Math.sin(rotation) + localY * Math.cos(rotation));
  }
}
