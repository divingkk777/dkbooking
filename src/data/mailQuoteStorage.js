import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * Upload a quote/approval PNG for email links (public read).
 */
export async function uploadMailQuotePng(blob, fileName = 'quote.jpg') {
  if (!blob) throw new Error('No image');
  const safe = String(fileName || 'quote.jpg')
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 100);
  const path = `mail-quotes/${Date.now()}_${safe}`;
  const type = String(blob.type || '').includes('png')
    ? 'image/png'
    : 'image/jpeg';
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    contentType: type,
    cacheControl: 'public,max-age=604800',
  });
  return getDownloadURL(storageRef);
}
