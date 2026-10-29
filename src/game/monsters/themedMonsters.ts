/**
 * Monsters drawn for one tower theme (see features/tower TowerTheme). A themed
 * floor shows its own creature; themes without one yet keep the shared
 * rotation. Each sheet is 8 frames of 512 px in a 4x2 grid.
 */
export interface ThemedMonster {
  readonly sheetPath: string;
  readonly frames: number;
  readonly frameRate: number;
}

/** The room-10 guardian of a theme is registered under `<themeId>-boss`; floors without one use the normal creature. */
export const bossKey = (themeId: string): string => `${themeId}-boss`;

export const themedMonsters: Readonly<Record<string, ThemedMonster>> = {
  // 雲霧山門: a crane of cloud and mist.
  mist: { sheetPath: "/assets/monster-theme/mist-sheet.webp", frames: 8, frameRate: 1000 / 130 },
  // 雲霧山門 Boss: the crane's evolved form, with a halo of cloud and four cloud banners.
  "mist-boss": { sheetPath: "/assets/monster-theme/mist-boss-sheet.webp", frames: 8, frameRate: 1000 / 140 },
  // 青翠靈林: a spirit stag with living-branch antlers.
  forest: { sheetPath: "/assets/monster-theme/forest-sheet.webp", frames: 8, frameRate: 1000 / 130 },
  // 赤焰洞府: a lava salamander wreathed in flame.
  flame: { sheetPath: "/assets/monster-theme/flame-sheet.webp", frames: 8, frameRate: 1000 / 120 },
  // 寒霜冰原: a silver-white frost wolf with ice crystals along its spine.
  frost: { sheetPath: "/assets/monster-theme/frost-sheet.webp", frames: 8, frameRate: 1000 / 120 },
  // 雷鳴天海: a violet storm lynx in gold armour, crackling with lightning.
  thunder: { sheetPath: "/assets/monster-theme/thunder-sheet.webp", frames: 8, frameRate: 1000 / 120 },
  // 星河虛空: a cosmic fox whose tails hold a night sky.
  star: { sheetPath: "/assets/monster-theme/star-sheet.webp", frames: 8, frameRate: 1000 / 120 },
  // 桃花仙境: a nine-tailed peach-blossom fox.
  blossom: { sheetPath: "/assets/monster-theme/blossom-sheet.webp", frames: 8, frameRate: 1000 / 120 },
  // 金輝天宮: a golden celestial lion-dragon with a halo.
  gold: { sheetPath: "/assets/monster-theme/gold-sheet.webp", frames: 8, frameRate: 1000 / 120 },
  // 血月魔域: a crimson winged beast with a blood-moon sigil.
  blood: { sheetPath: "/assets/monster-theme/blood-sheet.webp", frames: 8, frameRate: 1000 / 120 },
  // 混沌虛無: a void chimera of purple shadow and drifting crystals.
  chaos: { sheetPath: "/assets/monster-theme/chaos-sheet.webp", frames: 8, frameRate: 1000 / 120 },
};

export const themedMonsterSheetKey = (themeId: string): string => `theme-monster-sheet-${themeId}`;
export const themedMonsterAnimationKey = (themeId: string): string => `theme-monster-idle-${themeId}`;
