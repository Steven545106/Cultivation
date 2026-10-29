import { breakthroughConfig, getSpiritStonesPerSecond, realmConfigs, type RealmId } from "../cultivation";
import { getRealmCombatStats } from "../realm";
import { REFINEMENT_COSTS, getRefinementAttackBonus, IMMORTAL_AWAKENING_LEVEL, MAX_REFINEMENT_LEVEL, SPIRIT_AWAKENING_LEVEL } from "../refinement";
import {
  getMonsterKind,
  getRealmNameZh,
  getTowerStage,
  getTowerStageCapForRealm,
  getTowerTimeLimitSeconds,
  TOWER_BATTLE_SPEEDS,
  towerBalanceConfig,
  TOWER_FLOOR_COUNT,
  TOWER_FLOORS_PER_REALM,
  TOWER_STAGES_PER_FLOOR,
  TOWER_TOTAL_STAGES,
} from "../tower";
import { comboSets, type ComboSetId } from "../combat";
import {
  BEAST_ATTACK_INTERVAL_MS,
  BEAST_MAX_STAGE_INDEX,
  BEAST_PACE,
  BEAST_STAGES,
  beastCatalog,
  beastStageCosts,
  demonCoresPerSecond,
  formatBeastPossession,
  getBeastDamageShare,
  getBeastRealmDamageMultiplier,
  getBeastUnlockText,
  getTotalBeastFeedCost,
} from "../beast";
import { weaponConfigs, weaponUnlockRequirements } from "../weapon";
import { ALCHEMIST_THRESHOLDS, ALCHEMY_SUCCESS_RATE, PILL_CATALOG, PILL_DAILY_LIMIT, QUALITY_CHANCES, QUALITY_NAMES } from "../alchemy/Alchemy";

/**
 * Player-facing rule tables, derived from the live balance data so the in-game
 * rules page can never drift from the actual numbers.
 */
export interface RulesTable {
  readonly id: string;
  readonly title: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly notes?: readonly string[];
}

