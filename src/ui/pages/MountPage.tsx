import { useState } from "react";
import type { CompanionSprite } from "../../features/companion/domain/companionSprites";
import {
  getMount,
  getMountBonus,
  getMountLevel,
  getMountUpgradeCost,
  isMountUnlocked,
  mountCatalog,
  MOUNT_MAX_LEVEL,
  readMountProgress,
  type MountConfig,
  type MountId,
  type MountSprite,
} from "../../features/mount";
import { mountCommands } from "../../features/mount/application/mountCommands";
import type { GameSaveData } from "../../features/persistence";
import { SpriteAnimation } from "../SpriteAnimation";

const pct = (value: number): string => `${Math.round(value * 10000) / 100}%`;

const toSprite = (sprite: MountSprite): CompanionSprite => ({
  sheet: sprite.sheet,
  poster: sprite.poster,
  cols: sprite.cols,
  cellWidth: sprite.cellWidth,
  cellHeight: sprite.cellHeight,
  steps: Array.from({ length: sprite.frames }, (_, cell) => ({ cell, holdMs: sprite.frameMs })),
  blendMs: 0,
});

/**
 * 坐騎: every mount with its idle animation. Owned mounts can be deployed
 * (出戰, only that one gives its bonus) and upgraded with spirit stones.
 */
export function MountPage({ navigation, save }: { readonly navigation: JSX.Element; readonly save: GameSaveData }): JSX.Element {
  const cleared = save.tower.highestClearedStage;
  const progress = readMountProgress(save.otherProgress, cleared);
  const [viewedId, setViewedId] = useState<MountId>(progress.deployedMountId);
  const viewed = getMount(viewedId);
  return (
    <main className="weapon-library mount-page" aria-label="坐騎">
      {navigation}
      <section className="weapon-library__content mount-content">
        <p className="eyebrow">{save.characterName}的御行坐騎</p>
        <h1>坐騎</h1>
        <p className="library-description">選一隻坐騎出戰，獲得牠的加成；用靈石升級可提升加成，最高 {MOUNT_MAX_LEVEL} 級。</p>
        <MountShowcase mount={viewed} cleared={cleared} level={getMountLevel(progress, viewed.id)} deployed={progress.deployedMountId === viewed.id} spiritStones={save.spiritStones} />
        <div className="mount-grid" role="list" aria-label="坐騎列表">
          {mountCatalog.map(mount => {
            const level = getMountLevel(progress, mount.id);
            return (
              <button
                key={mount.id}
                type="button"
                role="listitem"
                className={["mount-card", mount.id === viewedId ? "is-viewed" : "", level > 0 ? "" : "is-locked", progress.deployedMountId === mount.id ? "is-deployed" : ""].filter(Boolean).join(" ")}
                onClick={() => setViewedId(mount.id)}
                aria-pressed={mount.id === viewedId}
              >
                {mount.sprite ? <img src={mount.sprite.poster} alt="" draggable={false} /> : <span className="mount-card__placeholder" aria-hidden="true">？</span>}
                <strong>{mount.nameZh}</strong>
                <small>{level > 0 ? `${mount.kindZh}・${level} 級` : mount.unlockZh ?? "未解鎖"}</small>
                {progress.deployedMountId === mount.id && <em>出戰中</em>}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function MountShowcase({ mount, cleared, level, deployed, spiritStones }: { readonly mount: MountConfig; readonly cleared: number; readonly level: number; readonly deployed: boolean; readonly spiritStones: number }): JSX.Element {
  const owned = level > 0 && isMountUnlocked(mount, cleared);
  const cost = getMountUpgradeCost(level);
  return (
    <section className="mount-showcase" aria-label={mount.nameZh}>
      <div className="mount-showcase__stage">
        {mount.sprite
          ? <SpriteAnimation key={mount.id} sprite={toSprite(mount.sprite)} className="mount-showcase__sprite" label={`${mount.nameZh}待機動畫`} />
          : <span className="mount-showcase__placeholder">{mount.nameZh}・圖鑑繪製中</span>}
      </div>
      <div className="mount-showcase__info">
        <h2>{mount.nameZh}<small>{mount.kindZh}</small></h2>
        <p>{mount.description}</p>
        {owned ? (
          <>
            <p className="mount-showcase__stat">等級 <strong>{level}</strong> / {MOUNT_MAX_LEVEL}・出戰加成：{mount.stat === "spiritStoneSpeed" ? "靈石速度" : "修為速度"} <strong>+{pct(getMountBonus(mount, level))}</strong>{level < MOUNT_MAX_LEVEL ? `（下一級 +${pct(getMountBonus(mount, level + 1))}）` : ""}</p>
            <div className="mount-showcase__actions">
              <button type="button" className="mount-showcase__deploy" disabled={deployed} onClick={() => mountCommands.deploy(mount.id)}>{deployed ? "出戰中" : "出戰"}</button>
              <button type="button" className="mount-showcase__upgrade" disabled={cost === null || spiritStones < cost} onClick={() => mountCommands.upgrade(mount.id)}>
                {cost === null ? "已達最高等級" : `升級（${cost.toLocaleString("zh-TW")} 靈石）`}
              </button>
            </div>
            <p className="mount-showcase__stones">目前靈石：{Math.floor(spiritStones).toLocaleString("zh-TW")}</p>
          </>
        ) : (
          <p className="mount-showcase__stat">尚未解鎖：{mount.unlockZh ?? "敬請期待"}</p>
        )}
      </div>
    </section>
  );
}
