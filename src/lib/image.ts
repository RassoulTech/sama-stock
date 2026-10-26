/**
 * Redimensionne et compresse une photo dans le navigateur (léger pour les connexions 3G).
 * Les logos passent en JPEG : ils servent aussi à fabriquer l'icône de l'application, qui ne lit pas le WebP.
 */
export async function compressImage(file: File, maxSize = 640, quality = 0.8, format: "webp" | "jpeg" = "webp"): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  if (format === "jpeg") return canvas.toDataURL("image/jpeg", quality);
  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
}
