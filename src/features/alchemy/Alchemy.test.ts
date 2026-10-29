import { describe, expect, it } from "vitest";
import { QUALITY_CHANCES, ALCHEMY_DURATION_MS, alchemistLevel, alchemyCost, discardPill, consumePill, normalizeAlchemy, pillBonus, pillsTakenToday, PILL_DAILY_LIMIT, qualityFromRoll, completeAlchemy } from "./Alchemy";

describe("煉丹規則", () => {
  it("機率合計為 100%，等級與抽取符合門檻", () => {
    QUALITY_CHANCES.forEach(row => expect(row.reduce<number>((a, b) => a + b, 0)).toBe(100));
    expect(alchemistLevel(499)).toBe(4); expect(alchemistLevel(500)).toBe(5);
    expect(qualityFromRoll(0, 0.59)).toBe(0); expect(qualityFromRoll(0, 0.99)).toBe(2);
    expect(alchemyCost("qi")).toBe(120);
  });
  it("每種丹藥每天最多服用 10 顆，累計不設上限，隔天重置", () => {
    const day1 = new Date(2026, 9, 28, 9).getTime();
    let state = normalizeAlchemy({ inventory: { attack: [0, 30, 0, 0, 0, 0], crit: [0, 3, 0, 0, 0, 0] }, consumed: { attack: [0, 25, 0, 0, 0, 0] } });
    for (let i = 0; i < PILL_DAILY_LIMIT; i += 1) state = consumePill(state, "attack", 1, day1)!;
    expect(state.consumed.attack[1]).toBe(35);
    expect(pillsTakenToday(state, "attack", day1)).toBe(10);
    expect(consumePill(state, "attack", 1, day1 + 3_600_000)).toBeNull();
    expect(pillBonus(state, "attack")).toBeCloseTo(35 * 0.004);
    // Other pill kinds have their own daily count.
    expect(consumePill(state, "crit", 1, day1)!.dailyConsumed.crit).toBe(1);
    // The next local day starts from zero again; the permanent total keeps growing.
    const day2 = new Date(2026, 9, 29, 0, 5).getTime();
    expect(pillsTakenToday(state, "attack", day2)).toBe(0);
    const next = consumePill(state, "attack", 1, day2)!;
    expect(next.consumed.attack[1]).toBe(36);
    expect(pillsTakenToday(next, "attack", day2)).toBe(1);
    expect(consumePill(next, "attack", 0, day2)).toBeNull();
  });
  it("讀檔保留當天服用數，舊存檔沒有欄位時視為今天未服用，並限制數值", () => {
    const now = new Date(2026, 9, 28, 12).getTime();
    const state = consumePill(normalizeAlchemy({ inventory: { attack: [0, 1, 0, 0, 0, 0] } }), "attack", 1, now)!;
    const reloaded = normalizeAlchemy(JSON.parse(JSON.stringify(state)));
    expect(pillsTakenToday(reloaded, "attack", now)).toBe(1);
    expect(pillsTakenToday(normalizeAlchemy({ consumed: { attack: [20, 0, 0, 0, 0, 0] } }), "attack", now)).toBe(0);
    expect(normalizeAlchemy({ dailyDate: "2026-10-28", dailyConsumed: { attack: 99, crit: -3 } }).dailyConsumed).toMatchObject({ attack: 10, crit: 0 });
    expect(normalizeAlchemy({ dailyDate: "yesterday" }).dailyDate).toBe("");
  });
  it("五秒後才結算一次，讀檔可恢復煉製並保留結果", () => {
    const state = normalizeAlchemy({ pending: { id: "attack", quality: 2, startedAt: 1000 } });
    expect(completeAlchemy(state, 1000 + ALCHEMY_DURATION_MS - 1)).toBe(state);
    const done = completeAlchemy(state, 1000 + ALCHEMY_DURATION_MS);
    expect(done.attempts).toBe(1);
    expect(done.inventory.attack[2]).toBe(1);
    expect(done.pending).toBeNull();
    expect(completeAlchemy(done, 20000)).toBe(done);
    const failed = completeAlchemy(normalizeAlchemy({ pending: { id: "crit", quality: -1, startedAt: 1000 } }), 6000);
    expect(failed.attempts).toBe(1);
    expect(failed.inventory.crit.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it("十次煉製分別計算結果、次數，重新讀檔後不重複發放", () => {
    const state = normalizeAlchemy({ pending: { id: "attack", qualities: [0, 0, 1, 1, 2, 2, -1, -1, -1, -1], startedAt: 1000 } });
    const done = completeAlchemy(state, 6000);
    expect(done.attempts).toBe(10);
    expect(done.inventory.attack).toEqual([2, 2, 2, 0, 0, 0]);
    expect(done.lastResult?.qualities.filter(q => q === -1)).toHaveLength(4);
    expect(completeAlchemy(normalizeAlchemy(done), 9000).inventory.attack).toEqual([2, 2, 2, 0, 0, 0]);
    expect(normalizeAlchemy({ pending: { id: "attack", quality: 2, startedAt: 1000 } }).pending?.qualities).toEqual([2]);
  });
  it("丟棄指定品級和數量，不更動已服用效果，拒絕無效數量", () => {
    const state = normalizeAlchemy({ inventory: { attack: [3, 2, 0, 0, 0, 0] }, consumed: { attack: [1, 0, 0, 0, 0, 0] } });
    const next = discardPill(state, "attack", 0, 2)!;
    expect(next.inventory.attack).toEqual([1, 2, 0, 0, 0, 0]);
    expect(next.consumed.attack).toEqual(state.consumed.attack);
    expect(pillBonus(next, "attack")).toBe(pillBonus(state, "attack"));
    expect(discardPill(state, "attack", 0, 4)).toBeNull();
    expect(discardPill(state, "attack", 0, 0)).toBeNull();
    expect(discardPill(state, "attack", 0, 1.5)).toBeNull();
    expect(discardPill(state, "attack", 6, 1)).toBeNull();
  });
});
