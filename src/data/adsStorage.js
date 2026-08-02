import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { withTimeout } from '../lib/withTimeout';

export const AD_IMAGE_MAX_BYTES = 50 * 1024 * 1024;
/** Firestore settings doc ~1MB — keep data-URL fallback under this. */
const DATA_URL_MAX_CHARS = 700_000;
const UPLOAD_TIMEOUT_MS = 12000;

/**
 * Upload ad banner image to Firebase Storage and return a public download URL.
 * If Storage is unavailable / times out, falls back to a compressed data URL
 * (so the admin UI never sticks on “Uploading…”).
 */
export async function uploadAdImage(file) {
  if (!file) throw new Error('No file');
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('Not an image');
  }
  if (file.size > AD_IMAGE_MAX_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const safe = String(file.name || 'ad')
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 80);
  const path = `ads/${Date.now()}_${safe}`;

  try {
    const storageRef = ref(storage, path);
    await withTimeout(
      uploadBytes(storageRef, file, {
        contentType: file.type || 'image/png',
        cacheControl: 'public,max-age=31536000',
      }),
      UPLOAD_TIMEOUT_MS,
      'Storage upload',
    );
    return await withTimeout(
      getDownloadURL(storageRef),
      8000,
      'Storage URL',
    );
  } catch (err) {
    console.warn('Storage upload failed, using compressed data URL', err);
    const dataUrl = await fileToCompressedDataUrl(file);
    if (!dataUrl || dataUrl.length > DATA_URL_MAX_CHARS) {
      const e = new Error('STORAGE_OR_SIZE');
      e.cause = err;
      throw e;
    }
    return dataUrl;
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    img.src = url;
  });
}

/** Resize/compress until under DATA_URL_MAX_CHARS (or give up). */
async function fileToCompressedDataUrl(file) {
  const img = await loadImageFromFile(file);
  const maxW = 1600;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > maxW) {
    h = Math.round((h * maxW) / w);
    w = maxW;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS');

  let quality = 0.85;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= DATA_URL_MAX_CHARS) return dataUrl;
    quality -= 0.1;
    if (quality < 0.45) {
      w = Math.round(w * 0.75);
      h = Math.round(h * 0.75);
      quality = 0.75;
    }
    if (w < 320) break;
  }
  return canvas.toDataURL('image/jpeg', 0.5);
}
