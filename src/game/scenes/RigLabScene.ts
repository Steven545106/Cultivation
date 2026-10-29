import Phaser from "phaser";
import { comboSets, createAttackPlan, getComboMoves, samplePhaseAngle, type ComboMove, type ComboMoveId } from "../../features/combat";
import { labPoses, type AttackClipPhase, type LabPoseId, type LegReport, type RigDefinition, type WeaponLayer } from "../../features/character";
import { weaponCatalog, type WeaponConfig } from "../../features/weapon";
import { BaiXiaochun } from "../characters/BaiXiaochun";
import { applyWeaponCalibration } from "../weapons/WeaponCalibration";
import { WeaponAttachmentController } from "../weapons/WeaponAttachmentController";
import { loadRig, PLAYER, PLAZA_WEAPON_SCALE, preloadRig, type RigSource } from "./battleLayout";

/** One frozen frame of the hero: a sword, and either rest/idle or a point inside an attack clip. */
export interface RigLabPose {
  readonly weaponId: string;
  /** Attack clip to sample; omitted = standing at rest (idle breathing at `idleSeconds`). */
  readonly clip?: ComboMoveId;
  readonly phase?: AttackClipPhase;
  readonly progress?: number;
  readonly idleSeconds?: number;
  /** A test pose that is not an attack clip (e.g. "squat"); ignored when `clip` is set. */
  readonly labPose?: LabPoseId;
  /** Forces these parts' local rotations (degrees) after planting, e.g. to sweep a knee through 0–110°. */
  readonly joints?: Readonly<Record<string, { readonly rotation: number }>>;
  /** Draws only these parts (no sword), e.g. one leg on the plain background to look for holes. */
  readonly onlyParts?: readonly string[];
  /** Pure green background and no guides: green appears nowhere in the art, so any green inside a part is a hole. */
  readonly plainBackground?: boolean;
  /** Before/after checks: always draw the sword over the body, as V1 did. */
  readonly v1Layers?: boolean;
}

/** The blade as placed this frame (world px), to compare sword paths between rigs. */
export interface RigLabBlade {
  readonly base: { readonly x: number; readonly y: number };
  readonly tip: { readonly x: number; readonly y: number };
}

/** How much of the face the sword and fist cover in one frame. */
export interface FaceCoverage {
  /** Where the sword was drawn: over the body, or tucked behind the head. */
  readonly layer: WeaponLayer;
  /** Turned round: the face is not visible, so `coverage` is 0. */
  readonly back: boolean;
  /** Share (0–1) of face sample points whose colour changes when the sword and fist are hidden. */
  readonly coverage: number;
}

export interface RigLabApi {
  readonly clips: readonly ComboMoveId[];
  readonly weaponIds: readonly string[];
  /** Which rig is shown: "v1" (V1.1, the battle's) or "v2-leg" (jointed-leg prototype). */
  readonly rig: RigLabRig;
  /** "draft": the auto-split draft leg images; "shapes": coloured placeholder shapes (V2-Leg only). */
  readonly legs: RigLabLegs;
  show(pose: RigLabPose): WeaponLayer;
  /** Renders the pose with and without the sword and fist and compares the face pixels. */
  faceCoverage(pose: RigLabPose): Promise<FaceCoverage>;
  /** The blade of the last `show`. */
  blade(): RigLabBlade;
  /** How each jointed leg was planted in the last `show` (V2-Leg only). */
  legReports(): Readonly<Record<string, LegReport>>;
  /** Shows the pose on the plain background and counts holes in what is drawn (see PartHoles). */
  holes(pose: RigLabPose): Promise<PartHoles>;
}

/** Holes in the drawn parts, found on the plain green background. */
export interface PartHoles {
  /** Opaque art pixels drawn. */
  readonly drawn: number;
  /** Background pixels enclosed by art (cannot be reached from outside it). */
  readonly enclosed: number;
  /** Art pixels away from the outer edge that let the green show through (semi-transparent seams). */
  readonly seeThrough: number;
  /** Up to 12 enclosed pixels, canvas px, to find them. */
  readonly where: readonly (readonly [number, number])[];
}