const pct = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`;
const num = (value: number) => Math.round(value).toLocaleString("zh-TW");
type WeaponConfigEntry = (typeof weaponConfigs)[number];
const possessionValue = (weapon: WeaponConfigEntry) => {
  const { attackPercent, critRateBonus, attackSpeedBonus } = weapon.possessionEffect.combat;
  return attackPercent + critRateBonus + attackSpeedBonus;
};
const possessionPercent = (weapon: WeaponConfigEntry) => `${Math.round(possessionValue(weapon) * 10000) / 100}%`;

const realmIds: readonly RealmId[] = [...new Set(realmConfigs.map(stage => stage.realmId))];
const STAGES_PER_REALM = TOWER_FLOORS_PER_REALM * TOWER_STAGES_PER_FLOOR;

function realmTable(): RulesTable {
  const rows = realmIds.map((realmId, index) => {
    const stages = realmConfigs.filter(stage => stage.realmId === realmId);
    const first = getRealmCombatStats(stages[0].stageId);
    const last = getRealmCombatStats(stages[stages.length - 1].stageId);
    const cap = getTowerStageCapForRealm(realmId);
    const lastFloor = cap / TOWER_STAGES_PER_FLOOR;
    const floors = `${lastFloor - TOWER_FLOORS_PER_REALM + 1}–${lastFloor} 層`;
    const breakthrough = index === 0 ? "—" : pct(breakthroughConfig.baseSuccessRateByTargetRealm[realmId]);
    return [
      getRealmNameZh(realmId),
      stages.map(stage => stage.stageNameZh).join("、"),
      `${stages[0].baseCultivationRate.toLocaleString("zh-TW")} /秒`,
      `${getSpiritStonesPerSecond(realmId)} /秒`,
      first.attackMultiplier === last.attackMultiplier ? `×${first.attackMultiplier.toFixed(2)}` : `×${first.attackMultiplier.toFixed(2)}～×${last.attackMultiplier.toFixed(2)}`,
      first.critRate === last.critRate ? pct(first.critRate, 1) : `${pct(first.critRate, 1)}～${pct(last.critRate, 1)}`,
      breakthrough,
      floors,
    ];
  });
  return {
    id: "realms",
    title: "境界",
    headers: ["大境界", "小階", "修為速度", "靈石速度", "攻擊倍率", "暴擊率", "突破成功率", "通天塔開放"],
    rows,
    notes: [
      "同一大境界內的小階，修為足夠即自動升階；跨入下一個大境界需手動突破。",
      `突破失敗扣除該階所需修為的 ${pct(breakthroughConfig.failureCultivationLossRate)}（不掉境界），下次成功率 +${pct(breakthroughConfig.pityPerFailure)}；連續失敗 ${breakthroughConfig.guaranteedAfterFailures} 次後下一次必定成功。`,
      "攻擊倍率：每升一小階 ×1.06，每突破一個大境界再 ×1.18。",
    ],
  };
}

const COMBO_SET_LABEL: Record<ComboSetId, string> = { heavy: "重劍", blade: "一般劍", thrust: "輕劍・細劍" };
const comboLine = (id: ComboSetId) => `${COMBO_SET_LABEL[id]} ${comboSets[id].map(move => `${move.nameZh}×${move.damageMultiplier}`).join("→")}`;

function weaponTable(): RulesTable {
  const rows = weaponConfigs.map((weapon, index) => {
    const requirement = weaponUnlockRequirements[weapon.weaponId];
    const realm = realmConfigs.find(stage => stage.stageId === requirement.minimumRealmStageId)!;
    const unlock = requirement.towerStageRequired === 0
      ? "初始開放"
      : `${realm.realmNameZh}＋通關第 ${requirement.towerStageRequired / TOWER_STAGES_PER_FLOOR} 層`;
    return [
      `${index + 1}. ${weapon.nameZh}`,
      `${weapon.element}・${weapon.weaponType}`,
      unlock,
      num(weapon.baseDamage),
      weapon.attackSpeed.toFixed(2),
      pct(weapon.baseCritRate),
      `${weapon.possessionEffect.nameZh}：${weapon.possessionEffect.descriptionZh}`,
      `${weapon.equippedEffect.nameZh}：${weapon.equippedEffect.descriptionZh}`,
    ];
  });
  return {
    id: "weapons",
    title: "仙劍",
    headers: ["仙劍", "屬性・類型", "解鎖條件", "基礎攻擊", "攻速/秒", "基礎暴擊", "持有效果（解鎖即生效）", "裝備效果（裝備時生效）"],
    rows,
    notes: [
      "解鎖公式：第 n 把劍＝第 n 個大境界＋通關第 10×(n−1) 層。",
      `持有效果逐把遞增：每把比前一把多 +0.25%（${possessionPercent(weaponConfigs[0])}～${possessionPercent(weaponConfigs[weaponConfigs.length - 1])}），十把全持有合計 +${pct(weaponConfigs.reduce((sum, weapon) => sum + possessionValue(weapon), 0), 2)}。`,
      "最終攻擊＝仙劍基礎攻擊 ×(1＋煉靈攻擊加成)× 境界攻擊倍率 ×(1＋效果攻擊%)；DPS＝最終攻擊 ×(1＋暴擊率)× 攻速，暴擊傷害 ×2。",
      "新解鎖的劍會繼承「目前最高煉靈等級 −5」，但不會低於已達到的覺醒門檻（+11／+21）。",
      `自動攻擊會連招：${comboLine("heavy")}；${comboLine("blade")}；${comboLine("thrust")}。終結技傷害較高，但整套連招的平均傷害倍率為 1，DPS 不變。`,
    ],
  };
}

function refinementTable(): RulesTable {
  const milestones = [1, 5, 10, SPIRIT_AWAKENING_LEVEL, 15, 20, IMMORTAL_AWAKENING_LEVEL, 25, MAX_REFINEMENT_LEVEL];
  const rows = milestones.map(level => {
    const total = REFINEMENT_COSTS.slice(0, level).reduce((sum, cost) => sum + cost, 0);
    const awakening = level >= IMMORTAL_AWAKENING_LEVEL ? "仙器覺醒：攻速 ×1.5、暴擊 +25%" : level >= SPIRIT_AWAKENING_LEVEL ? "靈器覺醒：攻速 ×1.2、暴擊 +10%" : "—";
    return [`+${level}`, num(REFINEMENT_COSTS[level - 1]), num(total), `+${pct(getRefinementAttackBonus(level))}`, awakening];
  });
  return {
    id: "refinement",
    title: "煉靈",
    headers: ["等級", "該級花費（靈石）", "累計花費", "仙劍攻擊加成", "覺醒"],
    rows,
    notes: ["煉靈 100% 成功，上限 +30；覺醒效果只算當下最高的一階。"],
  };
}

function towerTable(): RulesTable {
  const rows = realmIds.map((realmId, index) => {
    const bossStage = getTowerStage(getTowerStageCapForRealm(realmId));
    const firstStage = getTowerStage(getTowerStageCapForRealm(realmId) - STAGES_PER_REALM + 1);
    return [
      `${index * TOWER_FLOORS_PER_REALM + 1}–${(index + 1) * TOWER_FLOORS_PER_REALM} 層`,
      `第 ${firstStage.stageNumber}–${bossStage.stageNumber} 關`,
      getRealmNameZh(realmId),
      num(firstStage.monsterMaxHp),
      num(bossStage.monsterMaxHp),
      num(Math.ceil(bossStage.requiredDps)),
    ];
  });
  return {
    id: "tower",
    title: "通天塔",
    headers: ["層數", "關卡", "需要境界", "首關 HP", "末層 Boss HP", "末層 Boss 所需 DPS"],
    rows,
    notes: [
      `共 ${TOWER_FLOOR_COUNT} 層、${TOWER_TOTAL_STAGES} 關，每層 10 關：第 1、2、3、4、6、8 關普通、第 5、7 關強化、第 9 關精英、第 10 關守關 Boss。`,
      `限時：普通／強化／精英 ${getTowerTimeLimitSeconds(false)} 秒、Boss ${getTowerTimeLimitSeconds(true)} 秒；逾時算失敗，5 秒後自動重試，不扣任何資源。`,
      `通天塔戰鬥可選 ${TOWER_BATTLE_SPEEDS.map(speed => `${speed}`).join("／")} 倍速（戰鬥面板切換）：攻擊、動畫與倒數一起加快，限時以戰鬥時間計，平衡不變（30 秒的關卡現實約 ${TOWER_BATTLE_SPEEDS.map(speed => `${+(30 / speed).toFixed(1)}`).join("／")} 秒）。`,
      `難度倍率（所需 DPS）：普通 ×${towerBalanceConfig.kindDpsMultiplier.normal}、強化 ×${towerBalanceConfig.kindDpsMultiplier.enhanced}、精英 ×${towerBalanceConfig.kindDpsMultiplier.elite}、Boss ×${towerBalanceConfig.kindDpsMultiplier.boss}；怪物 HP＝所需 DPS × 限時。`,
      `首次通關獎勵：靈石 普通 12＋層數×4、Boss 160＋層數×40；修為＝預期境界修為速度 × 秒數（普通 ${towerBalanceConfig.firstClearCultivationSeconds.normal}、強化 ${towerBalanceConfig.firstClearCultivationSeconds.enhanced}、精英 ${towerBalanceConfig.firstClearCultivationSeconds.elite}、Boss ${towerBalanceConfig.firstClearCultivationSeconds.boss}）。重打不再給獎勵。`,
      "每個大境界開放 10 層；境界不足時無法挑戰，突破後即可繼續。",
    ],
  };
}

function beastTable(): RulesTable {
  return {
    id: "beasts",
    title: "靈獸",
    headers: ["靈獸", "屬性", "解鎖條件", "持有效果（解鎖即生效）", "出戰傷害（凝氣一層 → 永恆）"],
    rows: beastCatalog.map((beast, index) => [
      `${index + 1}. ${beast.nameZh}`,
      beast.elementZh,
      getBeastUnlockText(beast),
      formatBeastPossession(beast),
      `英雄 DPS 的 ${pct(getBeastDamageShare(beast, 0))} → ${pct(getBeastDamageShare(beast, BEAST_MAX_STAGE_INDEX))}`,
    ]),
    notes: [
      "所有已解鎖靈獸的持有效果都會疊加；同一時間只能有一隻靈獸出戰。",
      `出戰靈獸在通天塔每 ${BEAST_ATTACK_INTERVAL_MS / 1000} 秒（戰鬥時間）攻擊一次，傷害＝英雄 DPS × 出戰傷害比例 × ${BEAST_ATTACK_INTERVAL_MS / 1000}。`,
      "新解鎖的靈獸，會從目前最高靈獸所在大境界的初期開始。",
      "通天塔所需 DPS 已計入同進度玩家的出戰靈獸（照下表餵養），所以靈獸出戰後難度與原本相當；沒有餵養靈獸會比較吃力。",
    ],
  };
}

function beastRealmTable(): RulesTable {
  const rows = realmIds.map(realmId => {
    const indexes = BEAST_STAGES.flatMap((stage, index) => stage.realmId === realmId ? [index] : []);
    const first = indexes[0];
    const last = indexes[indexes.length - 1];
    const costs = indexes.map(index => beastStageCosts[index]).filter(cost => cost > 0);
    const costText = costs.length === 0 ? "起始" : costs[0] === costs[costs.length - 1] ? num(costs[0]) : `${num(costs[0])}～${num(costs[costs.length - 1])}`;
    return [
      BEAST_STAGES[first].realmNameZh,
      `${indexes.length}`,
      costText,
      num(getTotalBeastFeedCost(last)),
      `×${getBeastRealmDamageMultiplier(last).toFixed(2)}`,
      `${(demonCoresPerSecond[realmId] * 3600).toLocaleString("zh-TW", { maximumFractionDigits: 1 })}／時`,
    ];
  });
  return {
    id: "beast-realms",
    title: "靈獸境界",
    headers: ["境界", "小階數", "每次餵養（妖丹）", "累計到該境界圓滿", "出戰傷害倍率", "掛機妖丹（人物在此境界）"],
    rows,
    notes: [
      "靈獸境界與人物相同（凝氣一層 → 永恆）。每次餵養提升一個小階，跨大境界時為突破，必定成功。",
      `進度設計：同進度玩家把妖丹全餵給一隻靈獸時，靈獸到達各境界的時間＝人物時間 × ${BEAST_PACE.start}（凝氣）→ ×${BEAST_PACE.celestial}（天人）→ ×${BEAST_PACE.end}（永恆）。天人之前靈獸比人物快，天人之後比人物慢。`,
      "妖丹來源：掛機（隨人物境界提升，離線也照算）與通天塔首次通關（普通關 2＋層數÷5、Boss 關 20＋層數）。裂空雷鵬的持有效果會提高兩者。",
    ],
  };
}

export function buildGameRules(): readonly RulesTable[] {
  const alchemy: RulesTable = { id: "alchemy", title: "煉丹", headers: ["煉丹師", "累計次數", ...QUALITY_NAMES], rows: QUALITY_NAMES.map((name, i) => [name, String(ALCHEMIST_THRESHOLDS[i]), ...QUALITY_CHANCES[i].map(chance => `${chance}%`)]), notes: [`手動煉丹，每爐 5 秒，可選 1 次或 10 次，每次獨立判定，基礎成功率 ${pct(ALCHEMY_SUCCESS_RATE)}；蘇婉清雙修可提升成功率，上限 100%。`, "每次消耗目前大境界 60 秒的基礎修為，十次消耗十倍；每次不論成敗增加熟練度，批次內逐次套用新等級品級機率。", `七種丹藥：${PILL_CATALOG.map(pill => `${pill.name}（${pill.effect}）`).join("、")}。`, `每種丹藥每天（本機時間 0 點重置）最多服用 ${PILL_DAILY_LIMIT} 顆，累計不設上限。關閉期間已開始的煉丹會在重新登入後結算，不會自動開始下一次。`] };
  const pills: RulesTable = { id: "alchemy-effects", title: "丹藥效果", headers: ["丹藥・單一效果", ...QUALITY_NAMES], rows: PILL_CATALOG.map(pill => [`${pill.name}・${pill.effect}`, ...pill.values.map(value => `+${(value * 100).toFixed(2)}${pill.id === "crit" || pill.id === "breakthrough" ? " 個百分點" : "%"}`)]), notes: [`效果為每顆永久加成，天天服用可持續疊加；同種丹藥每天最多服用 ${PILL_DAILY_LIMIT} 顆（各品級合計）。`, "暴擊率與突破成功率上限為 100%。"] };
  return [realmTable(), weaponTable(), refinementTable(), beastTable(), beastRealmTable(), towerTable(), alchemy, pills];
}

/** Room kinds of one floor, for reference in docs/tests. */
export const FLOOR_ROOM_KINDS = Array.from({ length: TOWER_STAGES_PER_FLOOR }, (_, room) => getMonsterKind(room + 1));
