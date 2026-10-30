/**
 * Sprite-sheet animations for the dao companions. Each sheet packs the frames
 * of one loop into a grid (row by row, left to right); `steps` is the order the
 * frames play in and how long each is held, and `blendMs` cross-fades into the
 * next step so a few key frames still move smoothly.
 */
export interface SpriteStep {
  /** Cell index in the sheet. */
  readonly cell: number;
  readonly holdMs: number;
}

export interface CompanionSprite {
  readonly sheet: string;
  /** Still of the first frame, for anywhere a single picture is needed. */
  readonly poster: string;
  readonly cols: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly steps: readonly SpriteStep[];
  /** Cross-fade into the next step after its hold; 0 cuts straight to it. */
  readonly blendMs: number;
}

export interface SpriteFrame {
  readonly from: number;
  readonly to: number;
  /** 0..1: how far the cross-fade from `from` to `to` has got. */
  readonly mix: number;
}

/** The cells to draw at a time into the loop (which repeats forever). */
export function spriteFrameAt(sprite: CompanionSprite, timeMs: number): SpriteFrame {
  const { steps, blendMs } = sprite;
  const total = steps.reduce((sum, step) => sum + step.holdMs + blendMs, 0);
  let t = ((timeMs % total) + total) % total;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (t < step.holdMs) return { from: step.cell, to: step.cell, mix: 0 };
    t -= step.holdMs;
    if (t < blendMs) return { from: step.cell, to: steps[(index + 1) % steps.length].cell, mix: t / blendMs };
    t -= blendMs;
  }
  return { from: steps[0].cell, to: steps[0].cell, mix: 0 };
}

/** How long one pass of the loop takes. */
export const spriteLoopMs = (sprite: CompanionSprite): number => sprite.steps.reduce((sum, step) => sum + step.holdMs + sprite.blendMs, 0);

const range = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

/** Frames 0…n−1 then back down to 1, so a one-way action loops without a jump. */
const pingPong = (count: number, holdMs: number): SpriteStep[] =>
  [...range(count), ...range(count - 2).map(index => count - 2 - index)].map(cell => ({ cell, holdMs }));

const timed = (holds: readonly number[]): SpriteStep[] => holds.map((holdMs, cell) => ({ cell, holdMs }));

export const companionSprites: Readonly<Record<string, CompanionSprite>> = {
  // Plum blossom snow dance: sweeps, a full spin (frames 11-13) and an offering pose (16-17), both held longer.
  "lin-tingxue": {
    sheet: "/assets/companions/lin_tingxue-sheet.webp",
    poster: "/assets/companions/lin_tingxue-poster.webp",
    cols: 6,
    cellWidth: 476,
    cellHeight: 520,
    steps: range(24).map(cell => ({ cell, holdMs: (cell >= 10 && cell <= 12) || cell === 15 || cell === 16 ? 150 : 110 })),
    blendMs: 40,
  },
  // Potion tasting (frames 1-12, the bitter face held longer) then a healing ripple of green light (13-24).
  "su-wanqing": {
    sheet: "/assets/companions/su_wanqing-sheet.webp",
    poster: "/assets/companions/su_wanqing-poster.webp",
    cols: 6,
    cellWidth: 451,
    cellHeight: 600,
    steps: range(24).map(cell => ({ cell, holdMs: cell === 8 || cell === 9 ? 160 : cell >= 16 && cell <= 19 ? 140 : 110 })),
    blendMs: 40,
  },
  // Moon dance: a light dance step, a leap, an aerial twirl, then a landing spin (frames 17-21, held a little longer).
  "murong-wanyue": {
    sheet: "/assets/companions/murong_wanyue-sheet.webp",
    poster: "/assets/companions/murong_wanyue-poster.webp",
    cols: 6,
    cellWidth: 521,
    cellHeight: 640,
    steps: range(24).map(cell => ({ cell, holdMs: cell >= 16 && cell <= 20 ? 140 : 95 })),
    blendMs: 35,
  },
  // Tossing the astrolabe and casting: 12 key frames, played forward and back with a short cross-fade.
  "gu-xinglan": {
    sheet: "/assets/companions/gu_xinglan-sheet.webp",
    poster: "/assets/companions/gu_xinglan-poster.webp",
    cols: 4,
    cellWidth: 660,
    cellHeight: 768,
    steps: pingPong(12, 110),
    blendMs: 60,
  },
  // Fan dance: summon a cloud, ride it up, spin (frames 15-17, held longer), hop off and land.
  "nangong-yunshu": {
    sheet: "/assets/companions/nangong_yunshu-sheet.webp",
    poster: "/assets/companions/nangong_yunshu-poster.webp",
    cols: 6,
    cellWidth: 455,
    cellHeight: 600,
    steps: range(24).map(cell => ({ cell, holdMs: cell >= 14 && cell <= 16 ? 170 : 110 })),
    blendMs: 40,
  },
};

/** The hero's solo meditation on the home page: the original 32-frame loop, 80 ms a frame. */
export const heroCultivationSprite: CompanionSprite = {
  sheet: "/assets/player/hero_cultivating-sheet.webp",
  poster: "/assets/player/hero_cultivating-poster.webp",
  cols: 8,
  cellWidth: 448,
  cellHeight: 448,
  steps: range(32).map(cell => ({ cell, holdMs: 80 })),
  blendMs: 0,
};

/** The hero's solo loop and the companion's own solo loop (drawn in the same style) side by side; 32 frames at 80 ms, exactly the solo's timing (her 18 drawn frames are spread over them). */
const dualCultivationSprites: Readonly<Record<string, CompanionSprite>> = {
  "lin-tingxue": {
    sheet: "/assets/companions/dual_lin_tingxue-sheet.webp",
    poster: "/assets/companions/dual_lin_tingxue-poster.webp",
    cols: 6,
    cellWidth: 635,
    cellHeight: 438,
    steps: range(32).map(cell => ({ cell, holdMs: 80 })),
    blendMs: 0,
  },
};

/** The two-person meditation for a companion (catalog or domain id), or null when she has none drawn yet. */
export function getDualCultivationSprite(companionId: string | null | undefined): CompanionSprite | null {
  if (!companionId) return null;
  return dualCultivationSprites[DOMAIN_ID_TO_SPRITE_ID[companionId] ?? companionId] ?? null;
}

/** The domain catalog uses shorter ids than the companion page's catalog; both find the same sprite. */
const DOMAIN_ID_TO_SPRITE_ID: Readonly<Record<string, string>> = { tingxue: "lin-tingxue", wanqing: "su-wanqing", xinglan: "gu-xinglan", wanyue: "murong-wanyue", yunshu: "nangong-yunshu" };

export function getCompanionSprite(id: string): CompanionSprite | null {
  return companionSprites[DOMAIN_ID_TO_SPRITE_ID[id] ?? id] ?? null;
}
