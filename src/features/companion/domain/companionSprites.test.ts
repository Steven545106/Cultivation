import { describe, expect, it } from "vitest";
import { companionSprites, getDualCultivationSprite, heroCultivationSprite, getCompanionSprite, spriteFrameAt, type CompanionSprite } from "./companionSprites";

const sprite = (steps: CompanionSprite["steps"], blendMs: number): CompanionSprite => ({ sheet: "s", poster: "p", cols: 2, cellWidth: 10, cellHeight: 10, steps, blendMs });

describe("companion sprite playback", () => {
  it("holds each frame, then cross-fades into the next one", () => {
    const loop = sprite([{ cell: 0, holdMs: 100 }, { cell: 1, holdMs: 200 }], 50);
    expect(spriteFrameAt(loop, 0)).toEqual({ from: 0, to: 0, mix: 0 });
    expect(spriteFrameAt(loop, 99)).toEqual({ from: 0, to: 0, mix: 0 });
    expect(spriteFrameAt(loop, 125)).toEqual({ from: 0, to: 1, mix: 0.5 });
    expect(spriteFrameAt(loop, 150)).toEqual({ from: 1, to: 1, mix: 0 });
    // The last frame blends back into the first, and the loop repeats.
    expect(spriteFrameAt(loop, 375)).toEqual({ from: 1, to: 0, mix: 0.5 });
    expect(spriteFrameAt(loop, 400 + 125)).toEqual(spriteFrameAt(loop, 125));
  });

  it("cuts straight between frames with no blend", () => {
    const loop = sprite([{ cell: 0, holdMs: 100 }, { cell: 1, holdMs: 100 }], 0);
    expect(spriteFrameAt(loop, 100)).toEqual({ from: 1, to: 1, mix: 0 });
    expect(spriteFrameAt(loop, 200)).toEqual({ from: 0, to: 0, mix: 0 });
  });

  it("keeps every sheet inside its grid and plays the astrolabe cast forward then back", () => {
    for (const [id, item] of Object.entries(companionSprites)) {
      expect(item.steps.every(step => Number.isInteger(step.cell) && step.cell >= 0 && step.holdMs > 0), id).toBe(true);
    }
    const cells = companionSprites["gu-xinglan"].steps.map(step => step.cell);
    expect(cells).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(Math.max(...cells)).toBeLessThan(companionSprites["gu-xinglan"].cols * 3);
  });

  it("plays the moon dance's 24 frames once each, with a longer hold on the landing spin", () => {
    const dance = companionSprites["murong-wanyue"];
    expect(dance.steps.map(step => step.cell)).toEqual(Array.from({ length: 24 }, (_, index) => index));
    expect(dance.steps.filter(step => step.holdMs > 95).map(step => step.cell)).toEqual([16, 17, 18, 19, 20]);
    expect(dance.steps.length).toBeLessThanOrEqual(dance.cols * 4);
  });

  it("plays the fan dance's 24 frames once each, holding the cloud spin longer", () => {
    const dance = companionSprites["nangong-yunshu"];
    expect(dance.steps.map(step => step.cell)).toEqual(Array.from({ length: 24 }, (_, index) => index));
    expect(dance.steps.filter(step => step.holdMs > 110).map(step => step.cell)).toEqual([14, 15, 16]);
    expect(dance.steps.length).toBeLessThanOrEqual(dance.cols * 4);
  });

  it("plays the potion tasting and healing ripple once each, holding the bitter face and the ripple", () => {
    const loop = companionSprites["su-wanqing"];
    expect(loop.steps.map(step => step.cell)).toEqual(Array.from({ length: 24 }, (_, index) => index));
    expect(loop.steps.filter(step => step.holdMs > 110).map(step => step.cell)).toEqual([8, 9, 16, 17, 18, 19]);
    expect(loop.steps.length).toBeLessThanOrEqual(loop.cols * 4);
  });

  it("plays the plum blossom dance's 24 frames once each, holding the spin and the offering pose", () => {
    const dance = companionSprites["lin-tingxue"];
    expect(dance.steps.map(step => step.cell)).toEqual(Array.from({ length: 24 }, (_, index) => index));
    expect(dance.steps.filter(step => step.holdMs > 110).map(step => step.cell)).toEqual([10, 11, 12, 15, 16]);
    expect(dance.steps.length).toBeLessThanOrEqual(dance.cols * 4);
  });

  it("plays the hero's original meditation loop frame by frame", () => {
    expect(heroCultivationSprite.steps.map(step => step.cell)).toEqual(Array.from({ length: 32 }, (_, index) => index));
    expect(heroCultivationSprite.steps.length).toBeLessThanOrEqual(heroCultivationSprite.cols * 4);
  });

  it("plays the two-person meditation for Lin Tingxue, Su Wanqing and Gu Xinglan and leaves the others solo", () => {
    const dual = getDualCultivationSprite("lin-tingxue");
    expect(dual).not.toBeNull();
    expect(dual?.steps.map(step => step.cell)).toEqual(Array.from({ length: 32 }, (_, index) => index));
    expect(getDualCultivationSprite("tingxue")).toBe(dual);
    expect(getDualCultivationSprite("su-wanqing")).not.toBeNull();
    expect(getDualCultivationSprite("wanqing")).toBe(getDualCultivationSprite("su-wanqing"));
    expect(getDualCultivationSprite("gu-xinglan")).not.toBeNull();
    expect(getDualCultivationSprite("murong-wanyue")).toBeNull();
    expect(getDualCultivationSprite(null)).toBeNull();
  });

  it("finds a sprite by either catalog's id", () => {
    expect(getCompanionSprite("xinglan")).toBe(companionSprites["gu-xinglan"]);
    expect(getCompanionSprite("su-wanqing")).toBe(companionSprites["su-wanqing"]);
    expect(getCompanionSprite("wanyue")).toBe(companionSprites["murong-wanyue"]);
    expect(getCompanionSprite("yunshu")).toBe(companionSprites["nangong-yunshu"]);
    expect(getCompanionSprite("unknown")).toBeNull();
  });
});
