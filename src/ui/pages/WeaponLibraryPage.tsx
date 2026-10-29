import { useEffect, useState } from "react";
import { gameSaveCommands } from "../../features/persistence";
import { getNewRefinementAwakening, MAX_REFINEMENT_LEVEL, planRefinement } from "../../features/refinement";
import { getWeaponUnlockStatus, weaponCatalog } from "../../features/weapon";
import type { WeaponSelection } from "../hooks/useWeaponSelection";

interface WeaponLibraryPageProps {
  readonly navigation: JSX.Element;
  readonly selection: WeaponSelection;
  readonly spiritStones: number;
  readonly characterName: string;
}

/** Possession bonuses step by 0.25%, so keep up to two decimals, only when needed. */
const formatPercent = (value: number): string => String(Math.round(value * 10000) / 100);

export function WeaponLibraryPage({ navigation, selection, spiritStones, characterName }: WeaponLibraryPageProps): JSX.Element {
  const { weaponUnlockContext, selectedWeapon, selectedRefinement, nextRefinementCost, refinementBonuses, combatStats, activeWeaponEffects } = selection;
  // One-off burst when a refinement step reaches +11 or +21; `startedAt` restarts the animation.
  const [awakeningBurst, setAwakeningBurst] = useState<{ readonly kind: "spirit" | "immortal"; readonly startedAt: number } | null>(null);
  useEffect(() => {
    if (!awakeningBurst) return undefined;
    const timer = window.setTimeout(() => setAwakeningBurst(null), 1_800);
    return () => window.clearTimeout(timer);
  }, [awakeningBurst]);

  // One-click refinement: every level the stones pay for. Offered only when that is more than one.
  const batch = planRefinement(selectedRefinement, spiritStones);
  const refine = (all: boolean): void => {
    const previousLevel = selectedRefinement;
    const result = all ? gameSaveCommands.refineWeaponMax(selectedWeapon.weaponId) : gameSaveCommands.refineWeapon(selectedWeapon.weaponId);
    if (!result.ok) return;
    const awakening = getNewRefinementAwakening(previousLevel, previousLevel + (all ? batch.levels : 1));
    if (awakening !== "none") setAwakeningBurst({ kind: awakening, startedAt: Date.now() });
  };

  return (
    <main className="weapon-library" aria-label="仙劍庫">
      {navigation}
      <section className="weapon-library__content">
        <p className="eyebrow">{characterName}的法寶收藏</p>
        <h1>仙劍庫</h1>
        <p className="library-description">仙劍依境界與通天塔首次通關進度逐步開放。</p>
        <div className="library-grid">
          {weaponCatalog.map(weapon => {
            const unlockStatus = getWeaponUnlockStatus(weapon, weaponUnlockContext);
            return (
            <button key={weapon.weaponId} type="button" disabled={!unlockStatus.unlocked} className={unlockStatus.unlocked ? weapon.weaponId === selectedWeapon.weaponId ? "library-card is-selected" : "library-card" : "library-card is-locked"} onClick={() => { if (unlockStatus.unlocked) selection.selectWeapon(weapon.weaponId); }}>
              <img src={weapon.assetPath} alt="" />
              <span>{weapon.nameZh}</span>
              <small>{weapon.element}・{weapon.weaponType}</small>
              <small>{unlockStatus.unlocked ? `持有：${weapon.possessionEffect.nameZh}・${weapon.possessionEffect.descriptionZh}` : `未解鎖：${unlockStatus.requirementText}`}</small>
            </button>
            );
          })}
        </div>
        <section className="refinement-panel" aria-label="仙劍煉靈">
          {awakeningBurst && (
            <div key={awakeningBurst.startedAt} className={`awakening-burst awakening-burst--${awakeningBurst.kind}`} role="status">
              <span>{awakeningBurst.kind === "immortal" ? "仙器覺醒！" : "靈器覺醒！"}</span>
            </div>
          )}
          <div>
            <strong>{selectedWeapon.nameZh}・煉靈 +{selectedRefinement}</strong>
            <span>持有靈石：{spiritStones.toLocaleString("zh-TW")}</span>
            <small>
              {refinementBonuses.awakening === "immortal"
                ? "仙器覺醒：攻速 +50%、暴擊率 +25 個百分點"
                : refinementBonuses.awakening === "spirit"
                  ? "靈器覺醒：攻速 +20%、暴擊率 +10 個百分點"
                  : "+11 靈器覺醒／+21 仙器覺醒"}
            </small>
            <small>最終攻擊：{Math.round(combatStats.attack).toLocaleString("zh-TW")}・暴擊率：{(combatStats.critRate * 100).toFixed(1)}%・攻速：{combatStats.attackSpeed.toFixed(2)} 次／秒</small>
            <small>裝備效果：{selectedWeapon.equippedEffect.nameZh}・{selectedWeapon.equippedEffect.descriptionZh}</small>
            <small>已啟動持有加成：攻擊 +{formatPercent(activeWeaponEffects.possession.attackPercent)}%・暴擊 +{formatPercent(activeWeaponEffects.possession.critRateBonus)}%・攻速 +{formatPercent(activeWeaponEffects.possession.attackSpeedBonus)}%</small>
          </div>
          <div className="refinement-panel__actions">
            <button
              type="button"
              disabled={nextRefinementCost === null || spiritStones < (nextRefinementCost ?? 0)}
              onClick={() => refine(false)}
            >
              {nextRefinementCost === null
                ? `已達 +${MAX_REFINEMENT_LEVEL}`
                : `煉靈至 +${selectedRefinement + 1}（${nextRefinementCost.toLocaleString("zh-TW")} 靈石）`}
            </button>
            {batch.levels > 1 && (
              <button type="button" className="refinement-panel__batch" onClick={() => refine(true)}>
                一鍵煉靈至 +{batch.toLevel}（{batch.cost.toLocaleString("zh-TW")} 靈石）
              </button>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
