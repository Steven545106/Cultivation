import { describe, expect, it } from "vitest";
import { isCurrentBeastAttack } from "./BeastAttackTarget";

describe("delayed beast attack target", () => {
  const original = { startedAt: 1000, stageNumber: 4, beastId: "suanni" };
  const current = { ...original, active: true };
  it("allows the original active attempt", () => expect(isCurrentBeastAttack(original, current)).toBe(true));
  it("rejects a new attempt, a different stage or a switched beast", () => {
    expect(isCurrentBeastAttack(original, { ...current, startedAt: 2000 })).toBe(false);
    expect(isCurrentBeastAttack(original, { ...current, stageNumber: 5 })).toBe(false);
    expect(isCurrentBeastAttack(original, { ...current, beastId: "netherwolf" })).toBe(false);
  });
  it("rejects ended or missing attempts", () => {
    expect(isCurrentBeastAttack(original, { ...current, active: false })).toBe(false);
    expect(isCurrentBeastAttack(original, null)).toBe(false);
  });
});
