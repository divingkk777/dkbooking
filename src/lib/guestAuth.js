import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase';

const SESSION = {
  loggedIn: 'guest_isLoggedIn',
  method: 'guest_loginMethod',
  email: 'guest_loggedInEmail',
  repName: 'guest_repName',
};

/** Web client from diving-reservation-app Google OAuth */
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

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }
    const existing = document.querySelector('script[data-gis="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.gis = '1';
    script.onload = () => resolve(window.google);
    script.onerror = () =>
      reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

function decodeJwtPayload(credential) {
  try {
    const payload = credential.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Google login WITHOUT Firebase /__/auth/handler popup
 * (that blank page is what was blocking localhost login).
 */
export async function signInWithGoogle() {
  const google = await loadGisScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          if (!response?.credential) {
            finish(reject, new Error('No Google credential'));
            return;
          }
          const profile = decodeJwtPayload(response.credential);
          const credential = GoogleAuthProvider.credential(response.credential);
          try {
            const result = await signInWithCredential(auth, credential);
            finish(resolve, {
              mode: 'gis',
              user: result.user,
            });
          } catch {
            // Firestore/Auth rules may still allow guest session even if
            // Firebase Auth credential exchange fails.
            finish(resolve, {
              mode: 'gis-local',
              user: {
                email: profile.email || '',
                displayName: profile.name || '',
                method: 'GOOGLE',
              },
            });
          }
        } catch (err) {
          finish(reject, err);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });

    // Prefer One Tap / FedCM prompt; if skipped, fall back to OAuth token popup.
    google.accounts.id.prompt((notification) => {
      if (settled) return;
      const skipped =
        notification.isNotDisplayed?.() ||
        notification.isSkippedMoment?.() ||
        notification.isDismissedMoment?.();
      if (!skipped) return;

      try {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            try {
              if (tokenResponse.error) {
                finish(reject, new Error(tokenResponse.error));
                return;
              }
              const res = await fetch(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                {
                  headers: {
                    Authorization: `Bearer ${tokenResponse.access_token}`,
                  },
                },
              );
              if (!res.ok) {
                finish(reject, new Error('Failed to fetch Google profile'));
                return;
              }
              const profile = await res.json();
              finish(resolve, {
                mode: 'gis-token',
                user: {
                  email: profile.email || '',
                  displayName: profile.name || '',
                  method: 'GOOGLE',
                },
              });
            } catch (err) {
              finish(reject, err);
            }
          },
          error_callback: (err) => {
            finish(
              reject,
              new Error(err?.message || 'Google OAuth cancelled'),
            );
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        finish(reject, err);
      }
    });
  });
}

export async function consumeGoogleRedirect() {
  // GIS flow does not use Firebase redirect handler.
  return null;
}

export function watchGuestAuth(onUser) {
  return onAuthStateChanged(auth, (user) => {
    onUser(user || null);
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
