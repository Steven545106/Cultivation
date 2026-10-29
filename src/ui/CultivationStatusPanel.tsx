import { useEffect, useState, useSyncExternalStore } from "react";
import {
  cultivationService,
  estimateSecondsToEternal,
  getCurrentBreakthroughSuccessRate,
  type PlayerCultivationState,
  ORIGINAL_TARGET_SECONDS,
} from "../features/cultivation";
import { gameSaveCommands, gameSaveStore } from "../features/persistence";
import { MAX_CHARACTER_NAME_LENGTH } from "../features/character/domain/characterName";
import { getDualSpecialty } from "../features/companion/companionCatalog";
import { pillBonus } from "../features/alchemy/Alchemy";
import { getWeaponById } from "../features/weapon";
import { getRefinementAttackBonus, getRefinementCritBonus } from "../features/refinement";
import { calculateFinalCombatStats } from "../features/combat";
import { getRealmCombatStats } from "../features/realm";
import { getLoadoutCombatStats } from "./hooks/loadoutCombatStats";

function useCultivationState(): PlayerCultivationState {
  useEffect(() => {
    cultivationService.start();
  }, []);
  return useSyncExternalStore(cultivationService.subscribe, cultivationService.getSnapshot, cultivationService.getSnapshot);
}

function formatFull(value: number): string {
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(value >= 1_000_000_000 ? 1 : 2)}億`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 1 : 2)}萬`;
  return formatFull(value);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  const value = Math.max(0, Math.ceil(seconds));
  const days = Math.floor(value / 86400);
  const hours = Math.floor(value % 86400 / 3600);
  const minutes = Math.floor(value % 3600 / 60);
  const secs = value % 60;
  if (days > 0) return `${days}天${hours}時${minutes}分`;
  if (hours > 0) return `${hours}時${minutes}分`;
  if (minutes > 0) return `${minutes}分${secs}秒`;
  return `${secs}秒`;
}

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

