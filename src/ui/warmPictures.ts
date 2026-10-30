import { companionSprites } from "../features/companion/domain/companionSprites";
import { themedMonsters } from "../game/monsters/themedMonsters";
import { skillCasts } from "./pages/adventureCasts";

/**
 * The small first-frame pictures of the companion and adventure pages (about
 * 1.5 MB in all). Fetched in the background once the page in front has its
 * pictures, so opening either page shows its figures at once while their
 * large animation sheets load.
 */
const posters = (): string[] => [
  ...Object.values(companionSprites).map(sprite => sprite.poster),
  ...Object.values(themedMonsters).map(monster => monster.posterPath),
  ...Object.values(skillCasts).map(cast => cast.sprite.poster),
];

export function warmPostersWhenIdle(): () => void {
  let timer: number | null = null;
  let idleHandle: number | null = null;
  const startedAt = Date.now();
  const warm = () => posters().forEach(path => { new Image().src = path; });
  const waitForPictures = () => {
    const loading = Array.from(document.images).some(image => !image.complete);
    if (loading && Date.now() - startedAt < 8_000) { timer = window.setTimeout(waitForPictures, 250); return; }
    if (typeof window.requestIdleCallback === "function") idleHandle = window.requestIdleCallback(warm, { timeout: 2_000 });
    else timer = window.setTimeout(warm, 300);
  };
  timer = window.setTimeout(waitForPictures, 300);
  return () => {
    if (timer !== null) window.clearTimeout(timer);
    if (idleHandle !== null) window.cancelIdleCallback(idleHandle);
  };
}
