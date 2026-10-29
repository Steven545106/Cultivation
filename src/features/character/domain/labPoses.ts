import { PART } from "./attackClips";
import type { Pose } from "./CutoutRig";

/**
 * Test poses that are not attack clips, shared by rig tests and /dev/rig-lab.
 * Never used in battle.
 */

/** A deep, centred squat: hips drop ~36 world px with no lean, so neither foot is the "planted" one. */
export const SQUAT_POSE: Pose = {
  [PART.body]: { x: 0, y: 140, scaleY: 0.95 },
  [PART.torso]: { rotation: 6 },
  [PART.head]: { rotation: -4 },
  [PART.robeFront]: { rotation: 10 },
  [PART.robeBack]: { rotation: 10 },
};

/** A small knee bend: hips down ~10 world px. */
export const BEND_POSE: Pose = {
  [PART.body]: { x: 0, y: 40, scaleY: 0.99 },
  [PART.torso]: { rotation: 2 },
};

/** The deepest crouch the attack clips use (上挑 / 躍空斬 wind-ups drop the hips 115–120). */
export const CROUCH_POSE: Pose = {
  [PART.body]: { x: 0, y: 118, scaleY: 0.95 },
  [PART.torso]: { rotation: 5 },
  [PART.head]: { rotation: -3 },
  [PART.robeFront]: { rotation: 8 },
  [PART.robeBack]: { rotation: 8 },
};

export const labPoses = { squat: SQUAT_POSE, bend: BEND_POSE, crouch: CROUCH_POSE } as const;
export type LabPoseId = keyof typeof labPoses;
