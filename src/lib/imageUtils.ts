// Tool photos are stored directly in Postgres as base64 data URLs, and the whole
// inventory is fetched with its images. Downscaling every photo before sending it
// to `/api/tools` keeps that payload (and the labeler's mobile data usage) small.

export const TOOL_IMAGE_MAX_SIZE = 400;
export const TOOL_IMAGE_QUALITY = 0.8;

/**
 * Reads a picture picked on the phone and returns a JPEG data URL that is at most
 * `maxSize` pixels on its longest side.
 */
export function compressImageFile(
  file: File,
  maxSize: number = TOOL_IMAGE_MAX_SIZE,
  quality: number = TOOL_IMAGE_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.onloadend = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unable to decode the selected image.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        } else if (height >= width && height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to process the selected image.'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
