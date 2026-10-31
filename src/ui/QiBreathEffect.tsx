import { useEffect, useRef } from "react";
import { cyclePhase, easeInQuad, easeOutCubic, hash01, qiStage, smoothstep } from "./qiBreath";

export interface QiBreathLook {
  /** Where the qi gathers, as fractions of the box (the dantian, or the core between two palms). */
  readonly core: { readonly x: number; readonly y: number };
  /** Centres of the halos above heads, as fractions of the box. */
  readonly halos: readonly { readonly x: number; readonly y: number }[];
  /** How far the effect reaches, as a fraction of the shorter side. */
  readonly reach: number;
  /** Main qi colour and the bright accent, as "r, g, b". */
  readonly qi: string;
  readonly accent: string;
  readonly gold: string;
  /** How much qi moves, 1 for the full effect (fewer streams and fainter light below it). */
  readonly intensity?: number;
  /** The sign of the realm drawn over the breathing. */
  readonly signature?: QiSignature;
  /** The wings' style (1–5, grander with each step); from 半神. */
  readonly wings?: number;
  /**
   * A drawn picture of the wings, used instead of the drawn-in-code ones once it has loaded: a square image
   * whose two wing roots meet at its centre, `rootY` of the way down; drawn `width` times the qi's reach wide.
   */
  readonly wingImage?: { readonly src: string; readonly rootY: number; readonly width: number };
}

export type QiSignature = "wisps" | "runes" | "core" | "infant" | "pillar" | "lightning" | "flame" | "bagua" | "stars" | "eternal";

export const SOLO_QI: QiBreathLook = { core: { x: 0.5, y: 0.62 }, halos: [{ x: 0.5, y: 0.1 }], reach: 0.5, qi: "112, 208, 255", accent: "220, 246, 255", gold: "255, 217, 138" };

/** The canvas reaches this share of the picture's size beyond each edge, so qi can stream in from outside it. */
export const QI_BLEED = 0.16;
const toBox = (fraction: number): number => (fraction + QI_BLEED) / (1 + 2 * QI_BLEED);

/**
 * Wing styles, from 半神 up, each grander than the last: pairs of wings (a second and third pair spread
 * lower and smaller), feathers per wing, and the feather's look.
 */
interface WingStyle { readonly pairs: number; readonly primaries: number; readonly secondaries: number; readonly covertRows: number; readonly scale: number; readonly kind: "light" | "flame" | "feather" | "crystal" | "seraph" }
const WING_STYLES: readonly WingStyle[] = [
  // 半神: small wings of light, a few long feathers.
  { pairs: 1, primaries: 5, secondaries: 3, covertRows: 0, scale: 0.72, kind: "light" },
  // 天尊: wings of flame, the feather tips flickering.
  { pairs: 1, primaries: 7, secondaries: 5, covertRows: 1, scale: 0.8, kind: "flame" },
  // 太古: full feathered wings, every feather group drawn.
  { pairs: 1, primaries: 9, secondaries: 7, covertRows: 2, scale: 0.88, kind: "feather" },
  // 主宰: two pairs of crystal wings that glint with stars.
  { pairs: 2, primaries: 9, secondaries: 6, covertRows: 2, scale: 0.88, kind: "crystal" },
  // 永恆: three pairs of gilded wings, like a seraph.
  { pairs: 3, primaries: 10, secondaries: 7, covertRows: 2, scale: 0.86, kind: "seraph" },
];

const INHALE_COUNT = 56;
const ORBIT_COUNT = 18;
const EXHALE_COUNT = 40;
const RING_COUNT = 3;

