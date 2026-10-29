/** A delayed beast strike must belong to the same attempt and deployed beast. */
export function isCurrentBeastAttack(
  original: { startedAt: number; stageNumber: number; beastId: string },
  current: { startedAt: number; stageNumber: number; beastId: string | null; active: boolean } | null,
): boolean {
  return current !== null && current.active && current.startedAt === original.startedAt
    && current.stageNumber === original.stageNumber && current.beastId === original.beastId;
}
