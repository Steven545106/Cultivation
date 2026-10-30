import { CultivationStatusPanel } from "../CultivationStatusPanel";
import { SaveAccountPanel } from "../SaveAccountPanel";
import { CultivatingCharacter } from "../CultivatingCharacter";
import { useState, useSyncExternalStore } from "react";
import { getDualCultivationSprite } from "../../features/companion/domain/companionSprites";
import { gameSaveStore } from "../../features/persistence";
import { companionCatalog } from "../../features/companion/companionCatalog";

const VIEW_KEY = "cultivation-home-view";
type HomeView = "solo" | "dual";

/** The last picture the player chose; a per-device convenience, so a blocked or empty storage just means the default. */
function readView(): HomeView {
  try { return window.localStorage.getItem(VIEW_KEY) === "solo" ? "solo" : "dual"; } catch { return "dual"; }
}

export function CultivatingPage({ navigation }: { readonly navigation: JSX.Element }): JSX.Element {
  const { characterName, activeCompanionId } = useSyncExternalStore(gameSaveStore.subscribe, gameSaveStore.getSnapshot, gameSaveStore.getSnapshot).save;
  const companion = companionCatalog.find(item => item.id === activeCompanionId);
  const [view, setView] = useState<HomeView>(readView);
  // The choice only exists while the active companion has a shared scene drawn.
  const canShareScene = getDualCultivationSprite(activeCompanionId) !== null;
  const showDual = canShareScene && view === "dual";
  const chooseView = (next: HomeView): void => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* the choice just is not remembered */ }
  };
  return (
    <main className="cultivating-home" aria-label={`${characterName}修練中`}>
      {navigation}
      <section className="cultivating-home__content">
        <p className="eyebrow">雲霧仙山・{characterName}洞府</p>
        <h1>{characterName}・洞府</h1>
        <p>靈氣運轉周天，修行之路由此開始。</p>
        <div className="cultivating-home__body">
          <div className="cultivating-home__character-frame">
            <CultivatingCharacter characterName={characterName} companionId={showDual ? activeCompanionId : null} companionName={companion?.name} />
            {canShareScene && (
              <div className="cultivating-view-toggle" role="group" aria-label="修練畫面">
                <button type="button" aria-pressed={!showDual} onClick={() => chooseView("solo")}>獨自修練</button>
                <button type="button" aria-pressed={showDual} onClick={() => chooseView("dual")}>與{companion?.name ?? "道侶"}雙修</button>
              </div>
            )}
          </div>
          <CultivationStatusPanel />
        </div>
        <SaveAccountPanel />
      </section>
    </main>
  );
}
