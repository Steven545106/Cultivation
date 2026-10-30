import { CultivationStatusPanel } from "../CultivationStatusPanel";
import { SaveAccountPanel } from "../SaveAccountPanel";
import { CultivatingCharacter } from "../CultivatingCharacter";
import { useSyncExternalStore } from "react";
import { gameSaveStore } from "../../features/persistence";
import { companionCatalog } from "../../features/companion/companionCatalog";

export function CultivatingPage({ navigation }: { readonly navigation: JSX.Element }): JSX.Element {
  const { characterName, activeCompanionId } = useSyncExternalStore(gameSaveStore.subscribe, gameSaveStore.getSnapshot, gameSaveStore.getSnapshot).save;
  const companion = companionCatalog.find(item => item.id === activeCompanionId);
  return (
    <main className="cultivating-home" aria-label={`${characterName}修練中`}>
      {navigation}
      <section className="cultivating-home__content">
        <p className="eyebrow">雲霧仙山・{characterName}洞府</p>
        <h1>{characterName}・洞府</h1>
        <p>靈氣運轉周天，修行之路由此開始。</p>
        <div className="cultivating-home__body">
          <div className="cultivating-home__character-frame">
            <CultivatingCharacter characterName={characterName} companionId={activeCompanionId} companionName={companion?.name} />
          </div>
          <CultivationStatusPanel />
        </div>
        <SaveAccountPanel />
      </section>
    </main>
  );
}
