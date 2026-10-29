import { heroCultivationSprite } from "../features/companion/domain/companionSprites";
import { SpriteAnimation } from "./SpriteAnimation";

/** The hero's cross-legged meditation: a breathing cycle played from one sprite sheet. */
export function CultivatingCharacter({ characterName }: { readonly characterName: string }): JSX.Element {
  return <SpriteAnimation sprite={heroCultivationSprite} className="cultivating-character" label={`${characterName}盤坐修練`} />;
}
