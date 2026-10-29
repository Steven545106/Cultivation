import { useEffect, useRef, useState } from "react";
import { gameSaveCommands } from "../features/persistence";
import { getBeastDamageShare, getBeastStageIndex, resolveDeployedBeast } from "../features/beast";
import type { GameRuntime } from "../game/GameRuntime";
import { useGameSave } from "./hooks/useGameSave";
import { useTowerChallengeSession } from "./hooks/useTowerChallengeSession";
import { useWeaponSelection } from "./hooks/useWeaponSelection";
import { GlobalNavigation, type NavigationTarget } from "./navigation/GlobalNavigation";
import { BattlePage } from "./pages/BattlePage";
import { BeastPage } from "./pages/BeastPage";
import { CultivatingPage } from "./pages/CultivatingPage";
import { TowerPage } from "./pages/TowerPage";
import { WeaponLibraryPage } from "./pages/WeaponLibraryPage";
import { CompanionPage } from "./pages/CompanionPage";
import { SaveAccountPanel } from "./SaveAccountPanel";
import { AlchemyPage } from "./pages/AlchemyPage";

type GamePage = "cultivating" | "weapons" | "beasts" | "companions" | "alchemy" | "tower" | "battle";

/**
 * React owns the application shell: page routing only. Weapon selection and
 * the tower battle session live in hooks; Phaser is isolated in PhaserGame so
 * React renders never recreate the game canvas or scenes.
 *
 * The tower battle is always mounted and keeps fighting from the moment the
 * game opens: on any other page it simply runs hidden behind that page.
 */
export function GameShell(): JSX.Element {
  const snapshot = useGameSave();
  if (!snapshot.cloudReady) return <main className="shutdown-screen"><h1>雲端存檔</h1><p>{snapshot.loading ? "正在確認登入並讀取雲端存檔…" : "請登入 Google 並成功讀取雲端存檔後開始遊戲。"}</p><SaveAccountPanel />{snapshot.error && <button type="button" onClick={() => window.location.reload()}>重新嘗試</button>}</main>;
  return <ActiveGameShell />;
}

function ActiveGameShell(): JSX.Element {
  const gameSave = useGameSave();
  const [runtime, setRuntime] = useState<GameRuntime | null>(null);
  const [page, setPage] = useState<GamePage>("cultivating");
  const [shutdown, setShutdown] = useState<"idle" | "saving" | "stopped">("idle");
  const [shutdownError, setShutdownError] = useState<string | null>(null);
  const shutdownStarted = useRef(false);
  const selection = useWeaponSelection(gameSave, runtime);
  const towerSession = useTowerChallengeSession(shutdown === "idle" ? runtime : null, true, gameSave.save.tower, gameSave.save.cultivation.realmId);

  useEffect(() => {
    if (shutdown !== "saving" || shutdownStarted.current) return;
    shutdownStarted.current = true;
    void (async () => {
      try {
        await gameSaveCommands.saveBeforeShutdown();
        const response = await fetch("/__game_shutdown", { method: "POST", headers: { "X-Game-Shutdown-Token": __GAME_SHUTDOWN_TOKEN__ } });
        if (!response.ok) throw new Error("無法關閉本機伺服器，請確認使用 start-game.bat 啟動。");
        setShutdown("stopped");
      } catch (error) {
        gameSaveCommands.resumeAfterShutdownFailure();
        setShutdownError(error instanceof Error ? error.message : "存檔或關閉伺服器失敗。");
        shutdownStarted.current = false;
        setShutdown("idle");
      }
    })();
  }, [shutdown]);

  // The deployed beast (出戰) follows the save, and only ever an unlocked one.
  const deployedBeast = resolveDeployedBeast(gameSave.save.beasts.deployedBeastId, gameSave.save.tower.highestClearedStage);
  const deployedBeastStage = getBeastStageIndex(gameSave.save.beasts, deployedBeast.beastId);
  useEffect(() => {
    runtime?.setDeployedBeast(deployedBeast, deployedBeastStage);
  }, [runtime, deployedBeast, deployedBeastStage]);

  const navigateTo = (target: NavigationTarget): void => {
    setPage(target === "tower" ? "battle" : target);
  };

  /** The stage-select page's challenge button: restart on the chosen stage and watch it. */
  const challengeSelectedStage = (): void => {
    towerSession.startSelectedStage();
    setPage("battle");
  };

  const activeNavigationPage: NavigationTarget = page === "battle" ? "tower" : page;
  const navigation = <GlobalNavigation activePage={activeNavigationPage} onNavigate={navigateTo} onShutdown={() => { setShutdownError(null); setRuntime(null); setShutdown("saving"); }} />;
  const inBattle = page === "battle";

  const foreground = (() => {
    switch (page) {
      case "cultivating":
        return <CultivatingPage navigation={navigation} />;
      case "weapons":
        return <WeaponLibraryPage navigation={navigation} selection={selection} spiritStones={gameSave.save.spiritStones} characterName={gameSave.save.characterName} />;
      case "beasts":
        return <BeastPage navigation={navigation} save={gameSave.save} heroDps={selection.combatStats.dps} />;
      case "companions":
        return <CompanionPage navigation={navigation} save={gameSave.save} />;
      case "alchemy":
        return <AlchemyPage navigation={navigation} save={gameSave.save} />;
      case "tower":
        return <TowerPage navigation={navigation} tower={gameSave.save.tower} dps={selection.combatStats.dps * (1 + getBeastDamageShare(deployedBeast, deployedBeastStage))} realmId={gameSave.save.cultivation.realmId} onChallenge={challengeSelectedStage} />;
      case "battle":
        return null;
    }
  })();

  if (shutdown !== "idle") return <main className="shutdown-screen" role="status"><h1>{shutdown === "saving" ? "正在保存遊戲進度…" : "遊戲已存檔，伺服器已關閉"}</h1><p>{shutdown === "saving" ? "請稍候，不要關閉此分頁。" : "可以關閉此分頁；下次遊玩請重新啟動遊戲。"}</p></main>;

  return (
    <>
      {shutdownError && <div className="shutdown-error" role="alert">{shutdownError}<button type="button" onClick={() => setShutdownError(null)}>關閉</button></div>}
      <BattlePage
        navigation={inBattle ? navigation : null}
        characterName={gameSave.save.characterName}
        background={!inBattle}
        runtime={runtime}
        onRuntimeReady={setRuntime}
        isTowerMode
        selection={selection}
        towerSession={towerSession}
        onOpenStageSelect={() => setPage("tower")}
      />
      {foreground}
    </>
  );
}
