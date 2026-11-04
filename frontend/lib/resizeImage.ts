/** Center-crops a photo to a square and re-encodes it as a small JPEG, so uploads stay tiny and EXIF/location data is dropped. */
export async function toAvatarBlob(file: File, size = 256): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("That photo could not be read. Try a JPG or PNG."); }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser cannot process photos");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not prepare the photo");
  return blob;
}
