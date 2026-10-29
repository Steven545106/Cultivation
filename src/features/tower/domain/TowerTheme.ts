import { TOWER_FLOOR_COUNT } from "./TowerBalanceConfig";

/** What drifts through the battle scene on a themed floor. */
export type TowerAmbientKind = "mist" | "leaf" | "ember" | "snow" | "spark" | "star" | "petal" | "mote";

export interface TowerTheme {
  readonly id: string;
  readonly nameZh: string;
  /** Painted background for the floors; null falls back to the shared artwork graded by the hue below. */
  readonly background: string | null;
  /** Rotates the background artwork's hue, in degrees. */
  readonly hueDeg: number;
  readonly saturate: number;
  readonly brightness: number;
  /** A translucent wash over the whole background (CSS colour). */
  readonly tint: string;
  readonly ambient: TowerAmbientKind;
  /** Particle colours (0xRRGGBB). */
  readonly ambientTints: readonly number[];
}

/** Floors that share one look: ten themes across the hundred floors. */
export const TOWER_FLOORS_PER_THEME = 10;

export const towerThemes: readonly TowerTheme[] = [
  { id: "mist", nameZh: "雲霧山門", background: "/assets/backgrounds/tower-mist.webp", hueDeg: 0, saturate: 0.95, brightness: 0.84, tint: "rgba(150, 195, 255, 0.06)", ambient: "mist", ambientTints: [0xdff3ff, 0xbfe1ff] },
  { id: "forest", nameZh: "青翠靈林", background: "/assets/backgrounds/tower-forest.webp", hueDeg: 0, saturate: 0.95, brightness: 0.84, tint: "rgba(70, 170, 90, 0.1)", ambient: "leaf", ambientTints: [0x9be37a, 0x6fcf6f, 0xd4f28a] },
  { id: "flame", nameZh: "赤焰洞府", background: "/assets/backgrounds/tower-flame.webp", hueDeg: 0, saturate: 0.95, brightness: 0.84, tint: "rgba(255, 110, 30, 0.12)", ambient: "ember", ambientTints: [0xffb347, 0xff7a2f, 0xffe08a] },
  { id: "frost", nameZh: "寒霜冰原", background: "/assets/backgrounds/tower-frost.webp", hueDeg: 0, saturate: 0.95, brightness: 0.84, tint: "rgba(190, 230, 255, 0.12)", ambient: "snow", ambientTints: [0xffffff, 0xd9f1ff] },
  { id: "thunder", nameZh: "雷鳴天海", background: "/assets/backgrounds/tower-thunder.webp", hueDeg: 0, saturate: 0.95, brightness: 0.84, tint: "rgba(120, 90, 255, 0.12)", ambient: "spark", ambientTints: [0xe6f6ff, 0x9fd0ff, 0xc9a8ff] },
  { id: "star", nameZh: "星河虛空", background: "/assets/backgrounds/tower-star.webp", hueDeg: 0, saturate: 0.95, brightness: 0.84, tint: "rgba(30, 30, 120, 0.2)", ambient: "star", ambientTints: [0xffffff, 0xfff1b8, 0xbcd4ff] },
  { id: "blossom", nameZh: "桃花仙境", background: "/assets/backgrounds/tower-blossom.webp", hueDeg: 0, saturate: 0.95, brightness: 0.78, tint: "rgba(255, 150, 190, 0.1)", ambient: "petal", ambientTints: [0xffc2dd, 0xff9fc6, 0xffe1ee] },
  { id: "gold", nameZh: "金輝天宮", background: "/assets/backgrounds/tower-gold.webp", hueDeg: 0, saturate: 0.9, brightness: 0.7, tint: "rgba(255, 205, 90, 0.12)", ambient: "mote", ambientTints: [0xffe9a0, 0xffd15c, 0xfff6d0] },
  { id: "blood", nameZh: "血月魔域", background: "/assets/backgrounds/tower-blood.webp", hueDeg: 0, saturate: 0.95, brightness: 0.84, tint: "rgba(190, 20, 40, 0.18)", ambient: "ember", ambientTints: [0xff5a5a, 0xc21f3a, 0xff9a9a] },
  { id: "chaos", nameZh: "混沌虛無", background: "/assets/backgrounds/tower-chaos.webp", hueDeg: 0, saturate: 0.95, brightness: 0.8, tint: "rgba(110, 40, 160, 0.2)", ambient: "mote", ambientTints: [0xd9a8ff, 0x9a6bff, 0xf0d9ff] },
];

/** The look of a floor (1-based); out-of-range floors use the nearest theme. */
export function getTowerTheme(floor: number): TowerTheme {
  const clamped = Math.min(TOWER_FLOOR_COUNT, Math.max(1, Math.floor(Number.isFinite(floor) ? floor : 1)));
  return towerThemes[Math.floor((clamped - 1) / TOWER_FLOORS_PER_THEME)];
}

/** "第 12 層" for the title card that opens a new floor. */
export function getFloorTitle(floor: number): string {
  return `第 ${Math.min(TOWER_FLOOR_COUNT, Math.max(1, Math.floor(floor)))} 層`;
}
