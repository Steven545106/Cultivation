import Phaser from "phaser";
import {
  addPoses,
  computeWorldTransforms,
  idlePose,
  lockedArmRotation,
  orderParts,
  getSoleWorldPositions,
  plantFeet,
  partPointToWorld,
  partView,
  sampleAttackClip,
  stepSpring,
  attackClips,
  chooseWeaponLayer,
  plantLegsIk,
  type AttackClipPhase,
  type LegReport,
  type Pose,
  type RigDefinition,
  type SpringState,
  type Vec2,
  type WeaponLayer,
} from "../../features/character";
import type { ComboMoveId } from "../../features/combat";
import { FRONT_WEAPON_DEPTHS, tuckedWeaponDepths, visibleHull, type WeaponAttachmentController } from "../weapons/WeaponAttachmentController";
import type { WeaponSocketOffset } from "../weapons/WeaponConfig";

export interface CalibrationOffset {
  readonly x: number;
  readonly y: number;
}

const BASE_SOCKET_SCALE = 0.42;
const LEGACY_DISPLAY_SCALE = 0.23;
const RAD_TO_DEG = 180 / Math.PI;
/** Degrees of extra trail per world px/s of body speed, for hair and cloth. */
const SPEED_DRAG = 0.035;
const MAX_SPEED_DRAG = 18;
const AFTERIMAGE_TINT = 0x9fd8ff;
const AFTERIMAGE_FADE_MS = 240;
/** Shadow width/alpha at rest; it shrinks and fades as the body rises. */
const SHADOW_ALPHA = 0.2;

/**
 * Bai Xiaochun's battle body. With a rig manifest it is a cutout puppet: each
 * part is its own image, keyframed attack clips drive the whole body, the
 * weapon arm follows the blade, and flagged parts (hair, sleeves, hems) sway
 * on springs. Without one it falls back to the single flattened PNG.
 */
