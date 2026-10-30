import { getDualCultivationSprite, heroCultivationSprite, spriteLoopMs } from "../features/companion/domain/companionSprites";
import { QI_BLEED, QiBreathEffect, SOLO_QI } from "./QiBreathEffect";
import { SpriteAnimation } from "./SpriteAnimation";

/** One breath of the solo meditation: two passes of the 32-frame loop, slow enough to read. */
const SOLO_BREATH_MS = spriteLoopMs(heroCultivationSprite) * 2;

/** The hero's cross-legged meditation; with a dao companion who has a shared scene drawn, the two cultivate together. The qi breathes around them. */
export function CultivatingCharacter({ characterName, companionId, companionName }: { readonly characterName: string; readonly companionId?: string | null; readonly companionName?: string }): JSX.Element {
  const dual = getDualCultivationSprite(companionId);
  const bleed = `${-QI_BLEED * 100}%`;
  return (
    <div className={dual ? "cultivating-stage cultivating-stage--dual" : "cultivating-stage"}>
      {/* The shared scene has its heaven-and-earth qi painted into the frames; only the solo picture gets the drawn effect. */}
      {!dual && (
        <div className="qi-breath-box" style={{ inset: bleed }}>
          <QiBreathEffect look={SOLO_QI} periodMs={SOLO_BREATH_MS} />
        </div>
      )}
      {dual
        ? <SpriteAnimation sprite={dual} className="cultivating-character cultivating-character--dual" label={`${characterName}與${companionName ?? "道侶"}雙修，一同吐納靈氣`} />
        : <SpriteAnimation sprite={heroCultivationSprite} className="cultivating-character" label={`${characterName}盤坐修練`} />}
    </div>
  );
}
