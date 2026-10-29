import { lazy, Suspense, useEffect, useState } from "react";
import type { GameRuntime } from "../../game/GameRuntime";
import { getTowerTheme, towerBalanceConfig } from "../../features/tower";
import type { CSSProperties } from "react";
import { getWeaponUnlockStatus, weaponCatalog } from "../../features/weapon";
import { TowerSpeedControl } from "./TowerSpeedControl";
import { WeaponCalibrationPanel } from "../WeaponCalibrationPanel";
import type { TowerChallengeSession } from "../hooks/useTowerChallengeSession";
import { TowerCountdownBar } from "./TowerCountdownBar";
import type { WeaponSelection } from "../hooks/useWeaponSelection";

/** Seconds until the next farmed monster appears; owns its own tick. */
function RespawnCountdown({ at }: { readonly at: number }): JSX.Element {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [at]);
  return <span className="tower-respawn"> 下一隻妖獸 {Math.max(0, Math.ceil((at - now) / 1000))} 秒後出現。</span>;
}

/** Phaser loads in its own chunk; the battle starts as soon as it arrives, whatever page is shown. */
const PhaserGame = lazy(async () => ({ default: (await import("../PhaserGame")).PhaserGame }));

interface BattlePageProps {
  readonly navigation: JSX.Element | null;
  readonly characterName: string;
  /** True while another page is shown: the battle keeps running, hidden behind it. */
  readonly background?: boolean;
  readonly runtime: GameRuntime | null;
  readonly onRuntimeReady: (runtime: GameRuntime) => void;
  readonly isTowerMode: boolean;
  readonly selection: WeaponSelection;
  readonly towerSession: TowerChallengeSession;
  /** Opens the tower stage list (pick a stage, toggle auto-advance). */
  readonly onOpenStageSelect: () => void;
}