/**
 * "v2-leg-front": V2-Leg with the repaired front-leg candidates (tools/repair_front_leg.py);
 * "v2-leg-full": both legs as candidates (tools/build_back_leg.py);
 * "v2-leg-ai-back": as v2-leg-full with the AI-generated back leg (tools/build_ai_back_leg.py).
 */
export type RigLabRig = "v1" | "v2-leg" | "v2-leg-front" | "v2-leg-full" | "v2-leg-ai-back";
export type RigLabLegs = "draft" | "shapes";

/**
 * Picked by the page URL, e.g. /dev/rig-lab?rig=v2-leg&legs=shapes. The
 * battle never reads these: it always loads V1.1 (battleLayout defaults).
 */
const RIG_SOURCES: Readonly<Record<RigLabRig, RigSource | undefined>> = {
  v1: undefined,
  "v2-leg": { key: "bai-rig-v2-leg", path: "/assets/player/rig-v2-leg/bai-rig-v2-leg.json" },
  "v2-leg-front": { key: "bai-rig-v2-leg-front", path: "/assets/player/rig-v2-leg/bai-rig-v2-leg-front.json" },
  "v2-leg-full": { key: "bai-rig-v2-leg-full", path: "/assets/player/rig-v2-leg/bai-rig-v2-leg-full.json" },
  "v2-leg-ai-back": { key: "bai-rig-v2-leg-ai-back", path: "/assets/player/rig-v2-leg/bai-rig-v2-leg-ai-back.json" },
};

/** Placeholder colours: they mark joints and segments only and are never character art. */
const SHAPE_COLOURS = { thigh: "#4a7dff", shin: "#3fbf7f", foot: "#ff9a3c", knee: "#ffd84a" } as const;

declare global {
  interface Window {
    __rigLab?: RigLabApi;
  }
}

const GROUND_Y = PLAYER.y + 88;
const NO_CALIBRATION = { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };

/** The face (skin, eyes, mouth) in the front head image's pixels, as an ellipse. */
const FACE = { x: 248, y: 340, rx: 112, ry: 88 };
/** Face sample spacing in head-image pixels, and the colour change (summed RGB) that counts as covered. */
const FACE_STEP = 6;
const COVER_THRESHOLD = 36;

const ALL_CLIPS: readonly ComboMoveId[] = ["cleave", "backhand", "spin", "rising", "leap", "thrust", "thrustLow", "thrustRise", "thrustBurst"];

/** The weapon type's own version of a move, falling back to any combo set that has it. */
function findMove(weapon: WeaponConfig, clip: ComboMoveId): ComboMove {
  return getComboMoves(weapon.weaponType).find(move => move.id === clip)
    ?? Object.values(comboSets).flat().find(move => move.id === clip)!;
}

/**
 * Developer rig lab (/dev/rig-lab): the real hero, rig and weapon attachment
 * at the battle's layout, frozen at any rest/idle or attack-clip frame through
 * `window.__rigLab.show`, for screenshot comparisons. No battle, timers or
 * springs run, so every frame is deterministic.
 */
export class RigLabScene extends Phaser.Scene {
  private hero!: BaiXiaochun;
  private attachment!: WeaponAttachmentController;
  private lastBlade: RigLabBlade = { base: { x: 0, y: 0 }, tip: { x: 0, y: 0 } };
  private readonly rigChoice: RigLabRig;
  private readonly legsChoice: RigLabLegs;

  public constructor() {
    super("RigLabScene");
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    const rig = params.get("rig");
    const known: readonly RigLabRig[] = ["v2-leg", "v2-leg-front", "v2-leg-full", "v2-leg-ai-back"];
    this.rigChoice = known.includes(rig as RigLabRig) ? rig as RigLabRig : "v1";
    this.legsChoice = params.get("legs") === "shapes" ? "shapes" : "draft";
  }

