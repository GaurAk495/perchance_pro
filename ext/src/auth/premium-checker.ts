import { auth, db } from './firebase-config.ts';
import { doc, getDoc } from 'firebase/firestore';

interface PremiumCache {
  premium: boolean;
  checkedAt: number;
}

const CACHE_KEY = 'premiumCache';

async function checkClaims(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    // forceRefresh pulls the latest custom claims (set instantly by the webhook).
    const tokenResult = await user.getIdTokenResult(true);
    return tokenResult.claims.premium === true;
  } catch (err) {
    console.error('Failed to read custom claims:', err);
    return false;
  }
}

async function checkFirestore(uid: string): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    return userDoc.exists() ? userDoc.data().premium === true : false;
  } catch (err) {
    console.error(`Failed to check premium status for uid "${uid}":`, err);
    return false;
  }
}

export async function checkPremium(uid: string): Promise<boolean> {
  // Claims first for instant unlock; Firestore as a fallback for older users.
  const premium = (await checkClaims()) || (await checkFirestore(uid));

  const cache: PremiumCache = { premium, checkedAt: Date.now() };
  await chrome.storage.local.set({ [CACHE_KEY]: cache });

  return premium;
}

export async function getCachedPremium(): Promise<boolean> {
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cache = result[CACHE_KEY] as PremiumCache | undefined;
  return cache?.premium ?? false;
}

export async function refreshPremium(uid: string): Promise<boolean> {
  return checkPremium(uid);
}