export function CultivationStatusPanel(): JSX.Element {
  const state = useCultivationState();
  const gameSave = useSyncExternalStore(gameSaveStore.subscribe, gameSaveStore.getSnapshot, gameSaveStore.getSnapshot);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const currentStage = cultivationService.getCurrentStage();
  const nextStage = cultivationService.getNextStage();
  const rate = cultivationService.getEffectiveCultivationRate();
  const nextRequired = currentStage.cultivationRequired;
  const currentProgress = nextRequired === null ? 1 : Math.min(1, state.currentCultivation / nextRequired);
  const nextAdvanceSeconds = nextRequired === null ? 0 : Math.max(0, nextRequired - state.currentCultivation) / rate;
  const elapsedSeconds = state.totalElapsedTime / 1000;
  const targetRemainingSeconds = Math.max(0, ORIGINAL_TARGET_SECONDS - elapsedSeconds);
  const eternalEstimateSeconds = estimateSecondsToEternal(state);
  const canBreakthrough = cultivationService.isBreakthroughAvailable();
  const companionBreakthrough = getDualSpecialty(gameSave.save.activeCompanionId, gameSave.save.tower.highestClearedStage, gameSave.save.cultivation.realmId, gameSave.save.activeCompanionId ? gameSave.save.companionIntimacy[gameSave.save.activeCompanionId] : 0).breakthroughBonus;
  const breakthroughRate = getCurrentBreakthroughSuccessRate(state, companionBreakthrough + pillBonus(gameSave.save.alchemy, "breakthrough"));
  const [breakthroughNotice, setBreakthroughNotice] = useState<{ readonly ok: boolean; readonly text: string } | null>(null);
  useEffect(() => {
    if (!breakthroughNotice) return undefined;
    const timer = window.setTimeout(() => setBreakthroughNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [breakthroughNotice]);
  const breakthrough = (): void => {
    const targetName = nextStage?.displayNameZh ?? "";
    const result = cultivationService.attemptBreakthrough();
    if (result.ok) setBreakthroughNotice({ ok: true, text: `突破成功！踏入${targetName}` });
    else if (result.reason === "failed") setBreakthroughNotice({ ok: false, text: `突破失敗，損失 ${formatFull(result.lostCultivation ?? 0)} 修為；下次成功率提升` });
  };
  const equippedWeapon = getWeaponById(gameSave.save.equippedWeaponId);
  const realmCombat = getRealmCombatStats(currentStage.stageId);
  // Same calculation as the sword library and battle page, including sword effects.
  const loadout = equippedWeapon ? getLoadoutCombatStats(gameSave.save, equippedWeapon) : null;
  const refinementLevel = loadout?.refinementLevel ?? 0;
  const combatStats = loadout?.stats ?? calculateFinalCombatStats(realmCombat, null);

  return (
    <aside className="cultivation-status" aria-label={`${gameSave.save.characterName}修為資訊`}>
      <header className="cultivation-status__header">
        <div>
          <p>角色名稱</p>
          {editingName ? <form className="character-rename" onSubmit={event => {
            event.preventDefault();
            if (!gameSaveCommands.renameCharacter(nameDraft)) {
              setNameError(`請輸入 1～${MAX_CHARACTER_NAME_LENGTH} 個字，且不要使用控制字元。`);
              return;
            }
            setNameError("");
            setEditingName(false);
          }}>
            <label>新角色名稱 <input value={nameDraft} maxLength={32} onChange={event => setNameDraft(event.target.value)} autoFocus /></label>
            <button type="submit">儲存</button>
            <button type="button" onClick={() => { setEditingName(false); setNameError(""); }}>取消</button>
            {nameError && <span role="alert">{nameError}</span>}
          </form> : <div className="character-name"><h2>{gameSave.save.characterName}</h2><button type="button" onClick={() => { setNameDraft(gameSave.save.characterName); setEditingName(true); }}>改名</button></div>}
        </div>
        <div className="cultivation-status__realm">
          <span>目前境界</span>
          <strong>{currentStage.displayNameZh}</strong>
        </div>
      </header>

      <div className="cultivation-status__metrics">
        <div title={formatFull(state.totalCultivationEarned)}><span>歷史累積修為</span><strong>{formatCompact(state.totalCultivationEarned)}</strong></div>
        <div title={formatFull(state.currentCultivation)}><span>目前可用修為</span><strong>{formatCompact(state.currentCultivation)}</strong></div>
        <div><span>每秒修為</span><strong>+{rate.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}/秒</strong></div>
        <div title={formatFull(gameSave.save.spiritStones)}><span>目前靈石</span><strong>{formatCompact(gameSave.save.spiritStones)}</strong></div>
        <div title={formatFull(gameSave.save.demonCores)}><span>目前妖丹</span><strong>{formatCompact(gameSave.save.demonCores)}</strong></div>
      </div>

      <section className="cultivation-status__progress" aria-label="進階進度">
        <div className="cultivation-status__line">
          <span>{nextStage ? `下一階段：${nextStage.displayNameZh}` : "下一階段：已達永恆"}</span>
          <strong>{nextRequired === null ? "最高境界" : `${formatCompact(state.currentCultivation)} / ${formatCompact(nextRequired)}`}</strong>
        </div>
        <div className="cultivation-progress-bar" aria-hidden="true"><i style={{ width: `${currentProgress * 100}%` }} /></div>
        <div className="cultivation-status__line cultivation-status__hint">
          <span>{nextRequired === null ? "永恆長存" : `下一階段需要：${formatFull(nextRequired)}`}</span>
          <span>{nextRequired === null ? "" : `預估進階：${formatDuration(nextAdvanceSeconds)}`}</span>
        </div>
      </section>

      {canBreakthrough && (
        <button className="breakthrough-button" type="button" onClick={breakthrough}>
          突破至{nextStage?.displayNameZh}（成功率 {Math.round((breakthroughRate ?? 1) * 100)}%）
        </button>
      )}
      {breakthroughNotice && (
        <p className={breakthroughNotice.ok ? "breakthrough-notice is-success" : "breakthrough-notice is-failure"} role="status">{breakthroughNotice.text}</p>
      )}

      <section className="combat-status" aria-label="角色戰鬥屬性">
        <div><span>境界戰力</span><strong>攻擊 ×{realmCombat.attackMultiplier.toFixed(2)}・{(realmCombat.critRate * 100).toFixed(1)}% 暴擊</strong></div>
        <div><span>裝備仙劍</span><strong>{equippedWeapon ? `${equippedWeapon.nameZh} +${refinementLevel}` : "徒手"}</strong></div>
        {equippedWeapon && <div><span>仙劍基礎</span><strong>{equippedWeapon.baseDamage} 攻擊・{(equippedWeapon.baseCritRate * 100).toFixed(0)}% 暴擊・{equippedWeapon.attackSpeed.toFixed(2)}／秒</strong></div>}
        <div><span>煉靈加成</span><strong>攻擊 +{(getRefinementAttackBonus(refinementLevel) * 100).toFixed(0)}%・暴擊 +{(getRefinementCritBonus(refinementLevel) * 100).toFixed(0)} 個百分點</strong></div>
        {loadout && <div><span>仙劍效果</span><strong>攻擊 +{(loadout.effects.total.attackPercent * 100).toFixed(0)}%・暴擊 +{(loadout.effects.total.critRateBonus * 100).toFixed(0)}%・攻速 +{(loadout.effects.total.attackSpeedBonus * 100).toFixed(0)}%</strong></div>}
        <div><span>最終戰鬥屬性</span><strong>攻擊 {Math.round(combatStats.attack).toLocaleString("zh-TW")}・暴擊 {(combatStats.critRate * 100).toFixed(1)}%・攻速 {combatStats.attackSpeed.toFixed(2)}／秒</strong></div>
        <div><span>暴擊倍率／預估普攻 DPS</span><strong>200% ／ {combatStats.dps.toFixed(2)}</strong></div>
      </section>

      <footer className="cultivation-status__footer">
        <span>建立於：{formatDateTime(state.createdAt)}</span>
        <span>已修練：{formatDuration(elapsedSeconds)}</span>
        <span>七天目標倒數：{formatDuration(targetRemainingSeconds)}</span>
        <span>預估至永恆：{eternalEstimateSeconds === 0 ? "已達永恆" : formatDuration(eternalEstimateSeconds)}</span>
      </footer>
    </aside>
  );
}
