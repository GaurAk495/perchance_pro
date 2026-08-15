import {
  auth,
  signInWithCredential,
  GoogleAuthProvider,
  firebaseSignOut,
} from './firebase-config.ts';
import { checkPremium } from './premium-checker.ts';

export interface AuthUser {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoURL: string;
}

export interface AuthState {
  user: AuthUser | null;
  premium: boolean;
}

const STORAGE_KEY = 'authState';

export async function googleSignIn(): Promise<AuthState> {
  const token = await new Promise<string>((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message ?? 'Google login failed'));
        return;
      }
      resolve(token as string);
    });
  });

  const credential = GoogleAuthProvider.credential(null, token);
  const userCredential = await signInWithCredential(auth, credential);
  const firebaseUser = userCredential.user;

  const user: AuthUser = {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName ?? '',
    email: firebaseUser.email ?? '',
    photoURL: firebaseUser.photoURL ?? '',
  };

  const premium = await checkPremium(firebaseUser.uid);

  const authState: AuthState = { user, premium };
  await chrome.storage.local.set({ [STORAGE_KEY]: authState });

  return authState;
}

export async function signOut(): Promise<void> {
  const token = await new Promise<string | null>((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      resolve((token as string) ?? null);
    });
  });

  if (token) {
    chrome.identity.removeCachedAuthToken({ token });
    try {
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
    } catch {
      // ignore revoke errors
    }
  }

  chrome.identity.clearAllCachedAuthTokens(() => {});
  await firebaseSignOut(auth);
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function getAuthState(): Promise<AuthState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as AuthState) ?? { user: null, premium: false };
}

export async function setAuthPremium(premium: boolean): Promise<void> {
  const current = await getAuthState();
  if (current.user) {
    const updated: AuthState = { ...current, premium };
    await chrome.storage.local.set({ [STORAGE_KEY]: updated });
  }
}

export async function openCheckout(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const token = await user.getIdToken();
  const url = `https://auto-perchance.vercel.app/upgrade.html?app=perchance_pro&token=${encodeURIComponent(token)}`;
  await chrome.tabs.create({ url });
}
