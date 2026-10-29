import { gameSaveCommands } from "../../features/persistence";
import type { RealmId } from "../../features/cultivation";
import { getTowerDemonCoreReward } from "../../features/beast";
import {
  getRealmNameZh,
  getRequiredRealmForStage,
  getTowerClearReward,
  getTowerFarmStage,
  getTowerRepeatReward,
  getTowerStage,
  getTowerStageCapForRealm,
  isTowerStageRealmLocked,
  towerBalanceConfig,
  type TowerProgress,
  type TowerStage,
} from "../../features/tower";

const count = (value: number): string => value.toLocaleString("zh-TW");

/** What clearing the stage gives: the first clear, the realm-gated farming drop, or nothing. */
function rewardLine(stage: TowerStage, tower: TowerProgress, farmStage: number | null): string {
  if (stage.stageNumber > tower.highestClearedStage) {
    const reward = getTowerClearReward(stage);
    return `首次通關獎勵：修為 +${count(reward.cultivation)}・靈石 +${count(reward.spiritStones)}・妖丹 +${count(getTowerDemonCoreReward(stage.stageNumber))}`;
  }
  if (stage.stageNumber !== farmStage) return "已通關：重打沒有獎勵";
  const reward = getTowerRepeatReward(stage);
  const demonCores = Math.max(1, Math.round(getTowerDemonCoreReward(stage.stageNumber) * towerBalanceConfig.repeatClear.share.demonCores));
  return `卡關重複挑戰（每 ${towerBalanceConfig.repeatClear.intervalSeconds} 秒一隻）：修為 +${count(reward.cultivation)}・靈石 +${count(reward.spiritStones)}・妖丹 +${count(demonCores)}`;
}

interface TowerPageProps {
  readonly navigation: JSX.Element;
  readonly tower: TowerProgress;
  readonly dps: number;
  readonly realmId: RealmId;
  readonly onChallenge: () => void;
}

export function TowerPage({ navigation, tower, dps, realmId, onChallenge }: TowerPageProps): JSX.Element {
  const stage = getTowerStage(tower.selectedStage);
  const realmLocked = isTowerStageRealmLocked(stage.stageNumber, realmId);
  const realmCap = getTowerStageCapForRealm(realmId);
  // While the realm gate holds, entering the battle farms the highest cleared stage.
  const farmStage = getTowerFarmStage(tower, realmId);
  const selectStage = (stageNumber: number): void => {
    if (stageNumber < 1 || stageNumber > tower.unlockedStage) return;
    gameSaveCommands.setTowerProgress({ ...tower, selectedStage: stageNumber });
  };
  return (
    <main className="weapon-library tower-page" aria-label="通天塔">
      {navigation}
      <section className="weapon-library__content">
        <p className="eyebrow">純輸出挑戰・怪物不反擊</p>
        <h1>通天塔</h1>
        <p className="library-description">已通關 {tower.highestClearedStage} / 1000 關・目前解鎖至第 {tower.unlockedStage} 關・「{getRealmNameZh(realmId)}」境界可挑戰至第 {realmCap / 10} 層</p>
        <section className="tower-stage-card">
          <strong>第 {stage.floor} 層・第 {stage.room} 關　{stage.isBoss ? "守關 Boss" : stage.monsterKind === "elite" ? "精英妖獸" : stage.monsterKind === "enhanced" ? "強化妖獸" : "普通妖獸"}</strong>
          <span>怪物 HP：{stage.monsterMaxHp.toLocaleString("zh-TW")}・限時：{stage.timeLimitSeconds} 秒</span>
          <span>限時內擊殺所需 DPS：{Math.ceil(stage.requiredDps).toLocaleString("zh-TW")}（固定關卡數值）</span>
          <span>目前預估 DPS（含出戰靈獸）：{dps.toFixed(1)}・預估擊殺：{Math.max(0.1, stage.monsterMaxHp / dps).toFixed(1)} 秒</span>
          <span>{rewardLine(stage, tower, farmStage)}</span>
        </section>
        <div className="tower-controls">
          <button type="button" disabled={tower.selectedStage <= 1} onClick={() => selectStage(tower.selectedStage - 1)}>上一關</button>
          <button type="button" disabled={tower.selectedStage >= tower.unlockedStage} onClick={() => selectStage(tower.selectedStage + 1)}>下一關</button>
          <label><input type="checkbox" checked={tower.autoAdvance} onChange={event => gameSaveCommands.setTowerProgress({ ...tower, autoAdvance: event.target.checked })} /> 通關後自動下一關</label>
        </div>
        <button className="enter-battle-button" type="button" disabled={realmLocked && farmStage === null} onClick={onChallenge}>
          {realmLocked
            ? farmStage === null
              ? `需達到「${getRealmNameZh(getRequiredRealmForStage(stage.stageNumber))}」境界`
              : `需達到「${getRealmNameZh(getRequiredRealmForStage(stage.stageNumber))}」境界・先重複挑戰第 ${farmStage} 關`
            : `挑戰第 ${tower.selectedStage} 關`}
        </button>
      </section>
    </main>
  );
}
