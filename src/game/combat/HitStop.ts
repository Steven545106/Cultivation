import type Phaser from "phaser";

const HIT_STOP_TIME_SCALE = 0.08;

/** Native time keeps the intended real-world pause duration independent of Phaser's timeScale. */
export class HitStop {
  private timer?: number;
  private baseScale = 1;

  public constructor(private readonly scene: Phaser.Scene) {}

  /** The scene's normal time scale (the battle speed); hit stops pause from and return to it. */
  public setBaseScale(scale: number): void {
    this.baseScale = scale;
    if (this.timer === undefined) this.scene.time.timeScale = scale;
  }

  /** The pause is in battle time, so a faster battle also shortens it. */
  public apply(durationMs: number): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.scene.time.timeScale = HIT_STOP_TIME_SCALE;
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      if (this.scene.sys.isActive()) this.scene.time.timeScale = this.baseScale;
    }, durationMs / this.baseScale);
  }

  public dispose(): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.scene.time.timeScale = 1;
  }
}
