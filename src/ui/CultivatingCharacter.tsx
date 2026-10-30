import { getDualCultivationSprite, heroCultivationSprite } from "../features/companion/domain/companionSprites";
import { SpriteAnimation } from "./SpriteAnimation";

/** The hero's cross-legged meditation; with a dao companion who has a shared scene drawn, the two cultivate together. */
export function CultivatingCharacter({ characterName, companionId, companionName }: { readonly characterName: string; readonly companionId?: string | null; readonly companionName?: string }): JSX.Element {
  const dual = getDualCultivationSprite(companionId);
  if (dual) return <SpriteAnimation sprite={dual} className="cultivating-character cultivating-character--dual" label={`${characterName}與${companionName ?? "道侶"}雙修，一同吐納靈氣`} />;
  return <SpriteAnimation sprite={heroCultivationSprite} className="cultivating-character" label={`${characterName}盤坐修練`} />;
}
