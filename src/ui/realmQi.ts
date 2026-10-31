import type { RealmId } from "../features/cultivation";
import { SOLO_QI, type QiBreathLook } from "./QiBreathEffect";

/**
 * The look of the hero's meditation at each major realm: its colours, how
 * much qi moves, how far it reaches, one sign of the realm drawn over the breathing (see
 * QiBreathEffect's signature layer), and from the high realms on, wings on his back (from 半神)
 * in a grander style at every realm. The lotus seat (from 天尊) is a picture, see `getRealmLotus`.
 */
const REALM_QI: Readonly<Record<RealmId, Partial<QiBreathLook>>> = {
  // 凝氣: a few pale wisps; no halo yet.
  qi: { qi: "150, 214, 240", accent: "225, 245, 255", gold: "200, 230, 245", intensity: 0.3, reach: 0.36, halos: [], signature: "wisps" },
  // 築基: an amber rune circle laid on the ground as the foundation.
  foundation: { qi: "238, 190, 110", accent: "255, 236, 196", gold: "255, 208, 120", intensity: 0.5, reach: 0.42, signature: "runes" },
  // 結丹: a golden core forms at the dantian, with pellets of qi circling it.
  core: { qi: "255, 196, 92", accent: "255, 240, 200", gold: "255, 216, 110", intensity: 0.65, reach: 0.47, signature: "core" },
  // 元嬰: the nascent soul floats above his head.
  nascentSoul: { qi: "176, 140, 255", accent: "236, 222, 255", gold: "255, 206, 236", intensity: 0.75, reach: 0.5, signature: "infant" },
  // 天人: a pillar of light comes down from the sky.
  celestial: { qi: "255, 246, 214", accent: "255, 255, 245", gold: "255, 222, 140", intensity: 0.85, reach: 0.53, signature: "pillar" },
  // 半神: violet lightning crackles round him; small wings of light.
  demigod: { qi: "170, 120, 255", accent: "232, 214, 255", gold: "210, 170, 255", intensity: 0.92, reach: 0.55, signature: "lightning", wings: 1, wingImage: { src: "/assets/realm/wings-demigod.webp", rootY: 0.61, width: 1.8 } },
  // 天尊: a crimson flame aura rises; flame wings and a crimson lotus.
  venerable: { qi: "255, 112, 72", accent: "255, 214, 160", gold: "255, 170, 80", intensity: 1.0, reach: 0.57, signature: "flame", wings: 2, wingImage: { src: "/assets/realm/wings-venerable.webp", rootY: 0.65, width: 1.7 } },
  // 太古: an ancient bagua turns about him; full feathered wings and a white jade lotus on lily pads.
  archaic: { qi: "120, 214, 170", accent: "220, 255, 236", gold: "214, 236, 160", intensity: 1.08, reach: 0.59, signature: "bagua", wings: 3, wingImage: { src: "/assets/realm/wings-archaic.webp", rootY: 0.64, width: 1.65 } },
  // 主宰: a field of stars wheels round him; two pairs of crystal wings and a sapphire crystal lotus.
  sovereign: { qi: "120, 150, 255", accent: "214, 226, 255", gold: "255, 220, 140", intensity: 1.16, reach: 0.61, signature: "stars", wings: 4, wingImage: { src: "/assets/realm/wings-sovereign.webp", rootY: 0.64, width: 1.55 } },
  // 永恆: rings of every colour turn, with sword lights circling; three pairs of gilded wings and a golden lotus.
  eternal: { qi: "190, 220, 255", accent: "255, 255, 255", gold: "255, 226, 150", intensity: 1.3, reach: 0.63, signature: "eternal", wings: 5, wingImage: { src: "/assets/realm/wings-eternal.webp", rootY: 0.61, width: 1.4 } },
};

export function getRealmQiLook(realmId: RealmId, base: QiBreathLook = SOLO_QI): QiBreathLook {
  return { ...base, ...REALM_QI[realmId] };
}

/** The lotus seat he sits on from 天尊, a finer one at each realm; null below. */
const REALM_LOTUS: Partial<Record<RealmId, string>> = {
  venerable: "/assets/realm/lotus-venerable.webp",
  archaic: "/assets/realm/lotus-archaic.webp",
  sovereign: "/assets/realm/lotus-sovereign.webp",
  eternal: "/assets/realm/lotus-eternal.webp",
};

export function getRealmLotus(realmId: RealmId): string | null {
  return REALM_LOTUS[realmId] ?? null;
}
