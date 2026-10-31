import type { ExploreMapSpec, ExploreProp } from "../../features/adventure";

/**
 * Stand-in art for the 探索 map until a painted one replaces it: the ground
 * (grass, the stone path, the pond and stream, the cliffs and the sect gate)
 * as one picture, and each standing prop as its own so the hero can pass
 * behind it.
 */
export function ExploreGround({ map }: { readonly map: ExploreMapSpec }): JSX.Element {
  return (
    <svg className="explore-ground" viewBox={`0 0 ${map.width} ${map.height}`} width={map.width} height={map.height} aria-hidden="true">
      <defs>
        <linearGradient id="explore-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f6f6a" />
          <stop offset="0.5" stopColor="#4b7d62" />
          <stop offset="1" stopColor="#56835a" />
        </linearGradient>
        <radialGradient id="explore-patch">
          <stop offset="0" stopColor="#7fae78" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7fae78" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="explore-water" cx="0.45" cy="0.4">
          <stop offset="0" stopColor="#bfe6f2" />
          <stop offset="0.55" stopColor="#6fb2cf" />
          <stop offset="1" stopColor="#3b7a9c" />
        </radialGradient>
        <linearGradient id="explore-cliff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fb7cc" />
          <stop offset="0.6" stopColor="#5f7a92" />
          <stop offset="1" stopColor="#3e566b" />
        </linearGradient>
        <linearGradient id="explore-mist-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef6ff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#eef6ff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#eef6ff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width={map.width} height={map.height} fill="url(#explore-grass)" />
      {[[300, 1150, 260], [1300, 1000, 300], [900, 760, 240], [1550, 520, 220], [600, 450, 200], [1100, 1350, 260]].map(([x, y, r], index) => (
        <ellipse key={index} cx={x} cy={y} rx={r} ry={r * 0.6} fill="url(#explore-patch)" />
      ))}
      {Array.from({ length: 70 }, (_, index) => {
        const x = (index * 397) % map.width;
        const y = 320 + ((index * 223) % (map.height - 340));
        return <circle key={index} cx={x} cy={y} r={index % 3 === 0 ? 4 : 3} fill={index % 4 === 0 ? "#f4d7e8" : index % 4 === 1 ? "#fff6d0" : "#d6ecff"} opacity="0.8" />;
      })}

      {/* The stone path from the foot of the mountain up to the gate. */}
      <path d="M900 1500 C 880 1380, 980 1300, 930 1200 S 800 1050, 860 940 S 1010 800, 930 700 S 860 560, 900 470 L 900 290" fill="none" stroke="#5d6a63" strokeWidth="104" strokeLinecap="round" opacity="0.5" />
      <path d="M900 1500 C 880 1380, 980 1300, 930 1200 S 800 1050, 860 940 S 1010 800, 930 700 S 860 560, 900 470 L 900 290" fill="none" stroke="#c9c2ac" strokeWidth="88" strokeLinecap="round" />
      <path d="M900 1500 C 880 1380, 980 1300, 930 1200 S 800 1050, 860 940 S 1010 800, 930 700 S 860 560, 900 470 L 900 290" fill="none" stroke="#a79f88" strokeWidth="80" strokeDasharray="6 34" />
      {/* The steps below the gate. */}
      {Array.from({ length: 6 }, (_, index) => <rect key={index} x={846} y={300 + index * 26} width={108} height={8} rx={3} fill="#8f8873" opacity="0.7" />)}

      {/* The stream falling from the cliffs into the pond, and the pond itself. */}
      <path d="M335 200 C 320 330, 360 430, 330 560 S 350 680, 370 700" fill="none" stroke="#5fa3c4" strokeWidth="66" strokeLinecap="round" />
      <path d="M335 200 C 320 330, 360 430, 330 560 S 350 680, 370 700" fill="none" stroke="#d9f1fb" strokeWidth="10" strokeDasharray="30 46" opacity="0.8" className="explore-flow" />
      <ellipse cx="390" cy="830" rx="270" ry="168" fill="#6f7d70" />
      <ellipse cx="390" cy="820" rx="250" ry="150" fill="url(#explore-water)" />
      {[[300, 790, 26], [460, 860, 22], [380, 900, 18], [520, 760, 20], [250, 870, 16]].map(([x, y, r], index) => (
        <g key={index}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.6} fill="#4f8f5a" />
          {index % 2 === 0 && <circle cx={x + r * 0.2} cy={y - r * 0.3} r={r * 0.32} fill="#f6c6dc" />}
        </g>
      ))}
      <ellipse cx="390" cy="800" rx="160" ry="60" fill="none" stroke="#e8f8ff" strokeWidth="3" opacity="0.5" className="explore-ripple" />

      {/* The cliffs along the top, with the stream's fall and a mist band at their foot. */}
      <path d={`M0 0 H${map.width} V250 L1700 230 L1560 270 L1400 225 L1250 262 L1110 240 L1100 290 L700 290 L690 240 L560 268 L420 228 L300 262 L180 232 L0 262 Z`} fill="url(#explore-cliff)" />
      <path d="M0 120 L140 60 L260 110 L400 30 L560 100 L700 50 L820 90 L900 20 L1000 80 L1140 40 L1280 110 L1420 50 L1560 100 L1700 40 L1800 90 V0 H0 Z" fill="#c9dbea" opacity="0.7" />
      <rect x="305" y="150" width="60" height="70" fill="#9fd4ec" opacity="0.8" />
      <rect y="200" width={map.width} height="120" fill="url(#explore-mist-band)" />

      {/* The sect gate (山門): two red pillars, a tiled roof with upturned eaves, and the plaque. */}
      <g>
        <rect x="748" y="150" width="44" height="150" fill="#9c3b2e" />
        <rect x="1008" y="150" width="44" height="150" fill="#9c3b2e" />
        <rect x="742" y="290" width="56" height="14" fill="#5d4a3a" />
        <rect x="1002" y="290" width="56" height="14" fill="#5d4a3a" />
        <rect x="760" y="178" width="280" height="16" fill="#7d2f25" />
        <path d="M700 150 Q 720 128 760 126 H1040 Q 1080 128 1100 150 L1080 146 Q 1060 112 900 104 Q 740 112 720 146 Z" fill="#2d3c4c" />
        <path d="M712 150 Q 900 120 1088 150" fill="none" stroke="#e8c36a" strokeWidth="4" />
        <rect x="846" y="132" width="108" height="42" rx="4" fill="#2a2f3a" stroke="#e8c36a" strokeWidth="3" />
        <text x="900" y="162" textAnchor="middle" fontSize="22" fontWeight="700" fill="#f3d58a" letterSpacing="2">雲霧山門</text>
      </g>
    </svg>
  );
}

