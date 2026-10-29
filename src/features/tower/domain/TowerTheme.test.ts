import { describe, expect, it } from "vitest";
import { TOWER_FLOOR_COUNT } from "./TowerBalanceConfig";
import { getFloorTitle, getTowerTheme, towerThemes, TOWER_FLOORS_PER_THEME } from "./TowerTheme";

describe("tower floor themes", () => {
  it("gives the hundred floors ten themes of ten floors each", () => {
    expect(towerThemes).toHaveLength(TOWER_FLOOR_COUNT / TOWER_FLOORS_PER_THEME);
    expect(new Set(towerThemes.map(theme => theme.id)).size).toBe(towerThemes.length);
  });

  it("changes the theme every ten floors", () => {
    expect(getTowerTheme(1)).toBe(towerThemes[0]);
    expect(getTowerTheme(10)).toBe(towerThemes[0]);
    expect(getTowerTheme(11)).toBe(towerThemes[1]);
    expect(getTowerTheme(100)).toBe(towerThemes[9]);
  });

  it("keeps odd floor numbers inside the tower", () => {
    expect(getTowerTheme(0)).toBe(towerThemes[0]);
    expect(getTowerTheme(-5)).toBe(towerThemes[0]);
    expect(getTowerTheme(250)).toBe(towerThemes[9]);
    expect(getTowerTheme(Number.NaN)).toBe(towerThemes[0]);
  });

  it("names the floor for its title card", () => {
    expect(getFloorTitle(12)).toBe("第 12 層");
    expect(getFloorTitle(500)).toBe("第 100 層");
  });
});
