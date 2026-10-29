import { useEffect, useState } from "react";
import { TOWER_BATTLE_SPEEDS } from "../../features/tower";
import type { GameRuntime } from "../../game/GameRuntime";

/** Tower battle speed picker; the battle clock, attacks and countdown all follow it. */
export function TowerSpeedControl({ runtime }: { readonly runtime: GameRuntime }): JSX.Element {
  const [speed, setSpeed] = useState(runtime.getTowerBattleSpeed);
  useEffect(() => runtime.subscribeToTowerBattleSpeed(setSpeed), [runtime]);
  return (
    <div className="tower-speed" role="group" aria-label="戰鬥速度">
      <span>戰鬥速度</span>
      {TOWER_BATTLE_SPEEDS.map(option => (
        <button
          key={option}
          type="button"
          className={option === speed ? "tower-speed__option is-active" : "tower-speed__option"}
          aria-pressed={option === speed}
          onClick={() => runtime.setTowerBattleSpeed(option)}
        >
          {option}×
        </button>
      ))}
    </div>
  );
}
