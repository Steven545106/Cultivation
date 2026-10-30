import type { CSSProperties } from "react";

const PETAL_COUNT = 30;

/** A deterministic 0..1 value per petal, so the swirl looks the same every cast. */
const hash = (index: number, salt: number): number => {
  const value = Math.sin(index * 91.7 + salt * 37.3) * 43758.5453;
  return value - Math.floor(value);
};

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