  public preload(): void {
    this.load.image("bai-xiaochun", "/assets/player/cultivator-chibi.webp");
    preloadRig(this, RIG_SOURCES[this.rigChoice]);
    weaponCatalog.forEach(weapon => this.load.image(weapon.spriteKey, weapon.assetPath));
  }

  public create(): void {
    this.cameras.main.setZoom(1.5).setScroll(-320, -180).setBackgroundColor("#26324a");
    this.drawGuides();
    const rig = loadRig(this, RIG_SOURCES[this.rigChoice]);
    if (!rig) throw new Error(`Rig lab: the ${this.rigChoice} rig failed to load.`);
    if (rig.legIk && this.legsChoice === "shapes") this.useLegShapes(rig);
    this.hero = new BaiXiaochun(this, PLAYER, rig, null, false);
    this.attachment = new WeaponAttachmentController(this);
    window.__rigLab = {
      clips: ALL_CLIPS,
      weaponIds: weaponCatalog.map(weapon => weapon.weaponId),
      rig: this.rigChoice,
      legs: this.legsChoice,
      show: pose => this.show(pose),
      faceCoverage: pose => this.faceCoverage(pose),
      blade: () => this.lastBlade,
      legReports: () => this.hero.getLegReports(),
      holes: pose => this.holes(pose),
    };
    this.show({ weaponId: weaponCatalog[0].weaponId });
  }

