import { useEffect, useRef, useState, type CSSProperties } from "react";
import { spriteFrameAt, type CompanionSprite } from "../features/companion/domain/companionSprites";

/**
 * Plays a companion's sprite sheet on a canvas. A canvas is a replaced element,
 * so `object-fit` and the same classes as an `<img>` size it. Users who prefer
 * reduced motion get the first frame as a still.
 */
export function SpriteAnimation({ sprite, className, label, style }: { readonly sprite: CompanionSprite; readonly className?: string; readonly label?: string; readonly style?: CSSProperties }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const reducedMotion = typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    let cancelled = false;
    let frameRequest = 0;
    const sheet = new Image();
    sheet.onload = () => {
      if (cancelled) return;
      setReady(true);
      const { cols, cellWidth, cellHeight } = sprite;
      const drawCell = (cell: number, alpha: number): void => {
        context.globalAlpha = alpha;
        context.drawImage(sheet, (cell % cols) * cellWidth, Math.floor(cell / cols) * cellHeight, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
      };
      const start = performance.now();
      let last = "";
      const tick = (now: number): void => {
        const frame = reducedMotion ? { from: sprite.steps[0].cell, to: sprite.steps[0].cell, mix: 0 } : spriteFrameAt(sprite, now - start);
        const key = `${frame.from}-${frame.to}-${Math.round(frame.mix * 20)}`;
        if (key !== last) {
          last = key;
          context.clearRect(0, 0, cellWidth, cellHeight);
          drawCell(frame.from, 1);
          if (frame.mix > 0) drawCell(frame.to, frame.mix);
        }
        if (!reducedMotion) frameRequest = requestAnimationFrame(tick);
      };
      frameRequest = requestAnimationFrame(tick);
    };
    sheet.src = sprite.sheet;
    return () => { cancelled = true; cancelAnimationFrame(frameRequest); };
  }, [sprite, reducedMotion]);

  return <canvas ref={canvasRef} className={className} style={style} width={sprite.cellWidth} height={sprite.cellHeight} role="img" aria-label={label} aria-hidden={label ? undefined : true} data-ready={ready ? "true" : "false"} />;
}
