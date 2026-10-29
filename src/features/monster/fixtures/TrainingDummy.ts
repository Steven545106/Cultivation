import { createMonsterState, type MonsterState } from "../domain/MonsterState";

/**
 * Test fixture for the weapon preview scene, not a formal monster. It stands in
 * whenever no tower challenge is driving the displayed target.
 */
export const TRAINING_DUMMY_MAX_HP = 2_000;
export const TRAINING_DUMMY_RESPAWN_MS = 900;

export function createTrainingDummy(): MonsterState {
  return createMonsterState({ id: "training-dummy", nameZh: "測試妖獸", isBoss: false, maxHp: TRAINING_DUMMY_MAX_HP });
}

export function formatTrainingDummyLabel(dummy: MonsterState): string {
  return dummy.status === "dead"
    ? `${dummy.nameZh}　已擊敗`
    : `${dummy.nameZh}　${dummy.currentHp} / ${dummy.maxHp}`;
}