  /**
   * Swaps the jointed legs' images for flat coloured shapes of the same size
   * and joints: a capsule per bone, the foot as heel–toe–ankle, a dot at the
   * knee. They check joints, steps and IK only; they are not character art.
   */
  private useLegShapes(rig: RigDefinition): void {
    const part = (id: string) => rig.parts.find(candidate => candidate.id === id)!;
    for (const leg of Object.values(rig.legIk!.legs)) {
      const thigh = part(leg.thigh);
      const shin = part(leg.shin);
      const foot = part(leg.foot);
      const knee = rig.parts.find(candidate => candidate.parent === leg.shin && candidate.id !== leg.foot);
      const draw = (key: string, paint: (context: CanvasRenderingContext2D) => void) => {
        const source = this.textures.get(key).getSourceImage() as HTMLImageElement;
        const canvas = document.createElement("canvas");
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext("2d")!;
        context.lineCap = "round";
        context.lineJoin = "round";
        paint(context);
        this.textures.remove(key);
        this.textures.addCanvas(key, canvas);
      };
      const bone = (context: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, width: number, colour: string) => {
        context.strokeStyle = "#10141f";
        context.lineWidth = width + 6;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
        context.strokeStyle = colour;
        context.lineWidth = width;
        context.stroke();
      };
      draw(thigh.texture, context => bone(context, thigh.pivot, shin.anchor, 46, SHAPE_COLOURS.thigh));
      draw(shin.texture, context => bone(context, shin.pivot, foot.anchor, 34, SHAPE_COLOURS.shin));
      draw(foot.texture, context => {
        context.fillStyle = SHAPE_COLOURS.foot;
        context.strokeStyle = "#10141f";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(foot.pivot.x, foot.pivot.y);
        context.lineTo(leg.toe.x, leg.toe.y);
        context.lineTo(leg.heel.x, leg.heel.y);
        context.closePath();
        context.fill();
        context.stroke();
      });
      if (knee) {
        draw(knee.texture, context => {
          context.fillStyle = SHAPE_COLOURS.knee;
          context.strokeStyle = "#10141f";
          context.lineWidth = 3;
          context.beginPath();
          context.arc(knee.pivot.x, knee.pivot.y, 14, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        });
      }
    }
  }

  private show(pose: RigLabPose): WeaponLayer {
    const base = weaponCatalog.find(weapon => weapon.weaponId === pose.weaponId) ?? weaponCatalog[0];
    const weapon = applyWeaponCalibration(base, NO_CALIBRATION, PLAZA_WEAPON_SCALE);
    this.attachment.equip(weapon);
    this.hero.resetPose();
    this.hero.setJointOverride(pose.joints ?? {});
    this.hero.update(pose.idleSeconds ?? 0, 0);
    let angle = weapon.socketOffset.rotation;
    if (pose.clip) {
      const plan = createAttackPlan(weapon, weapon.attackSpeed, findMove(weapon, pose.clip));
      const phase = pose.phase ?? "swing";
      const progress = Math.min(1, Math.max(0, pose.progress ?? 0));
      this.hero.setAttackPhase(plan.clip, phase, progress);
      angle = samplePhaseAngle(plan[phase], progress);
    } else if (pose.labPose) {
      this.hero.setBodyPose(labPoses[pose.labPose]);
    }
    this.hero.setBladeOffset(angle - weapon.socketOffset.rotation);
    this.hero.setBladeDirection(angle + weapon.rotationOffset);
    const segment = this.attachment.sync(this.hero.getHand(weapon.socketOffset), angle);
    this.lastBlade = { base: { x: segment.base.x, y: segment.base.y }, tip: { x: segment.tip.x, y: segment.tip.y } };
    const layer = this.hero.layerWeapon(this.attachment, pose.v1Layers ? "front" : undefined);
    const only = pose.onlyParts;
    this.hero.setPartsHidden(only ? this.hero.partIds().filter(id => !only.includes(id)) : []);
    this.attachment.setVisible(!only);
    this.cameras.main.setBackgroundColor(pose.plainBackground ? "#00ff00" : "#26324a");
    this.guides.setVisible(!pose.plainBackground);
    return layer;
  }

  private async faceCoverage(pose: RigLabPose): Promise<FaceCoverage> {
    const layer = this.show(pose);
    const back = this.hero.showsBack("head");
    if (back) return { layer, back, coverage: 0 };
    const samples = this.faceSamples();
    if (samples.length === 0) throw new Error("No face sample points: check FACE against the head image.");
    const withSword = await this.readPixels(samples);
    this.hero.setPartsHidden(["fist_front"]);
    this.attachment.setVisible(false);
    const without = await this.readPixels(samples);
    this.hero.setPartsHidden([]);
    this.attachment.setVisible(true);
    let covered = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const offset = index * 3;
      const change = Math.abs(withSword[offset] - without[offset]) + Math.abs(withSword[offset + 1] - without[offset + 1]) + Math.abs(withSword[offset + 2] - without[offset + 2]);
      if (change > COVER_THRESHOLD) covered += 1;
    }
    return { layer, back, coverage: covered / samples.length };
  }

