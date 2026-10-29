/**
 * Spirit beasts (靈獸). Every unlocked beast gives a possession bonus to the
 * idle economy; the one deployed (出戰) fights beside Bai Xiaochun in the tower,
 * dealing a share of his DPS. See docs/beasts-spec.md.
 */
import type { RealmId } from "../../cultivation/domain/RealmCatalog";

export type BeastId = "suanni" | "netherwolf" | "thunderroc" | "xuanwu" | "jiao";

export type BeastPossessionStat = "cultivationSpeed" | "spiritStoneSpeed" | "demonCoreYield";

export interface BeastConfig {
  readonly beastId: BeastId;
  readonly nameZh: string;
  readonly elementZh: string;
  readonly assetPath: string;
  readonly textureKey: string;
  /** Element colour for the battle outline glow, hit burst and UI accents. */
  readonly glowColor: number;
  /** Flying beasts hover above the ground instead of standing on it. */
  readonly flying: boolean;
  /** First-cleared tower stage needed; 0 = owned from the start. */
  readonly towerStageRequired: number;
  readonly possession: { readonly stat: BeastPossessionStat; readonly value: number };
  /** Deployed attack damage as a share of the hero's DPS at 凝氣一層; ×2.64 by 永恆 (see BeastRealm). */
  readonly damageShare: number;
  /** Lowest realm the beast stands at: it starts at this realm's first stage when unlocked. */
  readonly startRealmId: RealmId;
}

const beast = (
  beastId: BeastId,
  nameZh: string,
  elementZh: string,
  glowColor: number,
  flying: boolean,
  towerStageRequired: number,
  possession: BeastConfig["possession"],
  damageShare: number,
  startRealmId: RealmId,
): BeastConfig => ({
  beastId,
  nameZh,
  elementZh,
  assetPath: `/assets/beasts/${beastId}.${beastId === "jiao" ? "png" : "webp"}`,
  textureKey: `beast-${beastId}`,
  glowColor,
  flying,
  towerStageRequired,
  possession,
  damageShare,
  startRealmId,
});

/**
 * Beast n unlocks on the first clear of floor 20·(n−1)'s boss (stage 200, 400, 600, 800).
 * Later beasts hit harder and start at a higher realm (one realm below the hero's at unlock).
 */
export const beastCatalog: readonly BeastConfig[] = [
  beast("suanni", "赤焰狻猊", "火", 0xff8a3c, false, 0, { stat: "cultivationSpeed", value: 0.03 }, 0.16, "qi"),
  beast("netherwolf", "九幽冥狼", "暗", 0x78ffaa, false, 200, { stat: "spiritStoneSpeed", value: 0.06 }, 0.2, "foundation"),
  beast("thunderroc", "裂空雷鵬", "雷", 0x8cbeff, true, 400, { stat: "demonCoreYield", value: 0.09 }, 0.25, "nascentSoul"),
  beast("xuanwu", "鎮海玄武", "水", 0x5fe3e0, false, 600, { stat: "cultivationSpeed", value: 0.12 }, 0.3, "demigod"),
  beast("jiao", "太古吞天蛟", "混沌", 0xc89bff, true, 800, { stat: "spiritStoneSpeed", value: 0.15 }, 0.36, "archaic"),
];

export const DEFAULT_BEAST_ID: BeastId = "suanni";

const beastById = new Map(beastCatalog.map(config => [config.beastId, config]));

export function getBeastById(beastId: string): BeastConfig | undefined {
  return beastById.get(beastId as BeastId);
}

export function isBeastId(value: unknown): value is BeastId {
  return typeof value === "string" && beastById.has(value as BeastId);
}
