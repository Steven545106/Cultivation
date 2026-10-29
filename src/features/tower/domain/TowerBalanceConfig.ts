import type { RealmId } from "../../cultivation/domain/RealmCatalog";

export const TOWER_FLOOR_COUNT = 100;
export const TOWER_STAGES_PER_FLOOR = 10;
export const TOWER_TOTAL_STAGES = TOWER_FLOOR_COUNT * TOWER_STAGES_PER_FLOOR;

export type TowerMonsterKind = "normal" | "enhanced" | "elite" | "boss";

/**
 * Static tower tuning. Difficulty is defined as the DPS needed to kill a
 * monster exactly at its time limit; player DPS is never read at challenge start.
 *
 * Each major realm owns 10 floors (see TowerRealmGate). The boss on a realm's
 * last floor (stage 100, 200 … 1000) needs the DPS an on-curve player has at
 * that realm's last minor stage ÷ 1.2, so each realm finishes exactly its own
 * floors before breaking through, and every breakthrough opens the next sword.
 * Between anchors the curve is geometric:
 *
 *   base(n)        = log-linear between the anchors (stage 1 = 72)
 *   requiredDps(n) = base(n) × kindMultiplier
 *   monster HP     = requiredDps × time limit
 *
 * The curve is sized for the hero alone. The deployed spirit beast's damage
 * (a share of the hero's DPS) is a real advantage on top: the tower is not
 * raised to cancel it.
 *
 * The balance tests re-run the on-curve simulation and guard these targets.
 */
export const towerBalanceConfig = {
  stageOneRequiredDps: 72,
  /**
   * DPS needed by the boss on each realm's last floor: realm-end on-curve DPS ÷ 1.2.
   * The 20% margin covers real-play losses (first-swing delay, crit luck, slow devices).
   */
  realmBossRequiredDps: [276, 743, 1672, 3637, 10446, 22952, 49987, 108329, 208674, 334294],
  kindDpsMultiplier: {
    normal: 1,
    enhanced: 1.08,
    elite: 1.2,
    boss: 1.35,
  },
  /**
   * While the next stage needs a higher major realm, the highest cleared stage is
   * fought again and again (農怪). Each repeat clear drops these shares of its
   * first-clear cultivation, spirit stones and 妖丹 (at least 1 of each), at most
   * once per `intervalSeconds` of real time: the next monster appears when it is due,
   * so battle speed and overpowered swords cannot multiply the income.
   */
  repeatClear: {
    intervalSeconds: 45,
    share: { cultivation: 0.1, spiritStones: 0.03, demonCores: 0.1 },
  },
  /** First-clear cultivation = seconds of the expected realm's base cultivation rate. */
  firstClearCultivationSeconds: {
    normal: 30,
    enhanced: 40,
    elite: 45,
    boss: 150,
  },
  /**
   * Realm an on-curve player (prompt breakthroughs, idle stones into the equipped
   * sword) has reached when first attempting a stage, including the realm gate
   * (each realm opens 10 floors). Static data for reward sizing only.
   */
  expectedRealmFromStage: [
    { fromStage: 1, realmId: "qi" },
    { fromStage: 101, realmId: "foundation" },
    { fromStage: 201, realmId: "core" },
    { fromStage: 301, realmId: "nascentSoul" },
    { fromStage: 401, realmId: "celestial" },
    { fromStage: 501, realmId: "demigod" },
    { fromStage: 601, realmId: "venerable" },
    { fromStage: 701, realmId: "archaic" },
    { fromStage: 801, realmId: "sovereign" },
    { fromStage: 901, realmId: "eternal" },
  ] as const satisfies readonly { readonly fromStage: number; readonly realmId: RealmId }[],
} as const;

/** Monster kind by room: 10 boss, 9 elite, 5 and 7 enhanced, the rest normal. */
export function getMonsterKind(room: number): TowerMonsterKind {
  if (room === TOWER_STAGES_PER_FLOOR) return "boss";
  if (room === 9) return "elite";
  if (room === 5 || room === 7) return "enhanced";
  return "normal";
}

/** Anchor stages (1, 100, 200 … 1000) and their kind-free base DPS. */
const BASE_ANCHORS: readonly { readonly stage: number; readonly base: number }[] = [
  { stage: 1, base: towerBalanceConfig.stageOneRequiredDps },
  ...towerBalanceConfig.realmBossRequiredDps.map((dps, index) => ({
    stage: (index + 1) * (TOWER_TOTAL_STAGES / towerBalanceConfig.realmBossRequiredDps.length),
    base: dps / towerBalanceConfig.kindDpsMultiplier.boss,
  })),
];

export function getTowerRequiredDps(stageNumber: number, kind: TowerMonsterKind): number {
  const stage = Math.min(TOWER_TOTAL_STAGES, Math.max(1, Math.trunc(stageNumber)));
  const upper = BASE_ANCHORS.findIndex(anchor => anchor.stage >= stage);
  const to = BASE_ANCHORS[Math.max(1, upper)];
  const from = BASE_ANCHORS[Math.max(0, upper - 1)];
  const t = to.stage === from.stage ? 1 : (stage - from.stage) / (to.stage - from.stage);
  const base = from.base * Math.pow(to.base / from.base, Math.min(1, Math.max(0, t)));
  return base * towerBalanceConfig.kindDpsMultiplier[kind];
}

export function getExpectedRealmForStage(stageNumber: number): RealmId {
  let realmId: RealmId = "qi";
  for (const entry of towerBalanceConfig.expectedRealmFromStage) {
    if (stageNumber >= entry.fromStage) realmId = entry.realmId;
  }
  return realmId;
}
