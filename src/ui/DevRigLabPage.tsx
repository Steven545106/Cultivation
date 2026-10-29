import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { RigLabScene } from "../game/scenes/RigLabScene";

/** Developer page (/dev/rig-lab): the hero rig frozen on demand for screenshot comparisons. No save or battle. */
export function DevRigLabPage(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: 1920,
      height: 1080,
      antialias: true,
      // The rig lab reads its own pixels back (window.__rigLab.faceCoverage).
      render: { preserveDrawingBuffer: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1920, height: 1080 },
      scene: [RigLabScene],
    });
    return () => game.destroy(true);
  }, []);
  return <div ref={containerRef} className="rig-lab" aria-label="角色骨架實驗室" />;
}
