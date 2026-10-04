// Shrinks phone photos before saving. A 12-megapixel photo is 3-8 MB; at
// 1600px on the long side it's a few hundred KB and still plenty to see what's
// going on in a bed. If the browser can't read the image (some HEIC files),
// the original is kept rather than lost.

const MAX_EDGE = 1600;
const QUALITY = 0.82;

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

export async function shrinkPhoto(file) {
  try {
    const img = await loadImage(file); // browsers apply the photo's rotation here
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.type === 'image/jpeg' && file.size < 600_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

// Object URLs for showing stored photos. Released whenever the screen changes.
const urls = new Set();

export function photoUrl(blob) {
  const url = URL.createObjectURL(blob);
  urls.add(url);
  return url;
}

export function releasePhotoUrls() {
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear();
}
