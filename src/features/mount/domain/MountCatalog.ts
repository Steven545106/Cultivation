export type MountId = "ponie" | "biling-deer" | "zixiao-tiger" | "chiyan-qilin" | "cangming-dragon";

/** What a deployed mount strengthens (all feed the idle income). */
export type MountStat = "cultivationSpeed" | "spiritStoneSpeed" | "demonCoreYield";

export interface MountSprite {
  readonly sheet: string;
  readonly poster: string;
  readonly cols: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly frames: number;
  /** How long each frame is shown on its own. */
  readonly frameMs: number;
  /** Then it cross-fades into the next one for this long, so a slow loop still flows instead of stepping. */
  readonly blendMs: number;
  /** The last frame holds this long before the loop starts again, so the seam back to frame 1 does not read as a jump. */
  readonly endHoldMs: number;
}

export interface MountConfig {
  readonly id: MountId;
  readonly nameZh: string;
  /** Kind of mount, shown under its name. */
  readonly kindZh: string;
  readonly description: string;
  /** Unlock condition shown while locked; null when it is open from the start. */
  readonly unlockZh: string | null;
  /** Tower stage that must be cleared to obtain it (0 = from the start). */
  readonly unlockStage: number;
  /** The idle animation; null while its art has not been drawn yet. */
  readonly sprite: MountSprite | null;
  /** The animation travels in place (a run or a flight): the stage scrolls clouds and wind past it so it reads as moving forward. */
  readonly travels?: boolean;
  readonly stat: MountStat;
  /** Bonus at level 1 and added per level after it. */
  readonly baseBonus: number;
  readonly bonusPerLevel: number;
}

export const MOUNT_MAX_LEVEL = 20;

export const mountCatalog: readonly MountConfig[] = [
  {
    id: "ponie",
    nameZh: "破涅",
    kindZh: "御劍飛行",
    description: "金紋鏤空的飛行仙劍，御劍而行時藍色靈焰沿劍身奔流，銀綾隨風翻飛。",
    unlockZh: null,
    unlockStage: 0,
    sprite: { sheet: "/assets/mounts/破涅-sheet.webp", poster: "/assets/mounts/破涅-poster.webp", cols: 6, cellWidth: 728, cellHeight: 478, frames: 24, frameMs: 110, blendMs: 130, endHoldMs: 900 },
    stat: "cultivationSpeed",
    baseBonus: 0.03,
    bonusPerLevel: 0.0025,
  },
  {
    id: "biling-deer",
    nameZh: "碧靈仙鹿",
    kindZh: "靈鹿",
    description: "靈氣凝成的神鹿，鹿角化作翠綠靈焰，金飾碧珠，奔行時蹄下生雲。",
    unlockZh: "通關通天塔第 200 關",
    unlockStage: 200,
    sprite: { sheet: "/assets/mounts/碧靈仙鹿-sheet.webp", poster: "/assets/mounts/碧靈仙鹿-poster.webp", cols: 6, cellWidth: 740, cellHeight: 484, frames: 24, frameMs: 140, blendMs: 0, endHoldMs: 140 },
    travels: true,
    stat: "spiritStoneSpeed",
    baseBonus: 0.04,
    bonusPerLevel: 0.003,
  },
  {
    id: "zixiao-tiger",
    nameZh: "紫霄靈虎",
    kindZh: "靈虎",
    description: "身披紫霄銀金戰甲的白虎，尾燃藍色靈焰，奔走時四爪踏焰、勢如雷霆。",
    unlockZh: "通關通天塔第 400 關",
    unlockStage: 400,
    sprite: { sheet: "/assets/mounts/紫霄靈虎-sheet.webp", poster: "/assets/mounts/紫霄靈虎-poster.webp", cols: 6, cellWidth: 776, cellHeight: 503, frames: 24, frameMs: 90, blendMs: 40, endHoldMs: 90 },
    travels: true,
    stat: "demonCoreYield",
    baseBonus: 0.05,
    bonusPerLevel: 0.0035,
  },
  { id: "chiyan-qilin", nameZh: "赤焰麒麟", kindZh: "麒麟", description: "火紅鱗甲、金色鬃毛，四蹄踏火。", unlockZh: "即將降臨", unlockStage: Infinity, sprite: null, stat: "cultivationSpeed", baseBonus: 0, bonusPerLevel: 0 },
  { id: "cangming-dragon", nameZh: "滄溟蒼龍", kindZh: "蒼龍", description: "深藍鱗片、銀白龍鬚的東方長龍，身繞水霧與雷光。", unlockZh: "即將降臨", unlockStage: Infinity, sprite: null, stat: "cultivationSpeed", baseBonus: 0, bonusPerLevel: 0 },
];

export const DEFAULT_MOUNT_ID: MountId = "ponie";

export function isMountId(value: unknown): value is MountId {
  return mountCatalog.some(mount => mount.id === value);
}

export function getMount(id: MountId): MountConfig {
  return mountCatalog.find(mount => mount.id === id) ?? mountCatalog[0];
}
