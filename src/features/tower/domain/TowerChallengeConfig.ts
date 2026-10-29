/** All time-limit decisions are centralised here, never in React or Phaser. */
export const towerChallengeConfig = {
  normalTimeLimitSeconds: 30,
  bossTimeLimitSeconds: 60,
  /**
   * Tower fights play faster than real time, at the speed the player picks:
   * attacks, animations and the countdown all run on the sped-up battle clock,
   * so the balance (HP = required DPS × time limit) is unchanged — at 2× a 30s
   * limit just takes 15 real seconds.
   */
  battleSpeeds: [2, 3, 5],
  defaultBattleSpeed: 2,
} as const;

export function getTowerTimeLimitSeconds(isBoss: boolean): number {
  return isBoss ? towerChallengeConfig.bossTimeLimitSeconds : towerChallengeConfig.normalTimeLimitSeconds;
}

export type TowerBattleSpeed = (typeof towerChallengeConfig.battleSpeeds)[number];

export const TOWER_BATTLE_SPEEDS: readonly TowerBattleSpeed[] = towerChallengeConfig.battleSpeeds;
export const DEFAULT_TOWER_BATTLE_SPEED: TowerBattleSpeed = towerChallengeConfig.defaultBattleSpeed;

export function isTowerBattleSpeed(value: unknown): value is TowerBattleSpeed {
  return TOWER_BATTLE_SPEEDS.includes(value as TowerBattleSpeed);
}
