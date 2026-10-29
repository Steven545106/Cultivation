import type { CSSProperties } from "react";
import {
  BEAST_MAX_STAGE_INDEX,
  BEAST_STAGES,
  beastCatalog,
  formatBeastPossession,
  formatBeastPossessionValue,
  getBeastDamageShare,
  getBeastFeedCost,
  getBeastPossessionBonuses,
  getBeastPossessionLabel,
  getBeastStageIndex,
  getBeastUnlockText,
  isBeastBreakthrough,
  isBeastUnlocked,
  planBeastFeeding,
  resolveDeployedBeast,
  type BeastConfig,
  type BeastPossessionStat,
} from "../../features/beast";
import { gameSaveCommands, type GameSaveData } from "../../features/persistence";

interface BeastPageProps {
  readonly navigation: JSX.Element;
  readonly save: GameSaveData;
  readonly heroDps: number;
}

const pct = (value: number): string => `${Math.round(value * 1000) / 10}%`;
const POSSESSION_STATS: readonly BeastPossessionStat[] = ["cultivationSpeed", "spiritStoneSpeed", "demonCoreYield"];

/**
 * Five spirit beasts: unlocked ones give their possession bonus, one fights in
 * the tower (出戰), and each climbs the hero's realms when fed 妖丹 (餵養).
 */
export function BeastPage({ navigation, save, heroDps }: BeastPageProps): JSX.Element {
  const cleared = save.tower.highestClearedStage;
  const deployed = resolveDeployedBeast(save.beasts.deployedBeastId, cleared);
  const deployedStage = getBeastStageIndex(save.beasts, deployed.beastId);
  const bonuses = getBeastPossessionBonuses(cleared, beast => getBeastStageIndex(save.beasts, beast.beastId));
  const deployedShare = getBeastDamageShare(deployed, deployedStage);
  return (
    <main className="weapon-library beast-page" aria-label="靈獸">
      {navigation}
      <section className="weapon-library__content">
        <p className="eyebrow">{save.characterName}的契約靈獸</p>
        <h1>靈獸</h1>
        <p className="library-description">解鎖的靈獸都提供持有加成；選一隻出戰，牠會在通天塔跟著{save.characterName}一起攻擊。餵養妖丹可提升靈獸境界：出戰傷害與持有加成都會隨境界成長，沒出戰的靈獸也一樣。</p>
        <p className="beast-page__cores" aria-label="目前妖丹">目前妖丹：<strong>{save.demonCores.toLocaleString("zh-TW")}</strong></p>
        <div className="library-grid beast-grid">
          {beastCatalog.map(beast => (
            <BeastCard
              key={beast.beastId}
              beast={beast}
              unlocked={isBeastUnlocked(beast, cleared)}
              deployed={beast.beastId === deployed.beastId}
              stageIndex={getBeastStageIndex(save.beasts, beast.beastId)}
              demonCores={save.demonCores}
            />
          ))}
        </div>
        <section className="refinement-panel beast-summary" aria-label="靈獸加成">
          <div>
            <strong>出戰：{deployed.nameZh}・{BEAST_STAGES[deployedStage].displayNameZh}</strong>
            <small>每 1.5 秒攻擊一次，約增加 {Math.round(heroDps * deployedShare).toLocaleString("zh-TW")} DPS（英雄 DPS 的 {pct(deployedShare)}）</small>
            <small>
              已啟動持有加成：{POSSESSION_STATS.map(stat => `${getBeastPossessionLabel(stat)} +${pct(bonuses[stat])}`).join("・")}
            </small>
          </div>
        </section>
      </section>
    </main>
  );
}

interface BeastCardProps {
  readonly beast: BeastConfig;
  readonly unlocked: boolean;
  readonly deployed: boolean;
  readonly stageIndex: number;
  readonly demonCores: number;
}

function BeastCard({ beast, unlocked, deployed, stageIndex, demonCores }: BeastCardProps): JSX.Element {
  const isDeployed = unlocked && deployed;
  const accent = `#${beast.glowColor.toString(16).padStart(6, "0")}`;
  const cost = getBeastFeedCost(stageIndex);
  const breakthrough = isBeastBreakthrough(stageIndex);
  const feedLabel = cost === null
    ? "已達永恆"
    : `${breakthrough ? `突破至${BEAST_STAGES[stageIndex + 1].realmNameZh}` : "餵養"}（${cost.toLocaleString("zh-TW")} 妖丹）`;
  // Continuous feeding: every stage the 妖丹 pay for. Offered only when that is more than one.
  const batch = planBeastFeeding(stageIndex, demonCores);
  return (
    <article
      className={["library-card", "beast-card", unlocked ? "" : "is-locked", isDeployed ? "is-selected" : ""].filter(Boolean).join(" ")}
      style={{ "--beast-accent": accent } as CSSProperties}
      aria-label={beast.nameZh}
    >
      <img src={beast.assetPath} alt="" />
      <span>{beast.nameZh}</span>
      <small>{beast.elementZh}屬性{unlocked ? `・${BEAST_STAGES[stageIndex].displayNameZh}` : ""}</small>
      {unlocked ? (
        <>
          <small>持有：{formatBeastPossession(beast, stageIndex)}{stageIndex < BEAST_MAX_STAGE_INDEX ? `（永恆 ${formatBeastPossessionValue(beast, BEAST_MAX_STAGE_INDEX)}）` : ""}</small>
          <small>出戰傷害：英雄 DPS 的 {pct(getBeastDamageShare(beast, stageIndex))}</small>
          <div className="beast-card__actions">
            <button
              type="button"
              className={isDeployed ? "beast-card__deploy is-deployed" : "beast-card__deploy"}
              disabled={isDeployed}
              onClick={() => gameSaveCommands.deployBeast(beast.beastId)}
            >
              {isDeployed ? "出戰中" : "出戰"}
            </button>
            <button
              type="button"
              className={breakthrough ? "beast-card__feed is-breakthrough" : "beast-card__feed"}
              disabled={cost === null || demonCores < cost}
              onClick={() => gameSaveCommands.feedBeast(beast.beastId)}
            >
              {feedLabel}
            </button>
            {batch.levels > 1 && (
              <button type="button" className="beast-card__feed beast-card__feed--batch" onClick={() => gameSaveCommands.feedBeastMax(beast.beastId)}>
                連續餵養至{BEAST_STAGES[batch.toStageIndex].displayNameZh}（{batch.cost.toLocaleString("zh-TW")} 妖丹）
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <small>未解鎖：{getBeastUnlockText(beast)}</small>
          <small>初始境界：{BEAST_STAGES[stageIndex].displayNameZh}・出戰傷害 {pct(getBeastDamageShare(beast, stageIndex))}</small>
        </>
      )}
    </article>
  );
}
