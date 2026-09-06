import { auth, db } from './firebase-config.ts';
import { doc, getDoc } from 'firebase/firestore';

interface PremiumCache {
  premium: boolean;
  plan: string;
  planActivatedAt: number | null;
  checkedAt: number;
}

const CACHE_KEY = 'premiumCache';

export interface PremiumStatus {
  premium: boolean;
  plan: string;
  planActivatedAt: number | null;
}

async function checkClaims(): Promise<PremiumStatus> {
  const user = auth.currentUser;
  if (!user) return { premium: false, plan: 'none', planActivatedAt: null };
  try {
    // forceRefresh pulls the latest custom claims (set instantly by the webhook).
    const tokenResult = await user.getIdTokenResult(true);
    const claims = tokenResult.claims;
    return {
      premium: claims.premium === true,
      plan: typeof claims.plan === 'string' ? claims.plan : 'none',
      planActivatedAt: typeof claims.planActivatedAt === 'number' ? claims.planActivatedAt : null,
    };
  } catch (err) {
    console.error('Failed to read custom claims:', err);
    return { premium: false, plan: 'none', planActivatedAt: null };
  }
}

async function checkFirestore(uid: string): Promise<PremiumStatus> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return { premium: false, plan: 'none', planActivatedAt: null };
    }
    const data = userDoc.data();
    const activated = data.monthlyStartedAt
      ? new Date(data.monthlyStartedAt).getTime()
      : data.lifetimePurchasedAt
        ? new Date(data.lifetimePurchasedAt).getTime()
        : typeof data.planActivatedAt === 'number'
          ? data.planActivatedAt
          : null;
    return {
      premium: data.premium === true || data.isPremium === true,
      plan: typeof data.plan === 'string' ? data.plan : 'none',
      planActivatedAt: activated,
    };
  } catch (err) {
    console.error(`Failed to check premium status for uid "${uid}":`, err);
    return { premium: false, plan: 'none', planActivatedAt: null };
  }
}

export async function checkPremium(uid: string): Promise<PremiumStatus> {
  // Claims first for instant unlock; Firestore as a fallback for older users.
  const claims = await checkClaims();
  let status = claims;
  if (!claims.premium) {
    const firestore = await checkFirestore(uid);
    if (firestore.premium) status = firestore;
  }

  const cache: PremiumCache = {
    premium: status.premium,
    plan: status.plan,
    planActivatedAt: status.planActivatedAt,
    checkedAt: Date.now(),
  };
  await chrome.storage.local.set({ [CACHE_KEY]: cache });

  return status;
}

export async function getCachedPremium(): Promise<PremiumStatus> {
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cache = result[CACHE_KEY] as PremiumCache | undefined;
  return {
    premium: cache?.premium ?? false,
    plan: cache?.plan ?? 'none',
    planActivatedAt: cache?.planActivatedAt ?? null,
  };
}

export async function refreshPremium(uid: string): Promise<PremiumStatus> {
  return checkPremium(uid);
}
