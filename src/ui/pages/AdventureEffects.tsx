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
 * 新月破空: a silver crescent blade sweeps across the target (at `slashDelay`
 * ms), the cut opens into a dark starry rift, and a star bursts out of it at
 * each of `starDelays` ms. Remounting it (a new `key`) replays it.
 */
export function XinyueCrescent({ slashDelay, starDelays }: { readonly slashDelay: number; readonly starDelays: readonly number[] }): JSX.Element {
  return (
    <div className="adventure-crescent" aria-hidden="true">
      <span className="adventure-crescent__rift" style={{ animationDelay: `${slashDelay}ms` }} />
      <span className="adventure-crescent__blade" style={{ animationDelay: `${slashDelay}ms` }} />
      {starDelays.map((delay, index) => (
        <span key={index} className="adventure-crescent__star" style={{ animationDelay: `${delay}ms`, left: `${42 + index * 16}%`, top: `${44 - index * 10}%` }} />
      ))}
    </div>
  );
}

/**
 * 月華流照: a pale moon glows behind the target and five waves of moonlight
 * wash over it, one at each of `waveDelays` ms, each larger than the last.
 * Remounting it (a new `key`) replays it.
 */
export function YuehuaMoonlight({ waveDelays }: { readonly waveDelays: readonly number[] }): JSX.Element {
  const last = waveDelays[waveDelays.length - 1] ?? 0;
  return (
    <div className="adventure-moonlight" aria-hidden="true" style={{ "--moon-ms": `${last + 900}ms` } as CSSProperties}>
      <span className="adventure-moonlight__moon" />
      {waveDelays.map((delay, index) => (
        <span key={index} className="adventure-moonlight__wave" style={{ animationDelay: `${delay}ms`, "--wave-scale": 0.7 + index * 0.15 } as CSSProperties} />
      ))}
    </div>
  );
}

/**
 * 周天星轉: a faint golden star disc turns behind the target; a star flies in
 * and bursts at each of `starDelays` ms, the last one a great starburst.
 * Remounting it (a new `key`) replays it.
 */
export function ZhoutianStars({ starDelays }: { readonly starDelays: readonly number[] }): JSX.Element {
  const last = starDelays[starDelays.length - 1] ?? 0;
  return (
    <div className="adventure-stars" aria-hidden="true" style={{ "--disc-ms": `${last + 900}ms` } as CSSProperties}>
      <span className="adventure-stars__disc" />
      {starDelays.map((delay, index) => {
        const final = index === starDelays.length - 1;
        return (
          <span
            key={index}
            className={final ? "adventure-stars__star adventure-stars__star--final" : "adventure-stars__star"}
            style={{ animationDelay: `${delay}ms`, "--land-x": final ? "50%" : `${34 + hash(index, 7) * 32}%`, "--land-y": final ? "50%" : `${34 + hash(index, 8) * 32}%` } as CSSProperties}
          />
        );
      })}
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
