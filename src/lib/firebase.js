import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// getAuth includes browserPopupRedirectResolver — required for signInWithPopup.
// initializeAuth without popupRedirectResolver causes auth/argument-error.
export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(() => {
  /* ignore */
});

export const db = getFirestore(app);
export const storage = getStorage(app);

export function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function assertFirebaseAuthConfig() {
  const missing = [];
  if (!firebaseConfig.apiKey) missing.push('VITE_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) missing.push('VITE_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.appId) missing.push('VITE_FIREBASE_APP_ID');
  if (missing.length) {
    throw new Error(
      `Firebase config missing: ${missing.join(', ')}. Rebuild with .env.`,
    );
  }
}

export const COLLECTIONS = {
  reservations: 'reservations',
  trashed: 'trashed_reservations',
  logs: 'admin_logs',
  settings: 'system_settings',
};

export const SETTINGS_DOC = 'admin_config';
