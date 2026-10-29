import { useEffect, useRef } from "react";

const WIDTH = 320;
const HEIGHT = 260;
const FRAME_WIDTH = 426;
const FRAME_HEIGHT = 410;
const FRAME_COUNT = 9;
const SPRITE_URL = "/assets/alchemy/furnace-fire-sprites-v2.png";

interface FurnaceFireProps { readonly brewing: boolean }

/** Crossfade hand-painted fire frames inside the furnace opening. */
export function FurnaceFire({ brewing }: FurnaceFireProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * scale;
    canvas.height = HEIGHT * scale;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.imageSmoothingQuality = "high";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sheet = new Image();
    sheet.src = SPRITE_URL;
    let active = true;
    let frameId = 0;

    const drawFrame = (index: number, alpha: number): void => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      context.globalAlpha = alpha;
      context.drawImage(sheet, column * FRAME_WIDTH, row * FRAME_HEIGHT, FRAME_WIDTH, FRAME_HEIGHT, -10, -13, 340, 285);
    };

    const draw = (time: number): void => {
      const position = reducedMotion.matches ? 0 : time / 1000 * (brewing ? 11 : 8);
      const current = Math.floor(position) % FRAME_COUNT;
      const next = (current + 1) % FRAME_COUNT;
      const blend = reducedMotion.matches ? 0 : position % 1;
      context.clearRect(0, 0, WIDTH, HEIGHT);
      context.save();
      context.beginPath();
      context.ellipse(160, 132, 150, 120, 0, 0, Math.PI * 2);
      context.clip();
      // The furnace art already has a painted flame; dim it so the moving texture reads clearly.
      context.fillStyle = "rgba(75, 26, 4, .32)";
      context.fillRect(0, 0, WIDTH, HEIGHT);
      const opacity = brewing ? .91 : .77;
      drawFrame(current, opacity * (1 - blend));
      if (blend > 0) drawFrame(next, opacity * blend);
      context.restore();
      context.globalAlpha = 1;
    };

    const animate = (time: number): void => {
      if (!active) return;
      draw(time);
      if (!reducedMotion.matches) frameId = window.requestAnimationFrame(animate);
    };
    const onMotionChange = (): void => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(animate);
    };
    sheet.decode().then(() => {
      if (!active) return;
      reducedMotion.addEventListener("change", onMotionChange);
      frameId = window.requestAnimationFrame(animate);
    }).catch(() => {});
    return () => {
      active = false;
      window.cancelAnimationFrame(frameId);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, [brewing]);

  return <canvas ref={canvasRef} className="alchemy-furnace__fire" aria-hidden="true" />;
}
