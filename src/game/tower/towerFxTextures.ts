import Phaser from "phaser";

export const FX_SOFT = "tower-fx-soft";
export const FX_LEAF = "tower-fx-leaf";
export const FX_STAR = "tower-fx-star";
export const FX_PETAL = "tower-fx-petal";

/** Draws one small particle sprite onto a canvas texture. */
function paint(scene: Phaser.Scene, key: string, size: number, draw: (context: CanvasRenderingContext2D, size: number) => void): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, size, size);
  if (!texture) return;
  draw(texture.getContext(), size);
  texture.refresh();
}

/** The shared particle sprites of the tower's ambience and ceremonies; generated, so there is nothing to download. */
export function ensureTowerFxTextures(scene: Phaser.Scene): void {
  // A soft round glow.
  paint(scene, FX_SOFT, 64, (context, size) => {
    const glow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.35, "rgba(255,255,255,0.55)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, size, size);
  });
  // A pointed leaf with a centre vein.
  paint(scene, FX_LEAF, 32, (context, size) => {
    context.fillStyle = "#fff";
    context.beginPath();
    context.moveTo(size * 0.08, size * 0.5);
    context.quadraticCurveTo(size * 0.5, size * 0.02, size * 0.94, size * 0.5);
    context.quadraticCurveTo(size * 0.5, size * 0.98, size * 0.08, size * 0.5);
    context.fill();
    context.strokeStyle = "rgba(0,0,0,0.28)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(size * 0.12, size * 0.5);
    context.lineTo(size * 0.88, size * 0.5);
    context.stroke();
  });
  // A four-pointed twinkle.
  paint(scene, FX_STAR, 48, (context, size) => {
    const centre = size / 2;
    context.fillStyle = "#fff";
    context.beginPath();
    context.moveTo(centre, 0);
    context.quadraticCurveTo(centre, centre, size, centre);
    context.quadraticCurveTo(centre, centre, centre, size);
    context.quadraticCurveTo(centre, centre, 0, centre);
    context.quadraticCurveTo(centre, centre, centre, 0);
    context.fill();
  });
  // A rounded petal.
  paint(scene, FX_PETAL, 32, (context, size) => {
    context.fillStyle = "#fff";
    context.beginPath();
    context.moveTo(size * 0.5, size * 0.06);
    context.bezierCurveTo(size * 0.98, size * 0.3, size * 0.8, size * 0.9, size * 0.5, size * 0.96);
    context.bezierCurveTo(size * 0.2, size * 0.9, size * 0.02, size * 0.3, size * 0.5, size * 0.06);
    context.fill();
  });
}
