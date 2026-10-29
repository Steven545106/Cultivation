export type RealmId =
  | "qi"
  | "foundation"
  | "core"
  | "nascentSoul"
  | "celestial"
  | "demigod"
  | "venerable"
  | "archaic"
  | "sovereign"
  | "eternal";

export type StageProgression = "auto" | "breakthrough" | "max";

export interface RealmDefinition {
  readonly realmId: RealmId;
  readonly nameZh: string;
  readonly baseCultivationRate: number;
  readonly stages: readonly string[];
}

export interface RealmStageConfig {
  readonly stageId: string;
  readonly realmId: RealmId;
  readonly realmNameZh: string;
  readonly stageNameZh: string;
  readonly displayNameZh: string;
  readonly baseCultivationRate: number;
  readonly progression: StageProgression;
  readonly cultivationRequired: number | null;
  readonly expectedSeconds: number | null;
}

/** Real time to 永恆 when every major breakthrough is confirmed promptly (the balancing target). */
export const ETERNAL_TARGET_SECONDS = 5.5 * 24 * 60 * 60;
/** The target the spirit-stone and tower curves were tuned on; stone income scales by this ÷ the target. */
export const ORIGINAL_TARGET_SECONDS = 7 * 24 * 60 * 60;

const STAGE_TIME_GROWTH = 1.05;
/**
 * Each minor stage cultivates this much faster than the one before within a major realm (the realm's
 * base rate is its first stage). Below the ×3 between realms, so every stage outpaces the previous one.
 */
export const MINOR_STAGE_RATE_GROWTH = 1.1;

const realmDefinitions: readonly RealmDefinition[] = [
  { realmId: "qi", nameZh: "凝氣", baseCultivationRate: 2, stages: ["一層", "二層", "三層", "四層", "五層", "六層", "七層", "八層", "九層", "十層"] },
  { realmId: "foundation", nameZh: "築基", baseCultivationRate: 6, stages: ["初期", "中期", "後期", "大圓滿"] },
  { realmId: "core", nameZh: "結丹", baseCultivationRate: 20, stages: ["初期", "中期", "後期", "大圓滿"] },
  { realmId: "nascentSoul", nameZh: "元嬰", baseCultivationRate: 60, stages: ["初期", "中期", "後期", "大圓滿"] },
  { realmId: "celestial", nameZh: "天人", baseCultivationRate: 180, stages: ["初期", "中期", "後期", "大圓滿"] },
  { realmId: "demigod", nameZh: "半神", baseCultivationRate: 540, stages: ["初期", "中期", "後期", "大圓滿"] },
  { realmId: "venerable", nameZh: "天尊", baseCultivationRate: 1620, stages: ["初期", "中期", "後期", "大圓滿"] },
  { realmId: "archaic", nameZh: "太古", baseCultivationRate: 4860, stages: ["初期", "中期", "後期", "大圓滿"] },
  { realmId: "sovereign", nameZh: "主宰", baseCultivationRate: 14580, stages: ["初期", "中期", "後期", "大圓滿"] },
  { realmId: "eternal", nameZh: "永恆", baseCultivationRate: 43740, stages: ["永恆"] },
];

const stageSeeds = realmDefinitions.flatMap(realm => realm.stages.map((stageNameZh, stageIndex) => ({ realm, stageNameZh, stageIndex })));
const transitionCount = stageSeeds.length - 1;
const transitionTimeBase = ETERNAL_TARGET_SECONDS * (STAGE_TIME_GROWTH - 1) / (Math.pow(STAGE_TIME_GROWTH, transitionCount) - 1);

/** Single source for realm balance. UI and application services only read from it. */
export const realmConfigs: readonly RealmStageConfig[] = stageSeeds.map((seed, index) => {
  const next = stageSeeds[index + 1];
  const isFinal = !next;
  const expectedSeconds = isFinal ? null : Math.round(transitionTimeBase * Math.pow(STAGE_TIME_GROWTH, index));
  const progression: StageProgression = isFinal ? "max" : next.realm.realmId === seed.realm.realmId ? "auto" : "breakthrough";
  // Two decimals: the shown rate is the real one.
  const baseCultivationRate = Math.round(seed.realm.baseCultivationRate * Math.pow(MINOR_STAGE_RATE_GROWTH, seed.stageIndex) * 100) / 100;
  return {
    stageId: `${seed.realm.realmId}-${seed.stageIndex + 1}`,
    realmId: seed.realm.realmId,
    realmNameZh: seed.realm.nameZh,
    stageNameZh: seed.stageNameZh,
    displayNameZh: seed.realm.realmId === "eternal" ? "永恆" : `${seed.realm.nameZh}${seed.stageNameZh}`,
    baseCultivationRate,
    progression,
    cultivationRequired: isFinal ? null : Math.max(1, Math.round(baseCultivationRate * expectedSeconds!)),
    expectedSeconds,
  };
});

const stageById = new Map(realmConfigs.map(stage => [stage.stageId, stage]));

export function getRealmStage(stageId: string): RealmStageConfig {
  const stage = stageById.get(stageId);
  if (!stage) throw new Error(`Unknown cultivation stage: ${stageId}`);
  return stage;
}

export function getNextRealmStage(stageId: string): RealmStageConfig | null {
  const index = realmConfigs.findIndex(stage => stage.stageId === stageId);
  return index < 0 || index === realmConfigs.length - 1 ? null : realmConfigs[index + 1];
}

export function getInitialRealmStage(): RealmStageConfig { return realmConfigs[0]; }
