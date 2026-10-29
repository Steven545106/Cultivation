export {
  calculateFinalCombatStats,
  resolveBasicAttack,
  UNARMED_ATTACK_SPEED,
  UNARMED_BASE_ATTACK,
  weaponToCombatStats,
  type AttackResult,
  type FinalCombatStats,
  type WeaponBaseCombatStats,
} from "./domain/CombatStats";
export {
  createAttackPlan,
  easeAttack,
  getActiveSweepAngles,
  getAttackCycleTiming,
  getAttackPlaybackRate,
  getFinalAttackSpeed,
  getAttackStyle,
  getSweepHitRadius,
  isInActiveWindow,
  samplePhaseAngle,
  MONSTER_HIT_RADIUS,
  type AttackCycleTiming,
  type AttackEase,
  type AttackPhase,
  type AttackPlan,
  type AttackPlanWeapon,
  type AttackStyle,
} from "./domain/AttackPlan";
export { comboSets, getComboMove, getComboMoves, getComboSetId, type ComboMove, type ComboMoveId, type ComboSetId } from "./domain/ComboMoves";
export { resolveHitDamage } from "./domain/HitDamage";
export { sweptBladeHitsCircle, type BladeSegment, type Point } from "./domain/SweepGeometry";
export { resolveSweepHit, type SweepHitQuery } from "./application/ResolveSweepHit";
