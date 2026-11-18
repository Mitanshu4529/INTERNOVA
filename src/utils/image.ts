// Profile pictures are stored inside the profile record, so they are scaled
// down in the browser first. A phone photo of several megabytes becomes a
// square-ish JPEG of a few tens of kilobytes.

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // refuse absurdly large files before decoding them
export const PHOTO_MAX_SIDE = 256;               // pixels on the longer side after scaling

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function isSupportedPhoto(file: File): boolean {
  return PHOTO_TYPES.includes(file.type);
}

/** Target size that fits within `maxSide` while keeping the aspect ratio. */
export function scaledSize(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Reads an image file and returns it as a small JPEG data URL. */
export function resizePhoto(file: File, maxSide = PHOTO_MAX_SIDE): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const { width, height } = scaledSize(image.naturalWidth, image.naturalHeight, maxSide);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context || !width || !height) throw new Error('This image could not be read.');
        // JPEG has no transparency: paint white behind transparent PNGs.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be read.'));
    };
    image.src = url;
  });
}
