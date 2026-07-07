import { auth } from './firebase-config.ts';
import { GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut } from 'firebase/auth';
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
  const redirectUrl = `https://${chrome.runtime.id}.chromiumapp.org/`;

  const code = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: buildGoogleOAuthUrl(redirectUrl),
        interactive: true,
      },
      (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(new Error(chrome.runtime.lastError?.message ?? 'OAuth flow failed'));
          return;
        }
        const url = new URL(responseUrl);
        const code = url.searchParams.get('code');
        if (!code) {
          reject(new Error('No authorization code in response'));
          return;
        }
        resolve(code);
      }
    );
  });

  const credential = GoogleAuthProvider.credential(null, code);
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

function buildGoogleOAuthUrl(redirectUrl: string): string {
  const clientId = 'YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com';
  const scopes = ['openid', 'email', 'profile'];

  return (
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: scopes.join(' '),
      prompt: 'consent',
    }).toString()
  );
}
