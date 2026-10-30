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
}

export const SOLO_QI: QiBreathLook = { core: { x: 0.5, y: 0.62 }, halos: [{ x: 0.5, y: 0.1 }], reach: 0.5, qi: "112, 208, 255", accent: "220, 246, 255", gold: "255, 217, 138" };
export const DUAL_QI: QiBreathLook = { core: { x: 0.5, y: 0.5 }, halos: [{ x: 0.31, y: 0.1 }, { x: 0.69, y: 0.1 }], reach: 0.5, qi: "112, 208, 255", accent: "226, 244, 255", gold: "255, 224, 160" };

/** The canvas reaches this share of the picture's size beyond each edge, so qi can stream in from outside it. */
export const QI_BLEED = 0.16;
const toBox = (fraction: number): number => (fraction + QI_BLEED) / (1 + 2 * QI_BLEED);

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
      stamp(soft.qi, cx, cy, reach * (1.7 + 0.4 * stage.breath), 0.2 + 0.2 * stage.breath + 0.28 * stage.peak);
      stamp(soft.accent, cx, cy, reach * (0.9 + 0.5 * stage.peak), 0.14 + 0.34 * stage.circulate + 0.4 * stage.peak);

      // A ground ring of light that glows with the breath.
      ring(cx, height * toBox(0.93), reach * (0.95 + 0.1 * stage.breath), 0.2, look.qi, 0.34 + 0.4 * stage.breath, 3);
      ring(cx, height * toBox(0.93), reach * (0.6 + 0.1 * stage.breath), 0.2, look.accent, 0.2 + 0.3 * stage.breath, 2);

      // Inhale: qi streams in from every side and brightens as it nears the core.
      for (let index = 0; index < INHALE_COUNT; index += 1) {
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
      for (let index = 0; index < ORBIT_COUNT; index += 1) {
        for (let tail = 0; tail < 5; tail += 1) {
          const angle = spin + (index / ORBIT_COUNT) * Math.PI * 2 - tail * 0.09;
          const lift = Math.sin(angle * 0.5);
          const x = cx + Math.cos(angle) * reach * 0.8;
          const y = cy - reach * 0.15 + Math.sin(angle) * reach * 0.4 - lift * reach * 0.3;
          const fade = 1 - tail / 5;
          stamp(tail === 0 ? soft.accent : soft.qi, x, y, unit * (0.085 - tail * 0.012), stage.circulate * 0.85 * fade);
        }
      }

      // Peak: golden rings spread out from the core, and a halo shines over each head.
      for (let index = 0; index < RING_COUNT; index += 1) {
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
      for (let index = 0; index < EXHALE_COUNT; index += 1) {
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
