import type { CSSProperties } from "react";

const PETAL_COUNT = 30;

/** A deterministic 0..1 value per petal, so the swirl looks the same every cast. */
const hash = (index: number, salt: number): number => {
  const value = Math.sin(index * 91.7 + salt * 37.3) * 43758.5453;
  return value - Math.floor(value);
};

/** Jagged bolt from the top of the box down to a point, as an SVG polyline (viewBox 0–100). */
const bolt = (x: number, bottom: number, seed: number): string => {
  const points: string[] = [];
  for (let step = 0; step <= 6; step += 1) {
    const y = (bottom * step) / 6;
    const wiggle = step === 0 || step === 6 ? 0 : (hash(seed, step) - 0.5) * 9;
    points.push(`${(x + wiggle).toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(" ");
};

const PILLARS = [
  { x: 24, bottom: 78 },
  { x: 76, bottom: 78 },
  { x: 50, bottom: 62 },
  { x: 50, bottom: 92 },
];

/**
 * 雷獄崩天: four violet lightning pillars strike around the target one by one
 * (at `pillarDelays` ms), then a great bolt crashes into the middle with a
 * shockwave ring (at `boltDelay` ms). Remounting it (a new `key`) replays it.
 */
export function LeiyuLightning({ pillarDelays, boltDelay }: { readonly pillarDelays: readonly number[]; readonly boltDelay: number }): JSX.Element {
  return (
    <div className="adventure-lightning" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {PILLARS.map((pillar, index) => (
          <polyline key={index} className="adventure-lightning__pillar" points={bolt(pillar.x, pillar.bottom, index + 1)} style={{ animationDelay: `${pillarDelays[index] ?? 0}ms` }} />
        ))}
        <polyline className="adventure-lightning__bolt" points={bolt(50, 80, 9)} style={{ animationDelay: `${boltDelay}ms` }} />
      </svg>
      <span className="adventure-lightning__ring" style={{ animationDelay: `${boltDelay}ms` }} />
      <span className="adventure-lightning__flash" style={{ animationDelay: `${boltDelay}ms` }} />
    </div>
  );
}

/**
 * 落英繽紛: cherry blossom petals and frost motes whirl around the target and
 * drift down. Pure CSS; remounting it (a new `key`) replays the cast.
 */
export function LuoyingPetals(): JSX.Element {
  return (
    <div className="adventure-petals" aria-hidden="true">
      <span className="adventure-petals__glow" />
      {Array.from({ length: PETAL_COUNT }, (_, index) => (
        <i
          key={index}
          className={index % 5 === 0 ? "adventure-petal adventure-petal--frost" : "adventure-petal"}
          style={{
            "--start": `${Math.round(hash(index, 1) * 360)}deg`,
            "--radius": `${16 + Math.round(hash(index, 2) * 26)}cqw`,
            "--delay": `${Math.round(hash(index, 3) * 420)}ms`,
            "--spin": `${160 + Math.round(hash(index, 4) * 220)}deg`,
            "--fall": `${8 + Math.round(hash(index, 5) * 16)}cqh`,
            "--size": `${10 + Math.round(hash(index, 6) * 12)}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
