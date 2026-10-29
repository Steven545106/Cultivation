import type { WeaponElement } from "../weapons/WeaponConfig";

/** Particle silhouettes generated at runtime; no image assets are required. */
export type SwingParticleShape = "spark" | "glint" | "shard" | "petal" | "mote";

export interface SwingVfxProfile {
  readonly particle: SwingParticleShape;
  /** Each particle picks one tint at random. */
  readonly particleTints: readonly number[];
  /** Particles emitted at the blade tip per swing frame. */
  readonly particlesPerSample: number;
  /** Downward drift; petals and shards fall, sparks and glints hang. */
  readonly particleGravity: number;
  /** Bright inner edge of the trail ribbon (additive). */
  readonly coreColor: number;
  readonly afterimageTint: number;
  /** Flickering jagged arcs along the trail; thunder only. */
  readonly lightning: boolean;
}

/** One look per element; the record type forces every element to be covered. */
export const swingVfxProfiles: Readonly<Record<WeaponElement, SwingVfxProfile>> = {
  雷: { particle: "spark", particleTints: [0xffffff, 0xdaf6ff, 0x9ddcff], particlesPerSample: 2, particleGravity: 0, coreColor: 0xffffff, afterimageTint: 0xbfeaff, lightning: true },
  星月: { particle: "glint", particleTints: [0xc7d9ff, 0x7895ff, 0xffe9a8], particlesPerSample: 1, particleGravity: 0, coreColor: 0xe6ecff, afterimageTint: 0x9fb2ff, lightning: false },
  月: { particle: "glint", particleTints: [0xffffff, 0xd9efff], particlesPerSample: 1, particleGravity: 0, coreColor: 0xffffff, afterimageTint: 0xe9f7ff, lightning: false },
  時空: { particle: "mote", particleTints: [0x6daeff, 0xb9a6ff, 0xffffff], particlesPerSample: 1, particleGravity: -10, coreColor: 0xd7edff, afterimageTint: 0x8fa8ff, lightning: false },
  星光: { particle: "glint", particleTints: [0xffffff, 0xfff2b8, 0xbfe4ff], particlesPerSample: 2, particleGravity: 0, coreColor: 0xffffff, afterimageTint: 0xfff6d6, lightning: false },
  冰月: { particle: "shard", particleTints: [0xc8f5ff, 0xffffff], particlesPerSample: 1, particleGravity: 50, coreColor: 0xf0fdff, afterimageTint: 0xc8f5ff, lightning: false },
  冰風: { particle: "mote", particleTints: [0xe1faff, 0xffffff, 0xbfe9ff], particlesPerSample: 2, particleGravity: -20, coreColor: 0xffffff, afterimageTint: 0xe1faff, lightning: false },
  冰: { particle: "shard", particleTints: [0xa5e5ff, 0xe1faff, 0xffffff], particlesPerSample: 2, particleGravity: 70, coreColor: 0xeafaff, afterimageTint: 0xa5e5ff, lightning: false },
  木: { particle: "petal", particleTints: [0x85d999, 0xc7ffd5, 0xffc4dd], particlesPerSample: 1, particleGravity: 35, coreColor: 0xe4ffe9, afterimageTint: 0xa8e8b6, lightning: false },
  冰花: { particle: "petal", particleTints: [0xffd3e6, 0xe2f1ff, 0xffffff], particlesPerSample: 2, particleGravity: 30, coreColor: 0xffffff, afterimageTint: 0xf3dcff, lightning: false },
};

export function getSwingVfxProfile(element: WeaponElement): SwingVfxProfile {
  return swingVfxProfiles[element];
}
