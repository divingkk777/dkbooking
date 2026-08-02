import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { toPassportEnglishName } from '../domain/defaults';
import {
  assertFirebaseAuthConfig,
  auth,
  createGoogleProvider,
} from './firebase';

const SESSION = {
  loggedIn: 'guest_isLoggedIn',
  method: 'guest_loginMethod',
  email: 'guest_loggedInEmail',
  repName: 'guest_repName',
};

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
  const email = userLike?.email || '';
  const raw =
    userLike?.displayName || userLike?.name || email.split('@')[0] || '';
  // Hangul / non-Latin from Google displayName must not fill passport English field
  const name =
    toPassportEnglishName(raw) ||
    toPassportEnglishName(email.split('@')[0] || '');
  localStorage.setItem(SESSION.loggedIn, 'true');
  localStorage.setItem(SESSION.method, userLike?.method || 'GOOGLE');
  localStorage.setItem(SESSION.email, email);
  localStorage.setItem(SESSION.repName, name);
  return {
    loggedIn: true,
    method: userLike?.method || 'GOOGLE',
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

function toGuestUser(firebaseUser) {
  return {
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || '',
    method: 'GOOGLE',
    uid: firebaseUser.uid,
  };
}

/**
 * Google login via Firebase Auth popup.
 * Domain must be listed under Firebase Auth → Authorized domains
 * (include dkbooking.web.app).
 */
export async function signInWithGoogle() {
  assertFirebaseAuthConfig();
  const provider = createGoogleProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    return { mode: 'popup', user: toGuestUser(result.user) };
  } catch (err) {
    const code = err?.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, provider);
      return new Promise(() => {});
    }
    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      throw new Error(
        `Unauthorized domain (${host}). Firebase Console → Authentication → Settings → Authorized domains 에 추가하세요.`,
      );
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in cancelled');
    }
    if (code === 'auth/argument-error') {
      throw new Error(
        'Google 로그인 설정 오류(auth/argument-error). Firebase Auth에 Google 로그인이 켜져 있는지, 사이트가 Authorized domains에 있는지 확인하세요.',
      );
    }
    throw err;
  }
}

export async function consumeGoogleRedirect() {
  try {
    assertFirebaseAuthConfig();
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    return { mode: 'redirect', user: toGuestUser(result.user) };
  } catch (err) {
    // No pending redirect → ignore argument-error / null results
    if (
      err?.code === 'auth/argument-error' ||
      !err?.code
    ) {
      return null;
    }
    if (err?.code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      throw new Error(
        `Unauthorized domain (${host}). Firebase Console → Authentication → Settings → Authorized domains 에 추가하세요.`,
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
