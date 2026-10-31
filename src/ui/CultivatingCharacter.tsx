import { useMemo } from "react";
import { getDualCultivationSprite, heroCultivationSprite, spriteLoopMs } from "../features/companion/domain/companionSprites";
import type { RealmId } from "../features/cultivation";
import { QI_BLEED, QiBreathEffect, SOLO_QI } from "./QiBreathEffect";
import { getRealmLotus, getRealmQiLook } from "./realmQi";
import { SpriteAnimation } from "./SpriteAnimation";

/** One breath of the solo meditation: two passes of the 32-frame loop, slow enough to read. */
const SOLO_BREATH_MS = spriteLoopMs(heroCultivationSprite) * 2;

/**
 * The hero's cross-legged meditation. With a dao companion who has a shared
 * scene drawn, it is the same picture and the same qi, with her beside him:
 * each of the two gets the solo picture's breathing qi.
 */
export function CultivatingCharacter({ characterName, companionId, companionName, realmId = "qi" }: { readonly characterName: string; readonly companionId?: string | null; readonly companionName?: string; readonly realmId?: RealmId }): JSX.Element {
  const dual = getDualCultivationSprite(companionId);
  // His qi shows his realm; a companion beside him keeps the plain look.
  const heroLook = useMemo(() => getRealmQiLook(realmId), [realmId]);
  const lotus = getRealmLotus(realmId);
  const bleed = `${-QI_BLEED * 100}%`;
  return (
    <div className={dual ? "cultivating-stage cultivating-stage--dual" : "cultivating-stage"}>
      {dual
        ? (dual.peopleX ?? [27, 73]).map((x, index) => (
          <div key={x} className="qi-breath-box qi-breath-box--person" style={{ left: `${x}%` }}>
            <QiBreathEffect look={index === 0 ? heroLook : SOLO_QI} periodMs={SOLO_BREATH_MS} />
          </div>
        ))
        : (
          <div className="qi-breath-box" style={{ inset: bleed }}>
            <QiBreathEffect look={heroLook} periodMs={SOLO_BREATH_MS} />
          </div>
        )}
      {dual
        ? <SpriteAnimation sprite={dual} className="cultivating-character cultivating-character--dual" label={`${characterName}與${companionName ?? "道侶"}雙修，一同吐納靈氣`} />
        : (
          <>
            {/* He sits on the lotus: its back half behind him, its front petals over his legs. */}
            {lotus && <img className="realm-lotus" src={lotus} alt="" aria-hidden="true" draggable={false} />}
            <SpriteAnimation sprite={heroCultivationSprite} className="cultivating-character" label={`${characterName}盤坐修練`} />
            {lotus && <img className="realm-lotus realm-lotus--front" src={lotus} alt="" aria-hidden="true" draggable={false} />}
          </>
        )}
    </div>
  );
}
