import Phaser from "phaser";
import { createWeaponPreviewScene } from "./scenes/WeaponPreviewScene";
import type { GameRuntime } from "./GameRuntime";

export function createGameConfig(parent: HTMLElement, runtime: GameRuntime): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    // Render at 1.5x internal resolution. The scene camera keeps the existing
    // 1280x720 logical coordinate system while avoiding a blurry upscaled canvas.
    width: 1920,
    height: 1080,
    // The animated home GIF lives behind this transparent Phaser canvas.
    transparent: true,
    pixelArt: false,
    roundPixels: false,
    antialias: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1920,
      height: 1080
    },
    // No start-up/refocus slow motion: Phaser otherwise caps each frame at 16.6ms
    // for its first 120 frames, which at low fps runs the battle at a fraction of speed.
    fps: { panicMax: 0 },
    render: {
      powerPreference: "high-performance"
    },
    scene: [createWeaponPreviewScene(runtime)]
  };
}