  /**
   * Face ellipse sample points, in canvas pixels. Only points where the head
   * image is opaque for FACE_STEP around count: at its see-through edges
   * a sword behind the head rightly shows through.
   */
  private faceSamples(): { x: number; y: number }[] {
    const view = this.cameras.main.worldView;
    const zoom = this.cameras.main.zoom;
    const alpha = this.headAlpha();
    const opaque = (x: number, y: number) => alpha.data[(Math.round(y) * alpha.width + Math.round(x)) * 4 + 3] >= 250;
    const points: { x: number; y: number }[] = [];
    for (let y = FACE.y - FACE.ry; y <= FACE.y + FACE.ry; y += FACE_STEP) {
      for (let x = FACE.x - FACE.rx; x <= FACE.x + FACE.rx; x += FACE_STEP) {
        if (((x - FACE.x) / FACE.rx) ** 2 + ((y - FACE.y) / FACE.ry) ** 2 > 1) continue;
        if (![[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => opaque(x + dx * FACE_STEP, y + dy * FACE_STEP))) continue;
        const world = this.hero.partPoint("head", { x, y });
        points.push({ x: Math.round((world.x - view.x) * zoom), y: Math.round((world.y - view.y) * zoom) });
      }
    }
    return points;
  }

  private async holes(pose: RigLabPose): Promise<PartHoles> {
    this.show({ ...pose, plainBackground: true });
    for (let frame = 0; frame < 2; frame += 1) await new Promise(resolve => this.game.events.once(Phaser.Core.Events.POST_RENDER, resolve));
    const canvas = this.game.canvas;
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(canvas, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, copy.width, copy.height);
    // Green: the background, or art blended with it. Pure background is green with almost no red or blue.
    const green = (index: number) => data[index * 4 + 1] - Math.max(data[index * 4], data[index * 4 + 2]) > 60;
    const background = (index: number) => data[index * 4 + 1] > 200 && data[index * 4] < 40 && data[index * 4 + 2] < 40;
    // Flood the background in from the canvas edge; whatever green it cannot reach is enclosed by art.
    const reached = new Uint8Array(width * height);
    const stack: number[] = [];
    for (let x = 0; x < width; x += 1) stack.push(x, (height - 1) * width + x);
    for (let y = 0; y < height; y += 1) stack.push(y * width, y * width + width - 1);
    while (stack.length > 0) {
      const index = stack.pop()!;
      if (reached[index] || !background(index)) continue;
      reached[index] = 1;
      const x = index % width;
      if (x > 0) stack.push(index - 1);
      if (x < width - 1) stack.push(index + 1);
      if (index >= width) stack.push(index - width);
      if (index < width * (height - 1)) stack.push(index + width);
    }
    let drawn = 0;
    let enclosed = 0;
    let seeThrough = 0;
    const where: [number, number][] = [];
    for (let index = 0; index < width * height; index += 1) {
      if (reached[index]) continue;
      if (background(index)) {
        enclosed += 1;
        if (where.length < 12) where.push([index % width, Math.floor(index / width)]);
        continue;
      }
      drawn += 1;
      // Green tint inside the art, at least 3px from any reached background (outer antialiasing is fine).
      if (!green(index)) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      let nearEdge = false;
      for (let dy = -3; dy <= 3 && !nearEdge; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && reached[ny * width + nx]) {
            nearEdge = true;
            break;
          }
        }
      }
      if (!nearEdge) seeThrough += 1;
    }
    return { drawn, enclosed, seeThrough, where };
  }

  private headAlphaCache: ImageData | null = null;

  /** The front head image's pixels, read once. */
  private headAlpha(): ImageData {
    if (this.headAlphaCache) return this.headAlphaCache;
    const source = this.textures.get("bai-part-head").getSourceImage() as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(source, 0, 0);
    this.headAlphaCache = context.getImageData(0, 0, source.width, source.height);
    return this.headAlphaCache;
  }

  /** RGB of each point after the next frame is drawn (the lab's canvas keeps its drawing buffer). */
  private async readPixels(points: readonly { x: number; y: number }[]): Promise<Uint8ClampedArray> {
    for (let frame = 0; frame < 2; frame += 1) await new Promise(resolve => this.game.events.once(Phaser.Core.Events.POST_RENDER, resolve));
    const canvas = this.game.canvas;
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const result = new Uint8ClampedArray(points.length * 3);
    points.forEach((point, index) => {
      const source = (point.y * copy.width + point.x) * 4;
      result.set(pixels.subarray(source, source + 3), index * 3);
    });
    return result;
  }

  /** Ground line and a 20px grid around the hero, to read foot sliding between frames. */
  private guides!: Phaser.GameObjects.Graphics;

  private drawGuides(): void {
    const guides = this.add.graphics().setDepth(0);
    this.guides = guides;
    guides.lineStyle(1, 0xffffff, 0.12);
    for (let x = PLAYER.x - 260; x <= PLAYER.x + 300; x += 20) guides.lineBetween(x, PLAYER.y - 200, x, GROUND_Y + 30);
    guides.lineStyle(2, 0xffe49a, 0.55);
    guides.lineBetween(PLAYER.x - 260, GROUND_Y, PLAYER.x + 300, GROUND_Y);
  }
}
