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
 * 星落九天: meteors streak down from the upper right onto the target, one at
 * each of `meteorDelays` ms; the last is a great star that bursts on impact.
 * Remounting it (a new `key`) replays it.
 */
export function XingluoMeteors({ meteorDelays }: { readonly meteorDelays: readonly number[] }): JSX.Element {
  return (
    <div className="adventure-meteors" aria-hidden="true">
      {meteorDelays.map((delay, index) => {
        const final = index === meteorDelays.length - 1;
        return (
          <span
            key={index}
            className={final ? "adventure-meteors__meteor adventure-meteors__meteor--final" : "adventure-meteors__meteor"}
            style={{ animationDelay: `${Math.max(0, delay - 300)}ms`, "--land-x": final ? "50%" : `${36 + hash(index, 11) * 28}%`, "--land-y": final ? "52%" : `${40 + hash(index, 12) * 24}%`, "--tint": index % 2 ? "255, 214, 120" : "150, 175, 255" } as CSSProperties}
          />
        );
      })}
    </div>
  );
}

/**
 * 清輝點雪: a snowflake blooms on the target at each of `flakeDelays` ms, in a
 * ring; at `moonDelay` ms a pale moon shows behind them and they shatter.
 * Remounting it (a new `key`) replays it.
 */
export function QinghuiSnow({ flakeDelays, moonDelay }: { readonly flakeDelays: readonly number[]; readonly moonDelay: number }): JSX.Element {
  return (
    <div className="adventure-snow" aria-hidden="true" style={{ "--moon-delay": `${moonDelay}ms` } as CSSProperties}>
      <span className="adventure-snow__moon" />
      {flakeDelays.map((delay, index) => {
        const angle = (index / flakeDelays.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <span
            key={index}
            className="adventure-snow__flake"
            style={{ animationDelay: `${delay}ms, ${moonDelay}ms`, left: `${50 + Math.cos(angle) * 26}%`, top: `${50 + Math.sin(angle) * 26}%` }}
          >❄</span>
        );
      })}
    </div>
  );
}

const FEATHER_COUNT = 14;

/**
 * 踏雪無痕: a streak of icy wind cuts across the target at each of
 * `streakDelays` ms; the ice feathers it leaves hang still, then all burst
 * outward at `burstDelay` ms. Remounting it (a new `key`) replays it.
 */
export function TaxueFeathers({ streakDelays, burstDelay }: { readonly streakDelays: readonly number[]; readonly burstDelay: number }): JSX.Element {
  return (
    <div className="adventure-feathers" aria-hidden="true">
      {streakDelays.map((delay, index) => (
        <span key={index} className={index % 2 ? "adventure-feathers__streak adventure-feathers__streak--back" : "adventure-feathers__streak"} style={{ animationDelay: `${delay}ms`, top: `${48 + index * 6}%` }} />
      ))}
      <span className="adventure-feathers__flash" style={{ animationDelay: `${burstDelay}ms` }} />
      {Array.from({ length: FEATHER_COUNT }, (_, index) => {
        const angle = (index / FEATHER_COUNT) * 360 + hash(index, 21) * 20;
        return (
          <i
            key={index}
            className="adventure-feathers__feather"
            style={{
              animationDelay: `${streakDelays[0] ?? 0}ms, ${burstDelay}ms`,
              "--angle": `${angle}deg`,
              "--rest": `${10 + hash(index, 22) * 16}cqw`,
              "--fly": `${34 + hash(index, 23) * 18}cqw`,
            } as CSSProperties}
          />
        );
      })}
    </div>
  );
}

const PEAKS = [
  { left: 30, height: 62, width: 20 },
  { left: 70, height: 70, width: 22 },
  { left: 50, height: 92, width: 28 },
];

/**
 * 千峰凝雪: frost spreads under the target, an ice peak breaks out of the
 * ground at each of `peakDelays` ms, and at `shatterDelay` ms all three burst
 * into shards. Remounting it (a new `key`) replays it.
 */
export function QianfengPeaks({ peakDelays, shatterDelay }: { readonly peakDelays: readonly number[]; readonly shatterDelay: number }): JSX.Element {
  return (
    <div className="adventure-peaks" aria-hidden="true">
      <span className="adventure-peaks__frost" style={{ animationDelay: `0ms, ${shatterDelay}ms` }} />
      {PEAKS.map((peak, index) => (
        <span
          key={index}
          className="adventure-peaks__peak"
          style={{ left: `${peak.left}%`, height: `${peak.height}%`, width: `${peak.width}%`, animationDelay: `${peakDelays[index] ?? 0}ms, ${shatterDelay}ms` }}
        />
      ))}
      {Array.from({ length: 12 }, (_, index) => (
        <i
          key={index}
          className="adventure-peaks__shard"
          style={{ animationDelay: `${shatterDelay}ms`, "--dx": `${(hash(index, 31) - 0.5) * 120}%`, "--dy": `${-60 - hash(index, 32) * 140}%`, "--spin": `${(hash(index, 33) - 0.5) * 540}deg`, left: `${30 + hash(index, 34) * 40}%` } as CSSProperties}
        />
      ))}
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
