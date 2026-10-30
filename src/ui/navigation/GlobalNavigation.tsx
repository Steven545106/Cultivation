import { useState } from "react";
import { beastCatalog } from "../../features/beast";
import { weaponCatalog } from "../../features/weapon";
import { RulesModal } from "../rules/RulesModal";

export type NavigationTarget = "cultivating" | "weapons" | "beasts" | "companions" | "alchemy" | "adventure" | "tower";

interface GlobalNavigationProps {
  readonly activePage: NavigationTarget;
  readonly onNavigate: (target: NavigationTarget) => void;
  readonly onShutdown: () => void;
}

export function GlobalNavigation({ activePage, onNavigate, onShutdown }: GlobalNavigationProps): JSX.Element {
  const [rulesOpen, setRulesOpen] = useState(false);
  // On phones the navigation stays on top of the rules, so moving to a page also closes them.
  const go = (target: NavigationTarget): void => { setRulesOpen(false); onNavigate(target); };
  return (
    <>
    <nav className="global-navigation" aria-label="主要功能導覽">
      <button type="button" className={activePage === "cultivating" ? "global-navigation__item is-active" : "global-navigation__item"} onClick={() => go("cultivating")}>
        <span className="global-navigation__medallion global-navigation__medallion--cultivating"><img src="/assets/player/bai-cultivating-icon.webp" alt="" /></span>
        <span>修練</span>
      </button>
      <button type="button" className={activePage === "weapons" ? "global-navigation__item is-active" : "global-navigation__item"} onClick={() => go("weapons")}>
        <span className="global-navigation__medallion global-navigation__medallion--weapon"><img src={weaponCatalog[0].assetPath} alt="" /></span>
        <span>仙劍</span>
      </button>
      <button type="button" className={activePage === "beasts" ? "global-navigation__item is-active" : "global-navigation__item"} onClick={() => go("beasts")}>
        <span className="global-navigation__medallion global-navigation__medallion--beast"><img src={beastCatalog[0].assetPath} alt="" /></span>
        <span>靈獸</span>
      </button>
      <button type="button" className={activePage === "companions" ? "global-navigation__item is-active" : "global-navigation__item"} onClick={() => go("companions")}>
        <span className="global-navigation__medallion global-navigation__medallion--companion">緣</span>
        <span>道侶</span>
      </button>
      <button type="button" className={activePage === "alchemy" ? "global-navigation__item is-active" : "global-navigation__item"} onClick={() => go("alchemy")}>
        <span className="global-navigation__medallion global-navigation__medallion--rules">丹</span><span>煉丹</span>
      </button>
      <button type="button" className={activePage === "adventure" ? "global-navigation__item is-active" : "global-navigation__item"} onClick={() => go("adventure")}>
        <span className="global-navigation__medallion global-navigation__medallion--adventure">遊</span>
        <span>遊歷</span>
      </button>
      <button type="button" className={activePage === "tower" ? "global-navigation__item is-active" : "global-navigation__item"} onClick={() => go("tower")}>
        <span className="global-navigation__medallion global-navigation__medallion--tower">塔</span>
        <span>通天塔</span>
      </button>
      <button type="button" className="global-navigation__item" onClick={() => setRulesOpen(true)}>
        <span className="global-navigation__medallion global-navigation__medallion--rules">規</span>
        <span>規則</span>
      </button>
      {import.meta.env.DEV && <button type="button" className="global-navigation__item" onClick={onShutdown}>
        <span className="global-navigation__medallion global-navigation__medallion--rules">存</span>
        <span>存檔關閉</span>
      </button>}
    </nav>
    {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </>
  );
}
