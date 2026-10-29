import type Phaser from "phaser";
import type { BladeSegment } from "../../features/combat";

export interface WeaponDebugFlags {
  readonly showSockets: boolean;
  readonly showHitbox: boolean;
}

/** Calibration overlay for the hand socket, blade start/tip and blade hitbox. */
export class WeaponDebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;

  public constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(30);
  }

  public draw(hand: Phaser.Math.Vector2, segment: BladeSegment, bladeThickness: number, flags: WeaponDebugFlags): void {
    this.graphics.clear();
    if (flags.showSockets) {
      this.graphics.lineStyle(2, 0xffe67b, 1).strokeCircle(hand.x, hand.y, 10);
      this.graphics.lineStyle(2, 0x73f6ff, 1).strokeCircle(segment.base.x, segment.base.y, 8);
      this.graphics.lineStyle(2, 0xffb7f4, 1).strokeCircle(segment.tip.x, segment.tip.y, 8);
    }
    if (flags.showHitbox) {
      this.graphics.lineStyle(bladeThickness, 0x70f3ff, 0.26)
        .lineBetween(segment.base.x, segment.base.y, segment.tip.x, segment.tip.y);
    }
  }
}
