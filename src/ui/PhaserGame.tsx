import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { createGameConfig } from "../game/createGameConfig";
import { GameRuntime } from "../game/GameRuntime";

interface PhaserGameProps {
  onRuntimeReady: (runtime: GameRuntime) => void;
}

/** Bridges React's lifecycle to one Phaser.Game instance. */
export function PhaserGame({ onRuntimeReady }: PhaserGameProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const runtime = new GameRuntime();
    const game = new Phaser.Game(createGameConfig(container, runtime));
    onRuntimeReady(runtime);
    return () => game.destroy(true);
  }, []);

  return <div ref={containerRef} className="phaser-game" aria-label="御劍洞府" />;
}
