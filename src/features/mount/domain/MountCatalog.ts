export type MountId = "ponie" | "xuepo-deer" | "xuanwen-tiger" | "chiyan-qilin" | "cangming-dragon";

/** What a deployed mount strengthens. Only the cultivation speed is wired into the game so far. */
export type MountStat = "cultivationSpeed";

export interface MountSprite {
  readonly sheet: string;
  readonly poster: string;
  readonly cols: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly frames: number;
  readonly frameMs: number;
}

export interface MountConfig {
  readonly id: MountId;
  readonly nameZh: string;
  /** Kind of mount, shown under its name. */
  readonly kindZh: string;
  readonly description: string;
  /** Unlock condition shown while locked; null when it is open from the start. */
  readonly unlockZh: string | null;
  /** The idle animation; null while its art has not been drawn yet. */
  readonly sprite: MountSprite | null;
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
    sprite: { sheet: "/assets/mounts/破涅-sheet.webp", poster: "/assets/mounts/破涅-poster.webp", cols: 2, cellWidth: 712, cellHeight: 444, frames: 4, frameMs: 160 },
    stat: "cultivationSpeed",
    baseBonus: 0.03,
    bonusPerLevel: 0.0025,
  },
  { id: "xuepo-deer", nameZh: "雪魄白鹿", kindZh: "神鹿", description: "銀白神鹿，冰晶樹枝般的鹿角，蹄下踏出霜花。", unlockZh: "即將降臨", sprite: null, stat: "cultivationSpeed", baseBonus: 0, bonusPerLevel: 0 },
  { id: "xuanwen-tiger", nameZh: "玄紋白虎", kindZh: "猛虎", description: "白底黑紋的猛虎，額頭金色「王」字紋，周身帶風。", unlockZh: "即將降臨", sprite: null, stat: "cultivationSpeed", baseBonus: 0, bonusPerLevel: 0 },
  { id: "chiyan-qilin", nameZh: "赤焰麒麟", kindZh: "麒麟", description: "火紅鱗甲、金色鬃毛，四蹄踏火。", unlockZh: "即將降臨", sprite: null, stat: "cultivationSpeed", baseBonus: 0, bonusPerLevel: 0 },
  { id: "cangming-dragon", nameZh: "滄溟蒼龍", kindZh: "蒼龍", description: "深藍鱗片、銀白龍鬚的東方長龍，身繞水霧與雷光。", unlockZh: "即將降臨", sprite: null, stat: "cultivationSpeed", baseBonus: 0, bonusPerLevel: 0 },
];

export const DEFAULT_MOUNT_ID: MountId = "ponie";

export function isMountId(value: unknown): value is MountId {
  return mountCatalog.some(mount => mount.id === value);
}

export function getMount(id: MountId): MountConfig {
  return mountCatalog.find(mount => mount.id === id) ?? mountCatalog[0];
}
