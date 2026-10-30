import { TOWER_FLOORS_PER_THEME, towerThemes } from "../../tower/domain/TowerTheme";
import type { AdventureEnemySpec } from "./AdventureBattle";
import type { Roll } from "./AdventureBattle";

/** The creature drawn for each tower theme (see game/monsters/themedMonsters). */
const creatureNames: Readonly<Record<string, string>> = {
  mist: "雲霧靈鶴",
  forest: "青翠靈鹿",
  flame: "熔岩火蜥",
  frost: "霜銀雪狼",
  thunder: "雷紋靈猞",
  star: "星河靈狐",
  blossom: "桃花九尾狐",
  gold: "金輝獅龍",
  blood: "血月魔獸",
  chaos: "混沌奇美拉",
};

/** How many themes the hero has reached: the one of the next tower floor, so the first is always open. */
export function getUnlockedThemeCount(highestClearedStage: number): number {
  const floorOfNextStage = Math.floor(Math.max(0, highestClearedStage) / 10) + 1;
  return Math.min(towerThemes.length, Math.floor((floorOfNextStage - 1) / TOWER_FLOORS_PER_THEME) + 1);
}

/** A random creature from the themes already reached. */
export function pickAdventureEnemy(highestClearedStage: number, roll: Roll): AdventureEnemySpec {
  const reached = towerThemes.slice(0, getUnlockedThemeCount(highestClearedStage));
  const theme = reached[Math.min(reached.length - 1, Math.floor(roll() * reached.length))];
  return { id: theme.id, nameZh: creatureNames[theme.id] ?? theme.nameZh, themeId: theme.id };
}
