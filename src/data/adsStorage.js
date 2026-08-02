import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';

export const AD_IMAGE_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Upload ad banner image to Firebase Storage and return a public download URL.
 * Avoids embedding large base64 blobs in Firestore settings (1MB doc limit).
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
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: file.type || 'image/png',
    cacheControl: 'public,max-age=31536000',
  });
  return getDownloadURL(storageRef);
}
