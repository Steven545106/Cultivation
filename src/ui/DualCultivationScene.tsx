import type { CSSProperties } from "react";
import type { CompanionConfig } from "../features/companion";

interface DualCultivationSceneProps {
  /** The dual-cultivation partner (雙修), or null to show the hero alone. */
  readonly partner: CompanionConfig | null;
  readonly characterName: string;
}

/** Hero colour of the shared qi cycle: his robe blue. */
const HERO_QI = "#7fd4ff";

/**
 * Scene coordinates (viewBox 400 × 300): the hero's chest and hers, and the qi
 * core between them. The circuit is a figure eight through the core: qi leaves
 * his chest, passes the core into hers, and returns through the core to him.
 */
const HERO_CHEST = { x: 126, y: 150 };
const PARTNER_CHEST = { x: 276, y: 148 };
const CORE = { x: 200, y: 149 };
/** How far each loop of the figure eight bulges above and below the line between them. */
const LOOP = 56;
const third = (from: number, to: number, share: number): number => from + (to - from) * share;
const heroTop = `C ${third(HERO_CHEST.x, CORE.x, 0.3)} ${CORE.y - LOOP}, ${third(HERO_CHEST.x, CORE.x, 0.75)} ${CORE.y - LOOP}, ${CORE.x} ${CORE.y}`;
const partnerBottom = `C ${third(CORE.x, PARTNER_CHEST.x, 0.25)} ${CORE.y + LOOP}, ${third(CORE.x, PARTNER_CHEST.x, 0.7)} ${CORE.y + LOOP}, ${PARTNER_CHEST.x} ${PARTNER_CHEST.y}`;
const partnerTop = `C ${third(CORE.x, PARTNER_CHEST.x, 0.7)} ${CORE.y - LOOP}, ${third(CORE.x, PARTNER_CHEST.x, 0.25)} ${CORE.y - LOOP}, ${CORE.x} ${CORE.y}`;
const heroBottom = `C ${third(HERO_CHEST.x, CORE.x, 0.75)} ${CORE.y + LOOP}, ${third(HERO_CHEST.x, CORE.x, 0.3)} ${CORE.y + LOOP}, ${HERO_CHEST.x} ${HERO_CHEST.y}`;
/** The whole circuit, for the motes; drawn as his loop and her loop, each in its own colour. */
const CIRCUIT = `M${HERO_CHEST.x} ${HERO_CHEST.y} ${heroTop} ${partnerBottom} ${partnerTop} ${heroBottom}`;
const HERO_LOOP = `M${HERO_CHEST.x} ${HERO_CHEST.y} ${heroTop} M${CORE.x} ${CORE.y} ${heroBottom}`;
const PARTNER_LOOP = `M${CORE.x} ${CORE.y} ${partnerBottom} ${partnerTop}`;
/** Motes on the circuit, spread evenly; even ones in his colour, odd ones in hers. */
const CIRCUIT_MOTES = 8;
const CIRCUIT_SECONDS = 4.8;

/**
 * The home page's meditation picture. With a partner, the two cultivate as one:
 * a single aura holds them both and swells on a shared breath, a taiji qi core
 * turns between them, and qi circulates through it in a figure eight, from his
 * chest into hers and back, his blue and her colour mixing.
 */
export function DualCultivationScene({ partner, characterName }: DualCultivationSceneProps): JSX.Element {
  const breathing = partner?.breathingAnimationPath ?? null;
  const portrait = breathing ?? partner?.portraitPath ?? null;
  if (!partner || !portrait) {
    return (
      <div className="cultivating-home__character-frame">
        <img src="/assets/player/bai-xiaochun-cultivating.webp" alt={`${characterName}盤坐修練`} />
      </div>
    );
  }
  return (
    <div
      className="cultivating-home__character-frame dual-scene"
      style={{ "--companion-accent": partner.accent, "--hero-qi": HERO_QI } as CSSProperties}
      aria-label={`${characterName}與${partner.nameZh}雙修，一同吐納靈氣`}
      role="img"
    >
      <svg className="dual-scene__qi dual-scene__qi--back" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
        <ellipse className="dual-scene__ring" cx="200" cy="262" rx="176" ry="26" />
      </svg>
      <img className="dual-scene__hero" src="/assets/player/bai-xiaochun-cultivating.webp" alt="" />
      <img className={breathing ? "dual-scene__partner dual-scene__partner--animated" : "dual-scene__partner"} src={portrait} alt="" />
      <svg className="dual-scene__qi" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="dual-core-glow">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="0.45" style={{ stopColor: "var(--companion-accent)", stopOpacity: 0.55 }} />
            <stop offset="1" style={{ stopColor: "var(--hero-qi)", stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <path id="dual-qi-circuit" d={CIRCUIT} fill="none" />
        <path className="dual-scene__beam dual-scene__beam--hero" d={HERO_LOOP} />
        <path className="dual-scene__beam dual-scene__beam--partner" d={PARTNER_LOOP} />
        <path className="dual-scene__circuit" d={HERO_LOOP} />
        <path className="dual-scene__circuit" d={PARTNER_LOOP} />
        <circle className="dual-scene__core-glow" cx={CORE.x} cy={CORE.y} r="34" fill="url(#dual-core-glow)" />
        <g className="dual-scene__taiji" style={{ transformOrigin: `${CORE.x}px ${CORE.y}px` }}>
          <circle cx={CORE.x} cy={CORE.y} r="13" className="dual-scene__yang" />
          <path d={`M${CORE.x} ${CORE.y - 13} A13 13 0 0 1 ${CORE.x} ${CORE.y + 13} A6.5 6.5 0 0 1 ${CORE.x} ${CORE.y} A6.5 6.5 0 0 0 ${CORE.x} ${CORE.y - 13}`} className="dual-scene__yin" />
          <circle cx={CORE.x} cy={CORE.y - 6.5} r="2.2" className="dual-scene__yin" />
          <circle cx={CORE.x} cy={CORE.y + 6.5} r="2.2" className="dual-scene__yang" />
          <circle cx={CORE.x} cy={CORE.y} r="13" fill="none" stroke="#fff6dc" strokeWidth="1.2" />
        </g>
        {Array.from({ length: CIRCUIT_MOTES }, (_, index) => (
          <circle key={index} className={index % 2 === 0 ? "dual-scene__mote dual-scene__mote--hero" : "dual-scene__mote dual-scene__mote--partner"} r={index % 2 === 0 ? 4.5 : 4}>
            <animateMotion dur={`${CIRCUIT_SECONDS}s`} begin={`${-(CIRCUIT_SECONDS * index) / CIRCUIT_MOTES}s`} repeatCount="indefinite">
              <mpath href="#dual-qi-circuit" />
            </animateMotion>
          </circle>
        ))}
      </svg>
      <span className="dual-scene__caption">與{partner.nameZh}雙修・吐納靈氣</span>
    </div>
  );
}
