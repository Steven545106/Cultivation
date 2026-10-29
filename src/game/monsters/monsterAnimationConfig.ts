/** Sprite sheets derived from the archived GIF frames; unlisted future assets remain still images. */
export const monsterAnimations: Readonly<Record<string, { frames: number; frameRate: number }>> = {
  monster_1: { frames: 20, frameRate: 12.5 },
  monster_2_flame_fox: { frames: 8, frameRate: 1000 / 110 },
  monster_3_jade_qilin: { frames: 8, frameRate: 1000 / 110 },
  monster_4_frost_crane: { frames: 8, frameRate: 1000 / 110 },
  monster_5_thunder_tortoise: { frames: 8, frameRate: 1000 / 110 },
};

export const monsterSheetKey = (name: string): string => `monster-sheet-${name}`;
export const monsterAnimationKey = (name: string): string => `monster-idle-${name}`;
