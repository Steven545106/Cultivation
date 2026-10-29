/**
 * Domain-level pose intent. It deliberately describes state only; rendering a
 * flattened PNG remains a temporary Phaser concern until layered art exists.
 */
export type CharacterPose =
  | "idle"
  | "run"
  | "attackWindup"
  | "attackSwing"
  | "attackImpact"
  | "attackRecovery"
  | "cast"
  | "hit"
  | "death";

export type Facing = "left" | "right";

export interface CharacterPoseState {
  readonly pose: CharacterPose;
  readonly facing: Facing;
}

export const DEFAULT_CHARACTER_POSE: CharacterPoseState = {
  pose: "idle",
  facing: "right",
};
