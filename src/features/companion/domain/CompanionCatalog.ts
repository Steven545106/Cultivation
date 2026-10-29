import type { RealmId } from "../../cultivation/domain/RealmCatalog";

/**
 * Dao companions (道侶). Each unlocks when the hero reaches her major realm and
 * from then on raises cultivation speed (持有效果). One chosen companion
 * cultivates with him (雙修), adding her dual-cultivation effect: attack % and
 * one specialty. See docs/dual-cultivation-spec.md.
 */
export type CompanionId = "tingxue" | "wanqing" | "xinglan" | "wanyue" | "yunshu";

export interface CompanionDualEffect {
  /** Added to the final-attack % of the sword effects. */
  readonly attackPercent: number;
  readonly cultivationSpeed?: number;
  readonly spiritStoneSpeed?: number;
  /** Percentage points added to every major-breakthrough success chance. */
  readonly breakthroughSuccessBonus?: number;
  /** A failed major breakthrough costs no cultivation (pity still rises). */
  readonly breakthroughFailureProtection?: boolean;
}

export interface CompanionConfig {
  readonly companionId: CompanionId;
  readonly nameZh: string;
  /** The image her name evokes, shown under it. */
  readonly imageryZh: string;
  /** Major realm the hero must reach to unlock her. */
  readonly unlockRealmId: RealmId;
  /** Possession (持有) bonus: cultivation speed while unlocked. */
  readonly possessionCultivationSpeed: number;
  readonly dualEffect: CompanionDualEffect;
  /** Accent colour for her card and medallion. */
  readonly accent: string;
  /** Her portrait (tools/prepare_companion_art.py); null shows a medallion with her name instead. */
  readonly portraitPath: string | null;
  /**
   * Her qi-breathing (吐納) loop for the home page's dual-cultivation scene
   * (tools/animate_companion_breath.py); null shows `portraitPath` instead.
   */
  readonly breathingAnimationPath: string | null;
}

export const companionCatalog: readonly CompanionConfig[] = [
  {
    companionId: "tingxue",
    nameZh: "林聽雪",
    imageryZh: "寒梅聽雪，冰心靜修",
    unlockRealmId: "qi",
    possessionCultivationSpeed: 0.03,
    dualEffect: { attackPercent: 0.05, cultivationSpeed: 0.1 },
    accent: "#9fd8ff",
    portraitPath: "/assets/companions/lin_tingxue-poster.webp",
    breathingAnimationPath: "/assets/companions/lin_tingxue-poster.webp",
  },
  {
    companionId: "wanqing",
    nameZh: "蘇晚晴",
    imageryZh: "雨後晚晴，醫道溫潤",
    unlockRealmId: "nascentSoul",
    possessionCultivationSpeed: 0.05,
    dualEffect: { attackPercent: 0.08, breakthroughSuccessBonus: 0.08 },
    accent: "#9fe3b4",
    portraitPath: "/assets/companions/su_wanqing-poster.webp",
    breathingAnimationPath: "/assets/companions/su_wanqing-poster.webp",
  },
  {
    companionId: "xinglan",
    nameZh: "顧星瀾",
    imageryZh: "星河瀾瀾，推演天機",
    unlockRealmId: "celestial",
    possessionCultivationSpeed: 0.07,
    dualEffect: { attackPercent: 0.11, spiritStoneSpeed: 0.2 },
    accent: "#b9a8ff",
    portraitPath: "/assets/companions/gu_xinglan-poster.webp",
    breathingAnimationPath: "/assets/companions/gu_xinglan-poster.webp",
  },
  {
    companionId: "wanyue",
    nameZh: "慕容挽月",
    imageryZh: "挽月入懷，清輝護道",
    unlockRealmId: "venerable",
    possessionCultivationSpeed: 0.09,
    dualEffect: { attackPercent: 0.14, breakthroughSuccessBonus: 0.04, breakthroughFailureProtection: true },
    accent: "#e8e4ff",
    portraitPath: "/assets/companions/murong_wanyue-poster.webp",
    breathingAnimationPath: "/assets/companions/murong_wanyue-poster.webp",
  },
  {
    companionId: "yunshu",
    nameZh: "南宮雲舒",
    imageryZh: "雲卷雲舒，去留無意",
    unlockRealmId: "sovereign",
    possessionCultivationSpeed: 0.11,
    dualEffect: { attackPercent: 0.17, cultivationSpeed: 0.15 },
    accent: "#ffd7a8",
    portraitPath: "/assets/companions/nangong_yunshu-poster.webp",
    breathingAnimationPath: "/assets/companions/nangong_yunshu-poster.webp",
  },
];

const companionById = new Map(companionCatalog.map(companion => [companion.companionId, companion]));

export function getCompanionById(companionId: string): CompanionConfig | undefined {
  return companionById.get(companionId as CompanionId);
}

export function isCompanionId(value: unknown): value is CompanionId {
  return typeof value === "string" && companionById.has(value as CompanionId);
}
