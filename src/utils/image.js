// Downscale an uploaded photo to a small JPEG data URL so it fits in
// localStorage / a JSON payload.
// The API accepts photos up to 400,000 characters, so keep shrinking until the result fits.
export const MAX_PHOTO_CHARS = 300000;

export function fileToDataUrl(file, maxDim = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let dim = maxDim;
        let q = quality;
        let out = '';
        for (let i = 0; i < 6; i += 1) {
          const scale = Math.min(1, dim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          out = canvas.toDataURL('image/jpeg', q);
          if (out.length <= MAX_PHOTO_CHARS) break;
          dim = Math.round(dim * 0.75);
          q = Math.max(0.4, q - 0.08);
        }
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