export class BaiXiaochun {
  private readonly legacy: Phaser.GameObjects.Image | null = null;
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  private readonly springs = new Map<string, SpringState>();
  /** Where each sole touches the ground at rest; planted feet are held there during lunges. */
  private restSoles: ReadonlyMap<string, { readonly x: number; readonly y: number }> = new Map();
  /** Which view (back = turned round) each part image currently shows. */
  private readonly showingBack = new Map<string, boolean>();
  private clipPose: Pose = {};
  private armAngle = 0;
  /** World blade direction (degrees) for rigs that lock the arm to the blade. */
  private bladeDirection: number | null = null;
  private timeSeconds = 0;
  private rootX: number | null = null;
  private rootSpeed = 0;
  private lastPhase: AttackClipPhase | null = null;
  private lastAfterimageAt = Number.NEGATIVE_INFINITY;
  /** "behind" while the sword crosses the head: it and the fist draw under the head. */
  private weaponLayer: WeaponLayer = "front";
  /** Parts the rig lab hides to measure what they cover. */
  private readonly hiddenParts = new Set<string>();
  /** How each jointed leg was solved on the last pose (V2-Leg rigs only). */
  private legReports: Readonly<Record<string, LegReport>> = {};
  /** Rig lab only: part rotations forced after planting, to sweep joints through set angles. */
  private jointOverride: Pose = {};
  private readonly reducedMotion = typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly position: Phaser.Math.Vector2,
    private readonly rig: RigDefinition | null,
    private readonly shadow: Phaser.GameObjects.Ellipse | null = null,
    /** Whole-body ghosts during swings; off in the rig lab so frozen frames stay clean. */
    private readonly afterimages = true,
  ) {
    if (!rig) {
      // Legacy single PNG: the shadow stays put.
      this.legacy = scene.add.image(position.x, position.y, "bai-xiaochun").setScale(LEGACY_DISPLAY_SCALE).setOrigin(0.5, 0.62).setDepth(5);
      return;
    }
    for (const part of orderParts(rig)) {
      const image = scene.add.image(0, 0, part.texture).setDepth(part.depth);
      image.setOrigin(part.pivot.x / image.width, part.pivot.y / image.height);
      this.images.set(part.id, image);
      this.showingBack.set(part.id, false);
    }
    if (rig.footPlant) this.restSoles = getSoleWorldPositions(rig, rig.footPlant, {}, position);
    this.render(0);
  }

  public get isRigged(): boolean {
    return this.rig !== null;
  }

  /** Per-frame: idle breathing and spring-driven secondary motion. */
  public update(timeSeconds: number, deltaMs: number): void {
    this.timeSeconds = timeSeconds;
    if (this.rig) this.render(deltaMs / 1000);
  }

  /** Drives the whole body from the attack clip for this phase and progress. */
  public setAttackPhase(clip: ComboMoveId, phase: AttackClipPhase, progress: number): void {
    if (!this.rig) return;
    this.clipPose = sampleAttackClip(attackClips[clip], phase, progress);
    this.render(0);
    // Whole-body ghosts trail the lunge: one as the swing starts, then every 45ms until it lands.
    const now = this.scene.time.now;
    if (this.afterimages && phase === "swing" && progress < 0.6 && (this.lastPhase !== "swing" || now - this.lastAfterimageAt >= 45)) {
      this.lastAfterimageAt = now;
      this.spawnAfterimage();
    }
    this.lastPhase = phase;
  }

  /** Legacy single-PNG body shift; the rig's clips replace it. */
  public setAttackWeight(amount: number): void {
    this.legacy?.setPosition(this.position.x + amount * 18, this.position.y - Math.abs(amount) * 8);
  }

  /** The blade's rotation away from its rest angle (degrees); the weapon arm follows part of it. */
  public setBladeOffset(degrees: number): void {
    if (!this.rig) return;
    const { ratio, min, max } = this.rig.armFollow;
    this.armAngle = Phaser.Math.Clamp(degrees * ratio, min, max);
    this.render(0);
  }

  /** World direction the blade points (degrees, clockwise from +x); drives a blade-locked arm. */
  public setBladeDirection(degrees: number): void {
    if (!this.rig?.bladeLock) return;
    this.bladeDirection = degrees;
    this.render(0);
  }

  /**
   * Where the weapon grip goes. Rigged: the fist, plus any live calibration
   * offset. Legacy: the weapon's socket offset from the body.
   */
  public getHand(socketOffset: WeaponSocketOffset, calibration: CalibrationOffset = { x: 0, y: 0 }): Phaser.Math.Vector2 {
    const socketScale = LEGACY_DISPLAY_SCALE / BASE_SOCKET_SCALE;
    if (!this.rig) {
      const body = this.legacy!;
      return new Phaser.Math.Vector2(body.x + socketOffset.x * socketScale, body.y + socketOffset.y * socketScale);
    }
    const transforms = computeWorldTransforms(this.rig, this.currentPose(), this.position);
    const grip = partPointToWorld(this.rig, transforms, this.rig.grip.part, this.rig.grip);
    return new Phaser.Math.Vector2(grip.x + calibration.x * socketScale, grip.y + calibration.y * socketScale);
  }

  /**
   * Call after the weapon is synced to the hand: tucks the sword and fist under
   * the head while either overlaps it (front view), else restores V1 depths.
   * Draw order only; the grip, blade segment and hits do not change.
   */
  public layerWeapon(attachment: WeaponAttachmentController, force?: WeaponLayer): WeaponLayer {
    const layering = this.rig?.weaponLayering;
    if (!layering) return "front";
    const transforms = computeWorldTransforms(this.rig!, this.currentPose(), this.position);
    const outlines = [attachment.getOutline(), ...Object.keys(layering.behind.parts).map(id => this.partOutline(transforms, id))];
    this.weaponLayer = force ?? chooseWeaponLayer(this.rig!, transforms, outlines);
    attachment.setDepths(this.weaponLayer === "behind" ? tuckedWeaponDepths(layering.behind.weapon) : FRONT_WEAPON_DEPTHS);
    for (const id of Object.keys(layering.behind.parts)) this.applyDepth(id);
    return this.weaponLayer;
  }

  /** Rig lab only: hides parts so a frame can be compared with and without them. */
  public setPartsHidden(ids: readonly string[]): void {
    this.hiddenParts.clear();
    ids.forEach(id => this.hiddenParts.add(id));
    for (const id of this.images.keys()) this.applyView(id, this.showingBack.get(id)!);
  }

  /** Rig lab only: holds the body in a test pose (e.g. a squat) as if it were an attack clip frame. */
  public setBodyPose(pose: Pose): void {
    if (!this.rig) return;
    this.clipPose = pose;
    this.render(0);
  }

  /** Rig lab only: forces these parts' local rotations (degrees) after planting; {} clears it. */
  public setJointOverride(pose: Pose): void {
    if (!this.rig) return;
    this.jointOverride = pose;
    this.render(0);
  }

  /** How each jointed leg was planted on the last pose; empty for one-piece legs. */
  public getLegReports(): Readonly<Record<string, LegReport>> {
    return this.legReports;
  }

  /** Every part id of the rig, parents first. */
  public partIds(): string[] {
    return [...this.images.keys()];
  }

  /** Whether a part currently shows its back view (the body turned round). */
  public showsBack(partId: string): boolean {
    return this.showingBack.get(partId) ?? false;
  }

  /** A point in a part's image pixels, in world space at the current pose (rig lab measurements). */
  public partPoint(partId: string, point: Vec2): Vec2 {
    if (!this.rig) throw new Error("Only a rigged hero has parts.");
    return partPointToWorld(this.rig, computeWorldTransforms(this.rig, this.currentPose(), this.position), partId, point);
  }

  public resetPose(): void {
    this.legacy?.setPosition(this.position.x, this.position.y);
    this.clipPose = {};
    this.armAngle = 0;
    this.lastPhase = null;
    if (this.rig) this.render(0);
  }

  /** Idle under the attack clip, feet planted on the ground, plus the blade-following arm. */
  private currentPose(): Pose {
    const rig = this.rig!;
    const keyed = addPoses(idlePose(this.timeSeconds), this.clipPose);
    // Legs only: the torso, arm and sword (so the blade path and hits) are unaffected.
    let body = keyed;
    if (rig.legIk) {
      const solved = plantLegsIk(rig, rig.legIk, keyed, this.position);
      body = solved.pose;
      this.legReports = solved.legs;
    } else if (rig.footPlant) {
      body = plantFeet(rig, rig.footPlant, keyed, this.position, this.restSoles);
    }
    if (Object.keys(this.jointOverride).length > 0) {
      body = { ...body, ...Object.fromEntries(Object.entries(this.jointOverride).map(([id, transform]) => [id, { ...body[id], ...transform }])) };
    }
    if (rig.bladeLock && this.bladeDirection !== null) {
      // Solve the arm against wherever the body has moved this frame.
      const parentId = rig.parts.find(part => part.id === rig.weaponArm)!.parent!;
      const parent = computeWorldTransforms(rig, body, this.position).get(parentId)!;
      const clipArm = body[rig.weaponArm]?.rotation ?? 0;
      return addPoses(body, { [rig.weaponArm]: { rotation: lockedArmRotation(rig, this.bladeDirection, parent.rotation, parent.scaleX < 0) - clipArm } });
    }
    return addPoses(body, { [rig.weaponArm]: { rotation: this.armAngle } });
  }

  private render(dtSeconds: number): void {
    const rig = this.rig!;
    let pose = this.currentPose();
    let transforms = computeWorldTransforms(rig, pose, this.position);
    const root = transforms.get(rig.parts.find(part => !part.parent)!.id)!;
    if (dtSeconds > 0) {
      const instant = this.rootX === null ? 0 : (root.x - this.rootX) / dtSeconds;
      this.rootSpeed += (instant - this.rootSpeed) * Math.min(1, dtSeconds * 20);
      this.rootX = root.x;
    }
    this.syncShadow(root.x, root.y);
    // Secondary parts keep their world angle for a moment and spring after their
    // parent, so hair and cloth trail the body instead of moving rigidly.
    const swaying = rig.parts.filter(part => part.secondary);
    if (swaying.length > 0) {
      const lag: Record<string, { rotation: number }> = {};
      for (const part of swaying) {
        // Moving forward swings trailing parts back (clockwise); the spring then lags and overshoots.
        const drag = Phaser.Math.Clamp(this.rootSpeed * SPEED_DRAG, -MAX_SPEED_DRAG, MAX_SPEED_DRAG);
        const target = transforms.get(part.id)!.rotation * RAD_TO_DEG + drag;
        const previous = this.springs.get(part.id) ?? { value: target, velocity: 0 };
        const next = dtSeconds > 0 ? stepSpring(previous, target, dtSeconds, part.secondary!) : previous;
        this.springs.set(part.id, next);
        lag[part.id] = { rotation: next.value - target + drag };
      }
      pose = addPoses(pose, lag);
      transforms = computeWorldTransforms(rig, pose, this.position);
    }
    for (const [id, transform] of transforms) {
      if (this.showingBack.get(id) !== transform.back) this.applyView(id, transform.back);
      this.images.get(id)!.setPosition(transform.x, transform.y).setRotation(transform.rotation).setScale(transform.scaleX, transform.scaleY);
    }
  }

  /** Swaps a part between its front and back image as the body turns round. */
  private applyView(id: string, back: boolean): void {
    const view = partView(this.rig!.parts.find(part => part.id === id)!, back);
    const image = this.images.get(id)!.setTexture(view.texture).setVisible(view.visible && !this.hiddenParts.has(id));
    image.setOrigin(view.pivot.x / image.width, view.pivot.y / image.height);
    this.showingBack.set(id, back);
    this.applyDepth(id);
  }

  /** The view's depth, or the tucked depth while the sword is behind the head. */
  private applyDepth(id: string): void {
    const view = partView(this.rig!.parts.find(part => part.id === id)!, this.showingBack.get(id)!);
    const tucked = this.weaponLayer === "behind" ? this.rig!.weaponLayering?.behind.parts[id] : undefined;
    this.images.get(id)!.setDepth(tucked ?? view.depth);
  }

  /** The outline of a part's visible pixels, in world space. */
  private partOutline(transforms: ReturnType<typeof computeWorldTransforms>, id: string): Vec2[] {
    const image = this.images.get(id)!;
    return visibleHull(image.texture).map(point => partPointToWorld(this.rig!, transforms, id, { x: point.x * image.width, y: point.y * image.height }));
  }

  /** Keeps the ground shadow under the hips; it narrows and fades as the body lifts. */
  private syncShadow(rootX: number, rootY: number): void {
    if (!this.shadow) return;
    const lift = Phaser.Math.Clamp((this.position.y - rootY) / 30, -0.4, 1);
    this.shadow.setPosition(rootX, this.position.y + 88).setScale(1 - lift * 0.2, 1 - lift * 0.2).setAlpha(SHADOW_ALPHA * (1 - lift * 0.4));
  }

  /** A tinted, additive copy of every part at its current pose, fading out. */
  private spawnAfterimage(): void {
    if (this.reducedMotion) return;
    for (const image of this.images.values()) {
      if (!image.visible) continue;
      const ghost = this.scene.add.image(image.x, image.y, image.texture.key)
        .setOrigin(image.originX, image.originY)
        .setRotation(image.rotation)
        .setScale(image.scaleX, image.scaleY)
        .setDepth(image.depth - 0.95)
        .setTint(AFTERIMAGE_TINT)
        .setAlpha(0.28)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: ghost, alpha: 0, duration: AFTERIMAGE_FADE_MS, ease: "Quad.easeOut", onComplete: () => ghost.destroy() });
    }
  }
}
