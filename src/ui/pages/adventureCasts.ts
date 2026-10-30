import type { AdventureSkillId } from "../../features/adventure";
import type { CompanionSprite } from "../../features/companion/domain/companionSprites";

/** Where a hero picture sits in his frame box, as percentages of the box: its width, its centre from the left, its bottom edge. */
export interface HeroPlacement {
  readonly width: number;
  readonly left: number;
  readonly bottom: number;
}

/**
 * How a skill plays on screen: the hero's cast animation (its first frame is
 * also his stance after he has cast it, so the next cast starts and ends in
 * place), the frames on which each hit lands, and when the effect on the
 * enemy starts. Placements are tuned so every sheet shows the hero at the
 * same height, feet and face position.
 */
export interface SkillCast {
  readonly sprite: CompanionSprite;
  readonly placement: HeroPlacement;
  /** 1-based frame on which each hit lands, in order; extra hits reuse the last gap. */
  readonly hitFrames: readonly number[];
  /** 1-based frame on which the effect on the enemy starts. */
  readonly effectFrame: number;
  readonly effect: "petals" | "lightning" | "crescent" | "moonlight";
  /** The cast is mostly pale see-through light (a moon, waves): it glows instead of casting the usual dark shadow, which would grey it. */
  readonly glowing?: boolean;
}

const sheetSteps = (frames: number, frameMs: number, slow: readonly number[] = []) =>
  Array.from({ length: frames }, (_, cell) => ({ cell, holdMs: cell === frames - 1 ? 4000 : slow.includes(cell) ? frameMs * 2 : frameMs }));

export const skillCasts: Readonly<Record<AdventureSkillId, SkillCast>> = {
  // 落英繽紛 with the 寒櫻霜華劍: 28 frames at 130 ms; the two settling frames before the last hold twice as long.
  luoying: {
    sprite: { sheet: "/assets/player/falling-blossoms-sheet.webp", poster: "/assets/player/falling-blossoms-poster.webp", cols: 6, cellWidth: 280, cellHeight: 260, steps: sheetSteps(28, 130, [25, 26]), blendMs: 0 },
    placement: { width: 112, left: 50, bottom: 1 },
    hitFrames: [13, 15, 16, 18, 20],
    effectFrame: 11,
    effect: "petals",
  },
  // 雷獄崩天 with the 九霄雷獄劍 (redrawn with a greatsword-sized blade): 44 frames at 90 ms. He leaps on frame 21, strikes on 25 and lands the bolt on 29.
  leiyu: {
    sprite: { sheet: "/assets/player/thunder-prison-sheet.webp", poster: "/assets/player/thunder-prison-poster.webp", cols: 8, cellWidth: 438, cellHeight: 429, steps: sheetSteps(44, 90), blendMs: 0 },
    placement: { width: 147.2, left: 30.6, bottom: -14.3 },
    hitFrames: [22, 24, 26, 27, 29],
    effectFrame: 21,
    effect: "lightning",
  },
  // 新月破空 with the 星穹弦月刃: 48 frames at 90 ms. He spins on frames 13–24, looses the crescent on 28, and the star rift bursts on 32 and 34.
  xinyue: {
    sprite: { sheet: "/assets/player/crescent-void-sheet.webp", poster: "/assets/player/crescent-void-poster.webp", cols: 8, cellWidth: 619, cellHeight: 474, steps: sheetSteps(48, 90), blendMs: 0 },
    placement: { width: 195, left: 35.5, bottom: -20 },
    hitFrames: [29, 32, 34],
    effectFrame: 27,
    effect: "crescent",
  },
  // 月華流照 with the 皓月流光劍: 48 frames at 90 ms. The moon rises behind him on frames 5–12; the five waves of moonlight roll out on 18, 22, 27, 31 and 35.
  yuehua: {
    sprite: { sheet: "/assets/player/moonlight-tide-sheet.webp", poster: "/assets/player/moonlight-tide-poster.webp", cols: 8, cellWidth: 503, cellHeight: 360, steps: sheetSteps(48, 90), blendMs: 0 },
    placement: { width: 169.5, left: 44.8, bottom: -1.4 },
    hitFrames: [18, 22, 27, 31, 35],
    effectFrame: 16,
    effect: "moonlight",
    glowing: true,
  },
};

/** Milliseconds from the start of the cast until the given 1-based frame is on screen. */
export function castTimeAt(cast: SkillCast, frame: number): number {
  return cast.sprite.steps.slice(0, Math.max(0, frame - 1)).reduce((sum, step) => sum + step.holdMs, 0);
}

/** Until the last frame (the ready stance) is on screen. */
export function castLength(cast: SkillCast): number {
  return castTimeAt(cast, cast.sprite.steps.length) + (cast.sprite.steps[0]?.holdMs ?? 0);
}
