/**
 * Vite creates this list from public/assets/monster at startup/build time.
 * Add a GIF, PNG, or WebP there and restart the dev server (or rebuild) to
 * make it participate in tower monster rotation without changing game code.
 */
export const monsterAssetPaths: readonly string[] = __MONSTER_ASSET_PATHS__;

export function getMonsterTextureKey(stageNumber: number): string | null {
  if (monsterAssetPaths.length === 0) return null;
  return `tower-monster-${(stageNumber - 1) % monsterAssetPaths.length}`;
}