/** One standing prop, drawn with its feet at the bottom middle of its box. */
export function ExplorePropArt({ kind }: { readonly kind: ExploreProp["kind"] }): JSX.Element {
  switch (kind) {
    case "pine":
      return (
        <svg viewBox="0 0 130 190" aria-hidden="true">
          <ellipse cx="65" cy="184" rx="38" ry="8" fill="#000" opacity="0.22" />
          <rect x="58" y="120" width="14" height="66" rx="4" fill="#5b4334" />
          <path d="M65 8 L102 70 H28 Z" fill="#2f5f57" />
          <path d="M65 36 L114 110 H16 Z" fill="#285449" />
          <path d="M65 70 L124 150 H6 Z" fill="#214a41" />
          <path d="M65 8 L80 34 H50 Z M30 108 Q65 96 100 108 M20 148 Q65 132 110 148" fill="none" stroke="#e8f4f2" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
        </svg>
      );
    case "bamboo":
      return (
        <svg viewBox="0 0 70 170" aria-hidden="true">
          <ellipse cx="35" cy="165" rx="26" ry="6" fill="#000" opacity="0.2" />
          {[18, 34, 50].map((x, index) => (
            <g key={x}>
              <rect x={x - 3} y={14 + index * 10} width="6" height={150 - index * 10} rx="3" fill={index === 1 ? "#6ea65a" : "#5b9150"} />
              {[50, 90, 130].map(y => <rect key={y} x={x - 4} y={y} width="8" height="3" fill="#3f6d39" />)}
              <path d={`M${x} ${30 + index * 10} q 16 -8 24 4 q -14 2 -24 -4 M${x} ${60 + index * 8} q -18 -6 -24 6 q 14 0 24 -6`} fill="#7cbf68" />
            </g>
          ))}
        </svg>
      );
    case "rock":
      return (
        <svg viewBox="0 0 110 70" aria-hidden="true">
          <ellipse cx="55" cy="64" rx="50" ry="7" fill="#000" opacity="0.2" />
          <path d="M8 62 Q4 36 26 22 Q44 6 70 12 Q100 20 104 46 Q106 62 92 64 Z" fill="#7d8c99" />
          <path d="M26 22 Q44 6 70 12 Q86 16 94 30 Q70 22 50 30 Q34 34 26 22 Z" fill="#a9b7c2" />
          <path d="M30 44 Q48 38 66 46" fill="none" stroke="#5f6d78" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="30" cy="60" rx="14" ry="5" fill="#5f8f5a" opacity="0.8" />
        </svg>
      );
    case "lantern":
      return (
        <svg viewBox="0 0 34 70" aria-hidden="true">
          <ellipse cx="17" cy="67" rx="14" ry="3" fill="#000" opacity="0.2" />
          <rect x="12" y="38" width="10" height="28" fill="#8d959c" />
          <rect x="6" y="20" width="22" height="18" fill="#a5adb4" />
          <rect x="11" y="24" width="12" height="10" fill="#ffd98a" className="explore-lantern-light" />
          <path d="M2 21 L17 8 L32 21 Z" fill="#6c757d" />
        </svg>
      );
    case "pavilion":
      return (
        <svg viewBox="0 0 260 210" aria-hidden="true">
          <ellipse cx="130" cy="202" rx="124" ry="10" fill="#000" opacity="0.22" />
          <rect x="18" y="176" width="224" height="26" rx="4" fill="#b8b1a0" />
          <rect x="18" y="176" width="224" height="6" fill="#d6cfbd" />
          {[40, 100, 160, 220].map(x => <rect key={x} x={x - 6} y="78" width="12" height="100" fill="#9c3b2e" />)}
          <rect x="36" y="140" width="188" height="6" fill="#7d2f25" />
          <path d="M4 82 Q 30 70 50 54 L 130 18 L 210 54 Q 230 70 256 82 L 236 82 Q 200 66 130 64 Q 60 66 24 82 Z" fill="#2d3c4c" />
          <path d="M14 82 Q 130 56 246 82" fill="none" stroke="#e8c36a" strokeWidth="4" />
          <circle cx="130" cy="16" r="7" fill="#e8c36a" />
        </svg>
      );
  }
}
