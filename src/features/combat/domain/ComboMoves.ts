/**
 * Auto-attack combos. Each sword type loops a fixed sequence of moves; every
 * move is a variation of the sword's own base arc (calibrated to the target),
 * so it is defined relative to that arc instead of in absolute angles:
 *
 * - forward: windup side → swing side, like the base attack;
 * - reverse: the backhand, swing side → windup side.
 *
 * `extendStart` / `extendEnd` widen the arc (degrees) before and after it.
 * `spin` adds a full extra turn of the blade before the arc, while the body
 * turns round (its clip flips through the back); the hit lands on the final pass.
 * The damage window is re-derived from the base window's blade angles, so the
 * blade is damaging exactly where the base attack is, whatever the move.
 *
 * Balance: a combo's damage multipliers average exactly 1 and every move keeps
 * the base animation length, so DPS = final attack × (1 + crit) × speed still holds.
 */
export type ComboMoveId =
  | "cleave"
  | "backhand"
  | "spin"
  | "rising"
  | "leap"
  | "thrust"
  | "thrustLow"
  | "thrustRise"
  | "thrustBurst";

export interface ComboMove {
  readonly id: ComboMoveId;
  readonly nameZh: string;
  readonly direction: "forward" | "reverse";
  readonly extendStart: number;
  readonly extendEnd: number;
  readonly spin: boolean;
  /** Relative phase lengths; renormalised so the whole animation keeps the base length. */
  readonly timeShare: { readonly windup: number; readonly swing: number; readonly recovery: number };
  readonly damageMultiplier: number;
  /** The combo's last, heaviest move: bigger impact, shake and hit stop. */
  readonly finisher: boolean;
}

const move = (id: ComboMoveId, nameZh: string, direction: ComboMove["direction"], extendStart: number, extendEnd: number, timeShare: [number, number, number], damageMultiplier: number, finisher = false, spin = false): ComboMove => ({
  id,
  nameZh,
  direction,
  extendStart,
  extendEnd,
  spin,
  timeShare: { windup: timeShare[0], swing: timeShare[1], recovery: timeShare[2] },
  damageMultiplier,
  finisher,
});

export type ComboSetId = "heavy" | "blade" | "thrust";

export const comboSets: Readonly<Record<ComboSetId, readonly ComboMove[]>> = {
  /** Greatswords: slow and weighty, three moves ending in a leaping slam. */
  heavy: [
    move("cleave", "重斬", "forward", 0, 0, [1, 1, 1], 0.95),
    // The spin needs a longer swing; windup and recovery give the time back.
    // It stops 35° short of the apex so the follow-through stays in front of the face.
    move("spin", "回身斬", "reverse", 0, -35, [0.6, 2.2, 0.7], 0.85, false, true),
    move("leap", "躍空斬", "forward", 45, 20, [1.5, 1.15, 0.7], 1.2, true),
  ],
  /** Swords and sabres: cut, backhand, rising cut, leaping finisher. */
  blade: [
    move("cleave", "斜劈", "forward", 0, 0, [1, 1, 1], 0.9),
    move("backhand", "回斬", "reverse", 10, 10, [0.8, 1, 1.1], 0.9),
    move("rising", "上挑", "reverse", 30, 5, [1.2, 1, 0.9], 0.9),
    move("leap", "躍空斬", "forward", 45, 20, [1.5, 1.15, 0.7], 1.3, true),
  ],
  /** Light swords and rapiers: a flurry of stabs ending in a long burst lunge. */
  thrust: [
    move("thrust", "直刺", "forward", 0, 0, [1, 1, 1], 0.9),
    move("thrustLow", "低刺", "forward", 6, 6, [0.8, 1, 1.1], 0.9),
    move("thrustRise", "上挑刺", "reverse", 24, 6, [1.2, 1, 0.9], 0.9),
    move("thrustBurst", "破空突刺", "forward", 14, 10, [1.5, 1.1, 0.75], 1.3, true),
  ],
};

const COMBO_SET_BY_WEAPON_TYPE: Readonly<Record<string, ComboSetId>> = {
  重型大劍: "heavy",
  寒冰重劍: "heavy",
  輕型長劍: "thrust",
  細劍: "thrust",
};

export function getComboSetId(weaponType: string): ComboSetId {
  return COMBO_SET_BY_WEAPON_TYPE[weaponType] ?? "blade";
}

export function getComboMoves(weaponType: string): readonly ComboMove[] {
  return comboSets[getComboSetId(weaponType)];
}

/** The move for the n-th attack (0-based) of a continuous combo. */
export function getComboMove(weaponType: string, attackIndex: number): ComboMove {
  const moves = getComboMoves(weaponType);
  return moves[((attackIndex % moves.length) + moves.length) % moves.length];
}
