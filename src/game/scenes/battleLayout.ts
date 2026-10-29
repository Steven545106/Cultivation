import Phaser from "phaser";
import { validateRig, type RigDefinition } from "../../features/character";

/** Centre of the circular cultivation plaza in the home background: where the hero stands. */
export const PLAYER = new Phaser.Math.Vector2(640, 460);
/** Weapons are drawn at this share of their configured display scale in the plaza. */
export const PLAZA_WEAPON_SCALE = 0.52;

const RIG_MANIFEST_KEY = "bai-rig";
const RIG_MANIFEST_PATH = "/assets/player/rig/bai-rig.json";

/** Which manifest to load; the battle always uses the default (V1.1). The rig lab may pick another. */
export interface RigSource {
  readonly key: string;
  readonly path: string;
}

const DEFAULT_RIG: RigSource = { key: RIG_MANIFEST_KEY, path: RIG_MANIFEST_PATH };

/**
 * Queues the cutout rig manifest; its part images (front and back views) are
 * queued as soon as the JSON arrives. Call from `preload`.
 */
export function preloadRig(scene: Phaser.Scene, source: RigSource = DEFAULT_RIG): void {
  scene.load.json(source.key, source.path);
  scene.load.once(`filecomplete-json-${source.key}`, (_key: string, _type: string, data: RigDefinition) => {
    data?.parts?.forEach(part => {
      scene.load.image(part.texture, part.file);
      if (part.back?.texture && part.back.file) scene.load.image(part.back.texture, part.back.file);
    });
  });
}

/** The validated rig, or null (legacy single PNG) when the manifest or any part image is missing. */
export function loadRig(scene: Phaser.Scene, source: RigSource = DEFAULT_RIG): RigDefinition | null {
  const rig = scene.cache.json.get(source.key) as RigDefinition | undefined;
  if (!rig) return null;
  try {
    validateRig(rig);
  } catch (error) {
    console.warn("Character rig rejected; using the single PNG.", error);
    return null;
  }
  return rig.parts.every(part => scene.textures.exists(part.texture) && (!part.back?.texture || scene.textures.exists(part.back.texture))) ? rig : null;
}