export function BattlePage({ navigation, characterName, background = false, runtime, onRuntimeReady, isTowerMode, selection, towerSession, onOpenStageSelect }: BattlePageProps): JSX.Element {
  const { equippedWeapon, combatStats, weaponUnlockContext } = selection;
  const { towerChallenge, towerRewardNotice, towerRealmLock } = towerSession;
  // The battle engine (Phaser, ~1.5 MB) starts once the page in front has painted and the
  // browser is idle, or at once when the battle itself is shown.
  const [engineWanted, setEngineWanted] = useState(!background);
  useEffect(() => {
    if (engineWanted) return undefined;
    if (!background) {
      setEngineWanted(true);
      return undefined;
    }
    const start = () => setEngineWanted(true);
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(start, { timeout: 2_000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(start, 800);
    return () => window.clearTimeout(timer);
  }, [background, engineWanted]);
  const farming = towerRealmLock !== null && towerChallenge?.stage.stageNumber === towerRealmLock.farmStageNumber;
  const towerHeading = farming
    ? `第 ${towerChallenge!.stage.stageNumber} 關（重複挑戰）`
    : towerRealmLock && (!towerChallenge || towerChallenge.status === "cleared")
      ? `第 ${towerRealmLock.stageNumber} 關（未開放）`
      : towerChallenge ? `第 ${towerChallenge.stage.stageNumber} 關` : "載入中";
  // The floor's look: the background's hue and wash follow it (the drifting particles are drawn by the scene).
  const theme = getTowerTheme(towerChallenge?.stage.floor ?? (towerRealmLock ? Math.ceil(towerRealmLock.stageNumber / 10) : 1));
  const themeStyle = isTowerMode
    ? { "--tower-hue": `${theme.hueDeg}deg`, "--tower-saturate": theme.saturate, "--tower-brightness": theme.brightness, "--tower-tint": theme.tint } as CSSProperties
    : undefined;
  return (
    <main
      style={themeStyle}
      data-tower-theme={isTowerMode ? theme.id : undefined}
      className={["game-shell", isTowerMode ? "game-shell--tower" : "", background ? "game-shell--background" : ""].filter(Boolean).join(" ")}
      aria-label="御劍洞府遊戲畫面"
      aria-hidden={background || undefined}
    >
      {navigation}
      <Suspense fallback={<div className="phaser-game phaser-game--loading">正在進入廣場試煉…</div>}>
        {engineWanted ? <PhaserGame onRuntimeReady={onRuntimeReady} /> : <div className="phaser-game phaser-game--loading">正在進入廣場試煉…</div>}
      </Suspense>
      <WeaponCalibrationPanel runtime={runtime} />
      <section className="weapon-panel" aria-label="武器切換">
        <div className="weapon-panel__header">
          <p>{isTowerMode ? "通天塔純輸出挑戰" : `${characterName}目前裝備：`}{isTowerMode ? towerHeading : equippedWeapon.nameZh}</p>
          {isTowerMode && <button type="button" className="return-library-button" onClick={onOpenStageSelect}>選關</button>}
          <p className="combat-readout">攻擊 {Math.round(combatStats.attack).toLocaleString("zh-TW")}　暴擊 {(combatStats.critRate * 100).toFixed(1)}%　攻速 {combatStats.attackSpeed.toFixed(2)}／秒　DPS {combatStats.dps.toFixed(1)}</p>
        </div>
        {isTowerMode && towerRealmLock && (
          <p className="tower-realm-lock" role="status">
            第 {Math.ceil(towerRealmLock.stageNumber / 10)} 層起需達到「{towerRealmLock.requiredRealmNameZh}」境界，請先回洞府突破後再挑戰。
            {towerRealmLock.farmStageNumber !== null && `突破前會重複挑戰第 ${towerRealmLock.farmStageNumber} 關，每 ${towerBalanceConfig.repeatClear.intervalSeconds} 秒一隻妖獸，掉落首次通關獎勵的一部分。`}
            {towerSession.towerRespawnAt !== null && <RespawnCountdown at={towerSession.towerRespawnAt} />}
          </p>
        )}
        {isTowerMode && towerChallenge && (
          <div className={towerChallenge.stage.isBoss ? "tower-battle-status tower-battle-status--boss" : "tower-battle-status"}>
            <strong>{towerChallenge.monster.nameZh}{towerChallenge.stage.isBoss ? "・Boss" : ""}</strong>
            <span>HP：{towerChallenge.monster.currentHp.toLocaleString("zh-TW")} / {towerChallenge.monster.maxHp.toLocaleString("zh-TW")}</span>
            <i><b style={{ width: `${towerChallenge.monster.currentHp / towerChallenge.monster.maxHp * 100}%` }} /></i>
            <TowerCountdownBar challenge={towerChallenge} retryAt={towerSession.towerRetryAt} battleNow={runtime?.getBattleTime ?? Date.now} />
            {runtime && <TowerSpeedControl runtime={runtime} />}
            <span>{towerChallenge.status === "active" ? "自動攻擊中" : towerChallenge.status === "cleared" ? "通關" : "本次失敗不扣除任何資源"}</span>
            {towerChallenge.status === "cleared" && towerRewardNotice?.stageNumber === towerChallenge.stage.stageNumber && (
              <strong className="tower-reward-notice">{towerRewardNotice.repeat ? "重複挑戰掉落" : "首次通關獎勵"}：修為 +{towerRewardNotice.cultivation.toLocaleString("zh-TW")}・靈石 +{towerRewardNotice.spiritStones.toLocaleString("zh-TW")}・妖丹 +{towerRewardNotice.demonCores.toLocaleString("zh-TW")}</strong>
            )}
          </div>
        )}
        <div className="weapon-grid">
          {weaponCatalog.map(weapon => {
            const unlockStatus = getWeaponUnlockStatus(weapon, weaponUnlockContext);
            return (
            <button
              key={weapon.weaponId}
              type="button"
              disabled={!unlockStatus.unlocked}
              title={unlockStatus.unlocked ? undefined : `解鎖條件：${unlockStatus.requirementText}`}
              className={unlockStatus.unlocked ? weapon.weaponId === equippedWeapon.weaponId ? "weapon-button is-equipped" : "weapon-button" : "weapon-button is-locked"}
              onClick={() => { if (unlockStatus.unlocked) selection.selectWeapon(weapon.weaponId, true); }}
            >
              {unlockStatus.unlocked ? weapon.nameZh : `🔒 ${weapon.nameZh}`}
            </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
