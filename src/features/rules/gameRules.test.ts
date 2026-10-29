import { describe, expect, it } from "vitest";
import { buildGameRules } from "./gameRules";

const tables = Object.fromEntries(buildGameRules().map(table => [table.id, table]));

describe("in-game rule tables", () => {
  it("covers every realm, sword and realm bracket of the tower", () => {
    expect(tables.realms.rows).toHaveLength(10);
    expect(tables.weapons.rows).toHaveLength(10);
    expect(tables.tower.rows).toHaveLength(10);
    expect(tables.refinement.rows.length).toBeGreaterThan(0);
    for (const table of Object.values(tables)) {
      for (const row of table.rows) expect(row).toHaveLength(table.headers.length);
    }
  });

  it("states the live rules: sword formula, realm floors, tower anchors", () => {
    expect(tables.weapons.rows[1][2]).toBe("築基＋通關第 10 層");
    expect(tables.weapons.rows[9][2]).toBe("永恆＋通關第 90 層");
    expect(tables.realms.rows[9].at(-1)).toBe("91–100 層");
    expect(tables.tower.rows[0]).toEqual(["1–10 層", "第 1–100 關", "凝氣", "2,160", "16,560", "276"]);
  });
});
