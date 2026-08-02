import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

const SESSION = {
  loggedIn: 'guest_isLoggedIn',
  method: 'guest_loginMethod',
  email: 'guest_loggedInEmail',
  repName: 'guest_repName',
};

/** Kept for any legacy GIS references; Firebase Auth popup no longer needs it. */
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '564197776292-915k9jsa01ha94bc8djg7v6lrkj081i9.apps.googleusercontent.com';

export function loadGuestSession() {
  return {
    loggedIn: localStorage.getItem(SESSION.loggedIn) === 'true',
    method: localStorage.getItem(SESSION.method) || '',
    email: localStorage.getItem(SESSION.email) || '',
    repName: localStorage.getItem(SESSION.repName) || '',
  };
}

export function persistGuestUser(userLike) {
  const email = userLike.email || '';
  const name = (
    userLike.displayName ||
    userLike.name ||
    email.split('@')[0] ||
    ''
  )
    .toString()
    .toUpperCase();
  localStorage.setItem(SESSION.loggedIn, 'true');
  localStorage.setItem(SESSION.method, userLike.method || 'GOOGLE');
  localStorage.setItem(SESSION.email, email);
  localStorage.setItem(SESSION.repName, name);
  return {
    loggedIn: true,
    method: userLike.method || 'GOOGLE',
    email,
    repName: name,
  };
}

export function clearGuestSession() {
  localStorage.removeItem(SESSION.loggedIn);
  localStorage.removeItem(SESSION.method);
  localStorage.removeItem(SESSION.email);
  localStorage.removeItem(SESSION.repName);
}

/**
 * Google login via Firebase Auth popup (uses Firebase-managed OAuth client).
 * Avoids GIS origin_mismatch on new Hosting sites like dkbooking.web.app.
 * Hosting domain must be in Firebase Auth → Authorized domains.
 */
export async function signInWithGoogle() {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  googleProvider.addScope('email');
  googleProvider.addScope('profile');

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return {
      mode: 'popup',
      user: {
        email: result.user.email || '',
        displayName: result.user.displayName || '',
        method: 'GOOGLE',
        uid: result.user.uid,
      },
    };
  } catch (err) {
    const code = err?.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, googleProvider);
      // Navigation away — caller should keep busy until page unloads
      return new Promise(() => {});
    }
    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      throw new Error(
        `Unauthorized domain (${host}). Add it in Firebase Auth → Settings → Authorized domains.`,
      );
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in cancelled');
    }
    throw err;
  }
}

export async function consumeGoogleRedirect() {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    return {
      mode: 'redirect',
      user: {
        email: result.user.email || '',
        displayName: result.user.displayName || '',
        method: 'GOOGLE',
        uid: result.user.uid,
      },
    };
  } catch (err) {
    if (err?.code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      throw new Error(
        `Unauthorized domain (${host}). Add it in Firebase Auth → Settings → Authorized domains.`,
      );
    }
    throw err;
  }
}

export function watchGuestAuth(onUser) {
  return onAuthStateChanged(auth, (u) => {
    onUser(u || null);
  });
}

export function getCurrentAuthUser() {
  return auth.currentUser;
}

/** Local guest session without Google (emergency / offline booking start). */
export function continueAsGuest({ email, name }) {
  return persistGuestUser({
    email: (email || '').trim(),
    displayName: (name || '').trim(),
    method: 'EMAIL',
  });
}

export async function signOutGuest() {
  clearGuestSession();
  try {
    await signOut(auth);
  } catch {
    /* ignore */
  }
}