/** One soft round glow, drawn once and stamped for every particle. */
function makeGlow(colour: string): HTMLCanvasElement {
  const size = 64;
  const glow = document.createElement("canvas");
  glow.width = glow.height = size;
  const context = glow.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, `rgba(${colour}, 1)`);
    gradient.addColorStop(0.3, `rgba(${colour}, 0.55)`);
    gradient.addColorStop(1, `rgba(${colour}, 0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return glow;
}

/**
 * The qi of the meditation: streams that gather into the core as the hero
 * breathes in, a ribbon that circles the body, rings and halos at the peak,
 * and a glow that disperses as he breathes out. A canvas over the sprite,
 * looping with `periodMs`; people who prefer reduced motion get a still aura.
 */
export function QiBreathEffect({ look, periodMs }: { readonly look: QiBreathLook; readonly periodMs: number }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const soft = { qi: makeGlow(look.qi), accent: makeGlow(look.accent), gold: makeGlow(look.gold) };
    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    const stamp = (image: HTMLCanvasElement, x: number, y: number, size: number, alpha: number): void => {
      if (alpha <= 0.01 || size <= 0.5) return;
      context.globalAlpha = Math.min(1, alpha);
      context.drawImage(image, x - size / 2, y - size / 2, size, size);
    };

    const ring = (cx: number, cy: number, radius: number, squash: number, rgb: string, alpha: number, line: number): void => {
      if (alpha <= 0.01) return;
      context.globalAlpha = Math.min(1, alpha);
      context.strokeStyle = `rgb(${rgb})`;
      context.lineWidth = line;
      context.beginPath();
      context.ellipse(cx, cy, radius, radius * squash, 0, 0, Math.PI * 2);
      context.stroke();
    };

    let wingPicture: HTMLImageElement | null = null;
    if (look.wingImage) {
      const picture = new Image();
      // A still (reduced-motion) aura is drawn once, so draw it again with the picture.
      picture.onload = () => { wingPicture = picture; if (reduced) draw(0); };
      picture.src = look.wingImage.src;
    }
    const intensity = look.intensity ?? 1;
    // Low realms move only a trickle of qi; it grows steeply with the realm.
    const inhaleCount = Math.round(INHALE_COUNT * Math.min(1.4, intensity ** 1.5));
    const orbitCount = Math.round(ORBIT_COUNT * Math.min(1.4, intensity ** 2));
    const exhaleCount = Math.round(EXHALE_COUNT * Math.min(1.4, intensity ** 1.5));

    /** Short jagged line from (x, y) in a direction, for lightning. */
    const bolt = (x: number, y: number, angle: number, length: number, seed: number, alpha: number): void => {
      context.globalAlpha = Math.min(1, alpha);
      context.strokeStyle = `rgb(${look.accent})`;
      context.lineWidth = 1.8;
      context.beginPath();
      context.moveTo(x, y);
      for (let step = 1; step <= 5; step += 1) {
        const along = (length * step) / 5;
        const jitter = (hash01(seed, step) - 0.5) * length * 0.35;
        context.lineTo(x + Math.cos(angle) * along - Math.sin(angle) * jitter, y + Math.sin(angle) * along + Math.cos(angle) * jitter);
      }
      context.stroke();
    };

    /** The sign of the realm, drawn under the streams and over the aura. */
    const signature = (phase: number, stage: ReturnType<typeof qiStage>, cx: number, cy: number, reach: number, unit: number): void => {
      const groundY = height * toBox(0.93);
      const t = phase * Math.PI * 2;
      switch (look.signature) {
        case "runes": {
          // An octagon of runes on the ground, turning slowly.
          const r = reach * 0.85;
          context.globalAlpha = 0.35 + 0.35 * stage.breath;
          context.strokeStyle = `rgb(${look.gold})`;
          context.lineWidth = 2;
          context.beginPath();
          for (let k = 0; k <= 8; k += 1) {
            const a = t * 0.25 + (k / 8) * Math.PI * 2;
            const x = cx + Math.cos(a) * r;
            const y = groundY + Math.sin(a) * r * 0.2;
            if (k === 0) context.moveTo(x, y); else context.lineTo(x, y);
          }
          context.stroke();
          for (let k = 0; k < 8; k += 1) {
            const a = t * 0.25 + ((k + 0.5) / 8) * Math.PI * 2;
            stamp(soft.gold, cx + Math.cos(a) * r * 0.92, groundY + Math.sin(a) * r * 0.18, unit * 0.06, 0.4 + 0.5 * stage.breath);
          }
          break;
        }
        case "core": {
          // A golden core blazes at the dantian (its glow spills past his body), with pellets of qi circling wide.
          stamp(soft.gold, cx, cy, reach * (1.1 + 0.3 * stage.breath), 0.45 + 0.35 * stage.peak);
          for (let k = 0; k < 5; k += 1) {
            const a = t * 2 + (k / 5) * Math.PI * 2;
            const x = cx + Math.cos(a) * reach * 0.85;
            const y = cy - reach * 0.05 + Math.sin(a) * reach * 0.3;
            stamp(soft.gold, x, y, unit * 0.11, 0.95);
            stamp(soft.accent, x, y, unit * 0.045, 1);
          }
          break;
        }
        case "infant": {
          // The nascent soul: a small seated figure of light that rises out of him and floats above his head.
          const bob = Math.sin(t * 2) * reach * 0.03;
          const ix = cx;
          const iy = height * toBox(0.02) + bob;
          stamp(soft.gold, ix, iy, reach * 0.7, 0.35 + 0.3 * stage.peak);
          context.globalAlpha = 0.75 + 0.2 * stage.breath;
          context.fillStyle = `rgba(${look.accent}, 0.9)`;
          context.beginPath();
          context.arc(ix, iy - reach * 0.08, reach * 0.06, 0, Math.PI * 2);
          context.ellipse(ix, iy + reach * 0.03, reach * 0.1, reach * 0.07, 0, 0, Math.PI * 2);
          context.fill();
          ring(ix, iy, reach * 0.18, 0.35, look.gold, 0.5 + 0.4 * stage.breath, 1.5);
          break;
        }
        case "pillar": {
          // A column of light from the sky down to him.
          const w = reach * (0.32 + 0.12 * stage.breath);
          const gradient = context.createLinearGradient(0, 0, 0, groundY);
          gradient.addColorStop(0, `rgba(${look.accent}, 0)`);
          gradient.addColorStop(0.35, `rgba(${look.accent}, 0.32)`);
          gradient.addColorStop(1, `rgba(${look.gold}, 0.5)`);
          context.globalAlpha = 0.45 + 0.45 * stage.breath + 0.2 * stage.peak;
          context.fillStyle = gradient;
          context.fillRect(cx - w / 2, 0, w, groundY);
          for (let k = 0; k < 10; k += 1) {
            const rise = (phase * 1.5 + hash01(k, 31)) % 1;
            stamp(soft.accent, cx + (hash01(k, 32) - 0.5) * w * 0.8, groundY - rise * groundY, unit * 0.03, 0.8 * (1 - rise));
          }
          break;
        }
        case "lightning": {
          // Bolts flicker round him, a few at a time.
          const flick = Math.floor(phase * 40);
          for (let k = 0; k < 4; k += 1) {
            const seed = flick * 7 + k;
            if (hash01(seed, 41) > 0.55) continue;
            const a = hash01(seed, 42) * Math.PI * 2;
            bolt(cx + Math.cos(a) * reach * 0.3, cy + Math.sin(a) * reach * 0.25, a, reach * (0.35 + 0.3 * hash01(seed, 43)), seed, 0.6 + 0.4 * stage.breath);
          }
          stamp(soft.qi, cx, cy, reach * 1.4, 0.1 + 0.15 * (Math.floor(phase * 40) % 3 === 0 ? 1 : 0));
          break;
        }
        case "flame": {
          // Tongues of flame rise round his body.
          // Kept to his sides and above him, where the body does not hide them.
          for (let k = 0; k < 40; k += 1) {
            const rise = (phase * 2 + hash01(k, 51)) % 1;
            const left = k % 2 === 0;
            const side = (left ? -1 : 1) * reach * (0.55 + hash01(k, 52) * 0.45);
            const x = cx + side * (1 - rise * 0.45) + Math.sin(rise * 8 + k) * reach * 0.05;
            const y = groundY - rise * reach * 2;
            stamp(k % 3 === 0 ? soft.gold : soft.qi, x, y, unit * (0.16 - rise * 0.1), (1 - rise) * (0.6 + 0.4 * stage.breath));
          }
          break;
        }
        case "bagua": {
          // A turning ring of eight trigrams.
          const r = reach * 0.95;
          ring(cx, cy, r, 0.45, look.qi, 0.35 + 0.3 * stage.breath, 2);
          ring(cx, cy, r * 0.82, 0.45, look.accent, 0.25 + 0.3 * stage.breath, 1.5);
          context.strokeStyle = `rgb(${look.gold})`;
          context.lineWidth = 2;
          for (let k = 0; k < 8; k += 1) {
            const a = t * -0.2 + (k / 8) * Math.PI * 2;
            const x = cx + Math.cos(a) * r * 0.91;
            const y = cy + Math.sin(a) * r * 0.91 * 0.45;
            context.globalAlpha = 0.5 + 0.4 * stage.breath;
            for (let line = 0; line < 3; line += 1) {
              const broken = ((k >> line) & 1) === 1;
              const half = unit * 0.022;
              const ly = y - unit * 0.016 + line * unit * 0.016;
              context.beginPath();
              if (broken) {
                context.moveTo(x - half, ly); context.lineTo(x - half * 0.25, ly);
                context.moveTo(x + half * 0.25, ly); context.lineTo(x + half, ly);
              } else {
                context.moveTo(x - half, ly); context.lineTo(x + half, ly);
              }
              context.stroke();
            }
          }
          break;
        }
        case "stars": {
          // Stars wheel round him on a wide ellipse, joined by faint lines.
          const points: [number, number][] = [];
          for (let k = 0; k < 14; k += 1) {
            const a = t * 0.3 + hash01(k, 61) * Math.PI * 2;
            const r = reach * (0.7 + hash01(k, 62) * 0.45);
            const x = cx + Math.cos(a) * r;
            const y = cy - reach * 0.2 + Math.sin(a) * r * 0.5;
            points.push([x, y]);
            const twinkle = 0.6 + 0.4 * Math.sin(phase * Math.PI * 12 + k);
            stamp(k % 4 === 0 ? soft.gold : soft.accent, x, y, unit * 0.08, twinkle);
            stamp(soft.accent, x, y, unit * 0.03, 1);
          }
          context.globalAlpha = 0.25 + 0.25 * stage.breath;
          context.strokeStyle = `rgb(${look.accent})`;
          context.lineWidth = 1;
          context.beginPath();
          points.slice(0, 7).forEach(([x, y], k) => (k === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
          context.stroke();
          break;
        }
        case "eternal": {
          // Rings of many colours turning at their own speeds, and sword lights circling.
          const hues = ["255, 150, 150", "255, 210, 130", "160, 255, 180", "140, 200, 255", "210, 160, 255"];
          hues.forEach((hue, k) => {
            context.globalAlpha = 0.35 + 0.3 * stage.breath;
            context.strokeStyle = `rgb(${hue})`;
            context.lineWidth = 2;
            context.beginPath();
            context.ellipse(cx, cy - reach * 0.1, reach * (0.6 + k * 0.12), reach * (0.6 + k * 0.12) * 0.35, t * (k % 2 ? 0.3 : -0.3) + k, 0, Math.PI * 2);
            context.stroke();
          });
          for (let k = 0; k < 9; k += 1) {
            const a = t * 0.8 + (k / 9) * Math.PI * 2;
            const x = cx + Math.cos(a) * reach * 0.9;
            const y = cy - reach * 0.1 + Math.sin(a) * reach * 0.32;
            context.globalAlpha = 0.85;
            context.strokeStyle = `rgb(${look.accent})`;
            context.lineWidth = 2.5;
            context.beginPath();
            context.moveTo(x, y - unit * 0.045);
            context.lineTo(x, y + unit * 0.045);
            context.stroke();
            stamp(soft.gold, x, y, unit * 0.05, 0.7);
          }
          break;
        }
        default:
          break;
      }
    };

    /**
     * A feather rooted at (x, y), pointing along `angle`. "light" is a slim glowing vane, "flame" a vane whose
     * tip licks like fire, "crystal" a faceted see-through shard, "feather" and "seraph" a full vane with a
     * quill (gold-rimmed for "seraph").
     */
    const feather = (x: number, y: number, angle: number, length: number, width: number, kind: WingStyle["kind"], alpha: number, flicker: number): void => {
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const nx = -uy * width;
      const ny = ux * width;
      const at = (along: number, across: number): [number, number] => [x + ux * length * along + nx * across, y + uy * length * along + ny * across];
      context.globalAlpha = Math.min(1, alpha);
      context.beginPath();
      if (kind === "crystal") {
        context.moveTo(...at(0, 0));
        context.lineTo(...at(0.35, 0.85));
        context.lineTo(...at(1, 0.1));
        context.lineTo(...at(0.4, -0.75));
      } else if (kind === "flame") {
        const lick = Math.sin(flicker) * 0.35;
        context.moveTo(...at(0, 0.3));
        context.bezierCurveTo(...at(0.35, 0.95), ...at(0.7, 0.8), ...at(0.86, 0.35 + lick));
        context.quadraticCurveTo(...at(1.12, lick * 1.5), ...at(0.9, -0.3 + lick));
        context.bezierCurveTo(...at(0.7, -0.7), ...at(0.35, -0.8), ...at(0, -0.3));
      } else {
        const slim = kind === "light" ? 0.6 : 1;
        context.moveTo(...at(0, 0.25 * slim));
        context.bezierCurveTo(...at(0.3, 0.9 * slim), ...at(0.8, slim), ...at(0.94, 0.55 * slim));
        context.quadraticCurveTo(...at(1.04, 0), ...at(0.94, -0.45 * slim));
        context.bezierCurveTo(...at(0.8, -0.8 * slim), ...at(0.3, -0.7 * slim), ...at(0, -0.25 * slim));
      }
      context.closePath();
      const shade = context.createLinearGradient(x, y, x + ux * length, y + uy * length);
      if (kind === "flame") {
        shade.addColorStop(0, `rgba(${look.qi}, 0.95)`);
        shade.addColorStop(0.6, `rgba(${look.gold}, 0.9)`);
        shade.addColorStop(1, "rgba(255, 244, 200, 0.95)");
      } else if (kind === "crystal") {
        shade.addColorStop(0, `rgba(${look.qi}, 0.55)`);
        shade.addColorStop(1, `rgba(${look.accent}, 0.75)`);
      } else {
        shade.addColorStop(0, `rgba(${look.qi}, ${kind === "light" ? 0.6 : 0.95})`);
        shade.addColorStop(0.7, `rgba(${look.accent}, 0.9)`);
        shade.addColorStop(1, "rgba(255, 255, 255, 0.95)");
      }
      context.fillStyle = shade;
      context.fill();
      context.strokeStyle = kind === "seraph" ? `rgba(${look.gold}, 0.95)` : `rgba(${look.accent}, 0.9)`;
      context.lineWidth = kind === "seraph" || kind === "crystal" ? 1.3 : 1;
      context.stroke();
      if (kind === "feather" || kind === "seraph" || kind === "crystal") {
        context.globalAlpha = Math.min(1, alpha * 0.7);
        context.strokeStyle = `rgb(${kind === "crystal" ? look.accent : look.gold})`;
        context.lineWidth = 0.9;
        context.beginPath();
        context.moveTo(...at(0.02, 0));
        context.lineTo(...at(kind === "crystal" ? 0.95 : 0.88, kind === "crystal" ? 0.1 : 0));
        context.stroke();
      }
    };

    /** The wings on his back (from 半神), grander with each realm. (The lotus seat is a picture, see CultivatingCharacter.) */
    const adornments = (phase: number, stage: ReturnType<typeof qiStage>, cx: number, reach: number, unit: number): void => {
      const groundY = height * toBox(0.93);
      const t = phase * Math.PI * 2;
      if (wingPicture && look.wingImage) {
        // The drawn wings, rooted at his upper back; each half beats on its own hinge at the root.
        const size = reach * look.wingImage.width;
        const rootX = cx;
        const rootY = height * toBox(0.54);
        const beat = 1 - (Math.sin(t * 2) * 0.05 + stage.breath * 0.05);
        const half = wingPicture.width / 2;
        context.globalAlpha = 0.95;
        for (const side of [-1, 1]) {
          context.save();
          context.translate(rootX, rootY);
          context.scale(beat, 1 + (1 - beat) * 0.4);
          context.drawImage(wingPicture, side < 0 ? 0 : half, 0, half, wingPicture.height, side < 0 ? -size / 2 : 0, -size * look.wingImage.rootY, size / 2, size);
          context.restore();
        }
        context.globalCompositeOperation = "lighter";
        stamp(soft.accent, rootX, rootY - size * 0.18, size * 0.9, 0.12 + 0.18 * stage.peak);
        context.globalCompositeOperation = "source-over";
        return;
      }
      const wingTier = look.wings ?? 0;
      if (wingTier > 0) {
        // Wings rooted at his upper back, between the shoulder blades, spreading out sideways and up behind him.
        const style = WING_STYLES[Math.min(WING_STYLES.length, wingTier) - 1];
        const rootY = height * toBox(0.54);
        const beat = Math.sin(t * 2) * 0.06 + stage.breath * 0.04;
        for (let pair = style.pairs - 1; pair >= 0; pair -= 1) {
          // The first pair rises; a second and third spread lower and a little smaller.
          const tilt = [0, 0.55, 1.05][pair];
          const size = style.scale * [1, 0.78, 0.6][pair];
          for (const side of [-1, 1]) {
            const turn = (tilt - beat) * side;
            const rotate = (dx: number, dy: number): [number, number] => [dx * Math.cos(turn) - dy * Math.sin(turn), dx * Math.sin(turn) + dy * Math.cos(turn)];
            const root: [number, number] = [cx + side * reach * 0.05, rootY + pair * reach * 0.05];
            const wristOff = rotate(side * reach * 0.36 * size, -reach * 0.16 * size);
            const wrist: [number, number] = [root[0] + wristOff[0], root[1] + wristOff[1]];
            const tipOff = rotate(side * reach * 0.26 * size, -reach * 0.26 * size);
            const tip: [number, number] = [wrist[0] + tipOff[0], wrist[1] + tipOff[1]];
            const facing = (angle: number) => (side > 0 ? angle : Math.PI - angle) + turn;
            const alpha = pair === 0 ? 0.9 : 0.8;
            for (let k = 0; k < style.primaries; k += 1) {
              const along = k / (style.primaries - 1);
              const fx = wrist[0] + (tip[0] - wrist[0]) * along;
              const fy = wrist[1] + (tip[1] - wrist[1]) * along;
              const length = reach * (0.3 + 0.13 * Math.sin(along * Math.PI * 0.85)) * size;
              feather(fx, fy, facing(-0.1 - along * 0.95), length, reach * 0.045 * size, style.kind, alpha, t * 6 + k);
            }
            for (let k = 0; k < style.secondaries; k += 1) {
              const along = (k + 0.5) / style.secondaries;
              const fx = root[0] + (wrist[0] - root[0]) * along;
              const fy = root[1] + (wrist[1] - root[1]) * along;
              feather(fx, fy, facing(0.85 - along * 0.75), reach * (0.2 + 0.08 * along) * size, reach * 0.042 * size, style.kind, alpha, t * 6 + k + 3);
            }
            for (let row = 0; row < style.covertRows; row += 1) {
              const count = 7 + row * 2;
              for (let k = 0; k < count; k += 1) {
                const along = k / (count - 1);
                const outer = along > 0.55;
                const from = outer ? wrist : root;
                const to = outer ? tip : wrist;
                const u = outer ? ((along - 0.55) / 0.45) * 0.55 : 0.15 + (along / 0.55) * 0.85;
                const fx = from[0] + (to[0] - from[0]) * u;
                const fy = from[1] + (to[1] - from[1]) * u + row * reach * 0.025;
                feather(fx, fy, facing(outer ? -0.3 - u * 0.6 : 0.55 - u * 0.5), reach * (0.1 + 0.03 * row) * size, reach * 0.03 * size, style.kind, 0.95, t * 6 + k + 7);
              }
            }
            // The leading edge of the wing glows.
            context.globalAlpha = 0.7;
            context.strokeStyle = `rgb(${look.gold})`;
            context.lineWidth = 1.8;
            context.beginPath();
            context.moveTo(...root);
            context.quadraticCurveTo(wrist[0], wrist[1] - reach * 0.03, tip[0], tip[1]);
            context.stroke();
            if (style.kind === "crystal" || style.kind === "seraph") {
              for (let k = 0; k < 4; k += 1) {
                const glint = (phase * 2 + hash01(k + pair * 10 + (side > 0 ? 5 : 0), 91)) % 1;
                const along = hash01(k + pair * 10, 92);
                stamp(soft.accent, wrist[0] + (tip[0] - wrist[0]) * along + side * reach * 0.08, wrist[1] + (tip[1] - wrist[1]) * along - reach * 0.08, unit * 0.05, Math.sin(glint * Math.PI));
              }
            }
          }
        }
      }
    };

    const draw = (timeMs: number): void => {
      const phase = reduced ? 0.7 : cyclePhase(timeMs, periodMs);
      const stage = qiStage(phase);
      const unit = Math.min(width, height);
      const reach = unit * look.reach;
      const cx = width * toBox(look.core.x);
      const cy = height * toBox(look.core.y);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      // The aura swells with the breath and blazes at the peak.
      stamp(soft.qi, cx, cy, reach * (1.7 + 0.4 * stage.breath), (0.2 + 0.2 * stage.breath + 0.28 * stage.peak) * Math.min(1.3, intensity));
      stamp(soft.accent, cx, cy, reach * (0.9 + 0.5 * stage.peak), (0.14 + 0.34 * stage.circulate + 0.4 * stage.peak) * Math.min(1, intensity + 0.2));

      // The wings are solid shapes, so they are drawn normally, under the additive light.
      context.globalCompositeOperation = "source-over";
      adornments(phase, stage, cx, reach, unit);
      context.globalCompositeOperation = "lighter";
      // Drawn twice in additive light so the realm's sign reads clearly over the shared breathing.
      signature(phase, stage, cx, cy, reach, unit);
      signature(phase, stage, cx, cy, reach, unit);

      // A ground ring of light that glows with the breath.
      // A ground ring of light from 築基 on.
      if (intensity >= 0.5) {
        ring(cx, height * toBox(0.93), reach * (0.95 + 0.1 * stage.breath), 0.2, look.qi, 0.34 + 0.4 * stage.breath, 3);
        ring(cx, height * toBox(0.93), reach * (0.6 + 0.1 * stage.breath), 0.2, look.accent, 0.2 + 0.3 * stage.breath, 2);
      }

      // Inhale: qi streams in from every side and brightens as it nears the core.
      for (let index = 0; index < inhaleCount; index += 1) {
        const start = hash01(index, 1) * 0.26;
        const progress = (phase - 0.02 - start) / 0.16;
        if (progress <= 0 || progress >= 1) continue;
        const angle = hash01(index, 2) * Math.PI * 2;
        const far = reach * (0.8 + hash01(index, 3) * 0.2);
        const pull = easeInQuad(progress);
        const swirl = angle + progress * 1.1;
        const x = cx + Math.cos(swirl) * far * (1 - pull);
        const y = cy + Math.sin(swirl) * far * (1 - pull) * 0.85;
        const trail = easeInQuad(Math.max(0, progress - 0.1));
        const tx = cx + Math.cos(angle + (progress - 0.1) * 1.1) * far * (1 - trail);
        const ty = cy + Math.sin(angle + (progress - 0.1) * 1.1) * far * (1 - trail) * 0.85;
        context.globalAlpha = Math.min(1, 0.7 * smoothstep(0, 0.2, progress) * (1 - smoothstep(0.85, 1, progress)));
        context.strokeStyle = `rgba(${look.qi}, 1)`;
        context.lineWidth = 2.2;
        context.beginPath();
        context.moveTo(tx, ty);
        context.lineTo(x, y);
        context.stroke();
        const warm = index % 3 === 0;
        stamp(warm ? soft.gold : soft.accent, x, y, unit * (warm ? 0.05 : 0.04) * (0.7 + progress), 0.95 * stage.inhale + 0.25);
      }

      // Circulate: a bright ribbon of qi circles the body, rising along the back and falling over the front.
      const spin = phase * Math.PI * 2 * 2.2;
      for (let index = 0; index < orbitCount; index += 1) {
        for (let tail = 0; tail < 5; tail += 1) {
          const angle = spin + (index / orbitCount) * Math.PI * 2 - tail * 0.09;
          const lift = Math.sin(angle * 0.5);
          const x = cx + Math.cos(angle) * reach * 0.8;
          const y = cy - reach * 0.15 + Math.sin(angle) * reach * 0.4 - lift * reach * 0.3;
          const fade = 1 - tail / 5;
          stamp(tail === 0 ? soft.accent : soft.qi, x, y, unit * (0.085 - tail * 0.012), stage.circulate * 0.85 * fade);
        }
      }

      // Peak: golden rings spread out from the core, and a halo shines over each head.
      for (let index = 0; index < (intensity < 0.5 ? 1 : RING_COUNT); index += 1) {
        const rise = (phase - (0.56 + index * 0.06)) / 0.3;
        if (rise <= 0 || rise >= 1) continue;
        const radius = reach * (0.2 + 0.8 * easeOutCubic(rise));
        ring(cx, cy, radius, 0.78, look.gold, (1 - rise) * 0.95, 5 * (1 - rise) + 1.5);
        ring(cx, cy, radius * 0.94, 0.78, look.accent, (1 - rise) * 0.5, 2);
      }
      look.halos.forEach((halo, index) => {
        const hx = width * toBox(halo.x);
        const hy = height * toBox(halo.y);
        const pulse = 0.85 + 0.15 * Math.sin(phase * Math.PI * 8 + index);
        stamp(soft.gold, hx, hy, unit * 0.34 * pulse, stage.peak * 0.7);
        ring(hx, hy, unit * 0.16 * pulse, 0.3, look.gold, stage.peak * 0.95, 3.5);
        ring(hx, hy, unit * 0.115 * pulse, 0.3, look.accent, stage.peak * 0.7, 2);
      });

      // Exhale: the glow bursts outward and fades.
      for (let index = 0; index < exhaleCount; index += 1) {
        const progress = (phase - 0.8 - hash01(index, 4) * 0.06) / 0.18;
        if (progress <= 0 || progress >= 1) continue;
        const angle = hash01(index, 5) * Math.PI * 2;
        const distance = reach * (0.2 + 0.78 * easeOutCubic(progress)) * (0.7 + hash01(index, 6) * 0.5);
        stamp(index % 4 === 0 ? soft.gold : soft.qi, cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance * 0.8, unit * 0.05, (1 - progress) * 0.9);
      }

      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
    };

    if (reduced) {
      draw(0);
    } else {
      const start = performance.now();
      const tick = (now: number): void => {
        draw(now - start);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [look, periodMs]);

  return <canvas ref={canvasRef} className="qi-breath" aria-hidden="true" />;
}
