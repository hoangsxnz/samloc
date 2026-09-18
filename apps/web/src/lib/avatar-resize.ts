const AVATAR_SIZE = 128;
const AVATAR_MAX_BYTES = 64 * 1024;
const QUALITIES = [0.85, 0.7];

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older Safari rejects the options form; modern captures are already upright.
    return createImageBitmap(file);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Centre-crops to a square and re-encodes as a 128×128 JPEG small enough for the upload cap. */
export async function resizeAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Chọn một tệp ảnh');
  const bitmap = await decode(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không xử lý được ảnh');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  for (const quality of QUALITIES) {
    const blob = await toBlob(canvas, quality);
    if (blob && blob.size <= AVATAR_MAX_BYTES) return blob;
  }
  throw new Error('Ảnh quá lớn');
}
