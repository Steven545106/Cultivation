import { useEffect, useState } from "react";
import { companionCatalog, isCompanionUnlocked, getIntimacyLevel, normalizeIntimacy, getNextIntimacyThreshold, getDualCombatBonus, getDualCultivationBonus, getDualAlchemySuccessBonus, getDualSpecialty, getCompanionRealm, MAX_INTIMACY } from "../../features/companion/companionCatalog";
import { INTIMACY_POINT_MS } from "../../features/companion/intimacyTime";
import { getRealmStage } from "../../features/cultivation/domain/RealmCatalog";
import { getRealmNameZh } from "../../features/tower/domain/TowerRealmGate";
import { gameSaveCommands, type GameSaveData } from "../../features/persistence";
import { getCompanionSprite } from "../../features/companion/domain/companionSprites";
import { SpriteAnimation } from "../SpriteAnimation";

export function CompanionPage({ navigation, save }: { readonly navigation: JSX.Element; readonly save: GameSaveData }): JSX.Element {
  const [previewCompanionId, setPreviewCompanionId] = useState<string | null>(null);
  const previewCompanion = companionCatalog.find(companion => companion.id === previewCompanionId);

  useEffect(() => {
    if (!previewCompanionId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewCompanionId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewCompanionId]);

  return (
    <main className="weapon-library companion-page" aria-label="道侶">
      {navigation}
      <section className="weapon-library__content">
        <p className="eyebrow">仙途漫漫・與君同行</p>
        <h1>道侶</h1>
        <p className="library-description">結緣道侶，共赴仙途。已結緣的修煉加成可疊加；雙修每 10 分鐘增加 1 點親密度，最高五級。</p>
        <div className="companion-grid">
          {companionCatalog.map((companion, index) => <article className="companion-card" key={companion.id}>
            {(() => {
              const sprite = getCompanionSprite(companion.id);
              return sprite
                ? <button className="companion-card__portrait-button" type="button" aria-label={`放大檢視${companion.name}`} onClick={() => setPreviewCompanionId(companion.id)}><SpriteAnimation sprite={sprite} className="companion-card__portrait" /></button>
                : <img className="companion-card__portrait" src={companion.image} alt={`${companion.name}立繪`} />;
            })()}
            <h2>{companion.name}</h2>
            <span>{companion.element}修士</span>
            <p>{companion.description}</p>
            <p>初始境界：{getRealmStage(companion.initialStageId).displayNameZh}</p>
            <p>目前境界：{getCompanionRealm(companion, save.companionIntimacy[companion.id]).displayNameZh}</p>
            <p>結緣加成：修煉速度 +{index + 1}%</p>
            <p>親密度：{getIntimacyLevel(save.companionIntimacy[companion.id])} 級・累積 {normalizeIntimacy(save.companionIntimacy[companion.id])}/{MAX_INTIMACY} 點</p>
            <p>雙修加成：修煉速度 +{Math.round(getDualCultivationBonus(companion.id, companion.unlockStage, companion.requiredRealm, save.companionIntimacy[companion.id]) * 100)}%</p>
            {companion.id === "su-wanqing" && <p>雙修煉丹成功率 +{Math.round(getDualAlchemySuccessBonus(companion.id, companion.unlockStage, companion.requiredRealm, save.companionIntimacy[companion.id]) * 100)} 個百分點（上限 100%）</p>}
            {companion.id !== "su-wanqing" && (() => { const specialty = getDualSpecialty(companion.id, companion.unlockStage, companion.requiredRealm, save.companionIntimacy[companion.id], companion.id === "lin-tingxue" ? "冰" : "月"); const amount = specialty.weaponAttackPercent || specialty.breakthroughBonus || specialty.skillCooldownReduction; return <p>專長：{companion.id === "lin-tingxue" ? "冰系仙劍攻擊" : companion.id === "murong-wanyue" ? "月系仙劍攻擊" : companion.id === "gu-xinglan" ? "突破成功率" : "仙劍技能冷卻縮短"} +{Math.round(amount * 100)}{companion.id === "gu-xinglan" ? " 個百分點" : "%"}{companion.id === "nangong-yunshu" ? "（技能尚未開放）" : ""}</p>; })()}
            {(() => { const bonus = getDualCombatBonus(companion.id, companion.unlockStage, companion.requiredRealm, save.companionIntimacy[companion.id]); return <p>攻擊 +{(bonus.attackPercent * 100).toFixed(1)}%・暴擊 +{(bonus.critRateBonus * 100).toFixed(1)} 個百分點・攻速 +{(bonus.attackSpeedBonus * 100).toFixed(1)}%</p>; })()}
            {!isCompanionUnlocked(companion, save.tower.highestClearedStage, save.cultivation.realmId)
              ? <span>{companion.unlockStage > 0 ? `結緣條件：通關通天塔第 ${companion.unlockStage / 10} 層，且` : "結緣條件："}主角達到{getRealmNameZh(companion.requiredRealm)}</span>
              : <button type="button" onClick={() => gameSaveCommands.selectCompanion(save.activeCompanionId === companion.id ? null : companion.id)}>{save.activeCompanionId === companion.id ? "停止雙修" : "開始雙修"}</button>}
            {save.activeCompanionId === companion.id && <p><span>{getNextIntimacyThreshold(save.companionIntimacy[companion.id]) !== null ? `雙修中・距離下級 ${getNextIntimacyThreshold(save.companionIntimacy[companion.id])! - normalizeIntimacy(save.companionIntimacy[companion.id])} 點` : "親密度已滿級"}</span></p>}
            {save.activeCompanionId === companion.id && normalizeIntimacy(save.companionIntimacy[companion.id]) < MAX_INTIMACY && <p>下一點親密度：約 {Math.ceil((INTIMACY_POINT_MS - (save.companionIntimacyRemainders[companion.id] ?? 0)) / 60000)} 分鐘</p>}
          </article>)}
        </div>
      </section>
      {previewCompanion && <div className="companion-preview-overlay" onClick={() => setPreviewCompanionId(null)}>
        <section className="companion-preview" role="dialog" aria-modal="true" aria-labelledby="companion-preview-title" onClick={event => event.stopPropagation()}>
          <header className="companion-preview__header"><h2 id="companion-preview-title">{previewCompanion.name}</h2><button type="button" aria-label={`關閉${previewCompanion.name}預覽`} onClick={() => setPreviewCompanionId(null)} autoFocus>✕</button></header>
          {(() => { const sprite = getCompanionSprite(previewCompanion.id); return sprite ? <SpriteAnimation sprite={sprite} label={`${previewCompanion.name}放大立繪`} /> : <img src={previewCompanion.image} alt={`${previewCompanion.name}放大立繪`} />; })()}
        </section>
      </div>}
    </main>
  );
}
