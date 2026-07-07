import { db } from './firebase-config.ts';
import { doc, getDoc } from 'firebase/firestore';

interface PremiumCache {
  premium: boolean;
  checkedAt: number;
}

const CACHE_KEY = 'premiumCache';

export async function checkPremium(uid: string): Promise<boolean> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  const premium = userDoc.exists() ? userDoc.data().premium === true : false;

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
