import { describe, expect, it } from "vitest";
import { getTotalRefinementCost, MAX_REFINEMENT_LEVEL, planRefinement, REFINEMENT_COSTS } from "./RefinementRules";

describe("one-click refinement plan", () => {
  it("takes every level the spirit stones pay for, in order, and no more", () => {
    const stones = REFINEMENT_COSTS[0] + REFINEMENT_COSTS[1] + REFINEMENT_COSTS[2] - 1;
    expect(planRefinement(0, stones)).toEqual({ toLevel: 2, levels: 2, cost: REFINEMENT_COSTS[0] + REFINEMENT_COSTS[1] });
    expect(planRefinement(5, 0)).toEqual({ toLevel: 5, levels: 0, cost: 0 });
  });

  it("stops at the cap however rich the player is", () => {
    expect(planRefinement(0, Number.MAX_SAFE_INTEGER)).toEqual({ toLevel: MAX_REFINEMENT_LEVEL, levels: MAX_REFINEMENT_LEVEL, cost: getTotalRefinementCost() });
    expect(planRefinement(MAX_REFINEMENT_LEVEL, Number.MAX_SAFE_INTEGER).levels).toBe(0);
  });
});
