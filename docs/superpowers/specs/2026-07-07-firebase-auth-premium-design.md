# Firebase Auth + Premium Gating Design

## Overview

Add Firebase Authentication (Google Sign-In) to the Perchance Pro Chrome extension. Only premium users can access the extension's functionality. Premium status is stored in Firestore and fetched on login.

## Decisions

- **Auth method**: Google Sign-In via `chrome.identity.launchWebAuthFlow`
- **Premium storage**: Firestore document `users/{uid}` with `{ premium: boolean }`
- **Premium gating**: Non-premium users see an upsell screen; premium users see the dashboard
- **Premium check**: Fetch on login only; cached in `chrome.storage.local`; manual refresh button available. No background polling.
- **UI**: Sidebar has 3 states — login screen, upsell screen, dashboard

## Architecture

### New Files

```
src/auth/
├── firebase-config.ts    # Firebase app + auth initialization (tree-shaken)
├── auth-manager.ts       # Google sign-in, sign-out, auth state management
└── premium-checker.ts    # Firestore premium fetch, caching, manual refresh
```

### Modified Files

| File | Change |
|------|--------|
| `manifest.json` | Add `identity` permission |
| `background.ts` | Handle auth messages (`GOOGLE_SIGN_IN`, `SIGN_OUT`, `GET_AUTH_STATE`, `REFRESH_PREMIUM`), store auth state in `chrome.storage.local` |
| `sidebar.ts` | Auth gate logic: request auth state on load, toggle between login/upsell/dashboard screens |
| `sidebar.html` | Add login screen and upsell screen markup |
| `sidebar.css` | Styles for auth screens |
| `shared/messages.ts` | Add auth message type definitions |
| `package.json` | Add `firebase` dependency |

### Data Flow

```
Sidebar opens
  → GET_AUTH_STATE from background
  → Background returns { user: { uid, displayName, email, photoURL } | null, premium: boolean }
  → If no user: show #auth-login
  → If user + !premium: show #auth-upsell
  → If user + premium: show #auth-dashboard

Sign-in button clicked
  → GOOGLE_SIGN_IN message to background
  → Background: chrome.identity.launchWebAuthFlow → Google OAuth code
  → Background: GoogleAuthProvider.credential(code) → signInWithCredential(auth, credential)
  → Background: fetch users/{uid} from Firestore
  → Background: store { user, premium } in chrome.storage.local
  → Returns to sidebar → shows dashboard or upsell

Sign-out button clicked
  → SIGN_OUT message to background
  → Background: auth.signOut(), clear stored auth state
  → Sidebar → shows login screen

Refresh premium clicked
  → REFRESH_PREMIUM message to background
  → Background: re-fetch users/{uid} from Firestore, update cache
  → Sidebar: update UI based on new premium status
```

## Component Details

### firebase-config.ts

```typescript
// Only these imports (tree-shaken):
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

Firebase web config is safe to expose in client code (security is enforced via Firestore rules + Auth).

### auth-manager.ts

**`googleSignIn()`**:
1. Build Google OAuth URL with `chrome.identity.launchWebAuthFlow`
2. Redirect URL: `https://<extension-id>.chromiumapp.org/`
3. Extract auth code from redirect URL
4. Create credential: `GoogleAuthProvider.credential(null, accessToken)` (using `chrome.identity.getAuthToken` instead of launchWebAuthFlow for simplicity)
5. Sign in: `signInWithCredential(auth, credential)`
6. Fetch premium status from Firestore
7. Store `{ user: { uid, displayName, email, photoURL }, premium }` in `chrome.storage.local`
8. Return auth state to sidebar

**`signOut()`**:
1. Call `auth.signOut()`
2. Clear `authUser` and `premium` from `chrome.storage.local`
3. Return to sidebar

**`getAuthState()`**:
1. Read from `chrome.storage.local`
2. Return `{ user, premium }`

**Token refresh**:
- On `googleSignIn`, call `user.getIdToken()` to store the ID token
- No periodic refresh — token is re-obtained on next sidebar open if needed

### premium-checker.ts

**`checkPremium(uid: string)`**:
1. Firestore query: `getDoc(doc(db, 'users', uid))`
2. Read `premium` field from document
3. If document doesn't exist, return `{ premium: false }`

**`getPremiumStatus()`**:
1. Read from `chrome.storage.local` cache
2. If cache exists and is valid, return cached value
3. Otherwise fetch from Firestore

**`refreshPremium(uid: string)`**:
1. Fetch fresh from Firestore
2. Update cache in `chrome.storage.local`
3. Return new status

**Caching**:
- Stored in `chrome.storage.local` as `{ premium: boolean, premiumCheckedAt: number }`
- Cache has no TTL — only refreshed on explicit user action (login, manual refresh)
- Zero background DB reads

### background.ts Changes

Handle new messages in the `onMessage` listener:

| Message | Action |
|---------|--------|
| `GOOGLE_SIGN_IN` | Run OAuth flow, sign in to Firebase, fetch premium, store state, respond |
| `SIGN_OUT` | Sign out of Firebase, clear stored state, respond |
| `GET_AUTH_STATE` | Return stored `{ user, premium }` from `chrome.storage.local` |
| `REFRESH_PREMIUM` | Re-fetch premium from Firestore, update cache, respond |

### sidebar.ts Changes

On `DOMContentLoaded`:
1. Send `GET_AUTH_STATE` to background
2. Receive `{ user, premium }`
3. If `user === null` → show `#auth-login`, hide others
4. If `user && !premium` → show `#auth-upsell`, hide others
5. If `user && premium` → show `#auth-dashboard`, hide others

Event listeners:
- `btn-google-signin` click → send `GOOGLE_SIGN_IN`, then re-check auth state
- `btn-signout` click → send `SIGN_OUT`, then show login screen
- `btn-refresh-premium` click → send `REFRESH_PREMIUM`, update UI

### sidebar.html Additions

```html
<!-- Auth: Login Screen -->
<div id="auth-login" class="auth-screen" style="display:none">
  <div class="auth-container">
    <div class="auth-logo">Perchance Pro</div>
    <p class="auth-tagline">Bulk image generation automation</p>
    <button id="btn-google-signin" class="btn-google">
      <img src="google-icon.svg" alt="" class="google-icon">
      Sign in with Google
    </button>
  </div>
</div>

<!-- Auth: Upsell Screen -->
<div id="auth-upsell" class="auth-screen" style="display:none">
  <div class="auth-container">
    <img id="upsell-avatar" class="auth-avatar" src="" alt="">
    <div id="upsell-name" class="auth-name"></div>
    <div class="premium-badge locked">🔒 Premium Required</div>
    <p class="upsell-text">Upgrade to premium to use Perchance Pro.</p>
    <ul class="upsell-features">
      <li>Bulk image generation</li>
      <li>Multiple worker support</li>
      <li>Custom filenames & folders</li>
    </ul>
    <button id="btn-signout-upsell" class="btn-text">Sign out</button>
  </div>
</div>

<!-- Auth: Dashboard (wraps existing content) -->
<div id="auth-dashboard" class="auth-screen" style="display:none">
  <div class="user-bar">
    <img id="user-avatar" class="user-bar-avatar" src="" alt="">
    <span id="user-name" class="user-bar-name"></span>
    <span class="premium-badge active">✦ Premium</span>
    <button id="btn-refresh-premium" class="btn-icon" title="Refresh premium status">↻</button>
    <button id="btn-signout" class="btn-text">Sign out</button>
  </div>
  <!-- existing tab-bar, tab-content, etc. go here -->
</div>
```

### sidebar.css Additions

- `.auth-screen` — full-height flex container, centered content
- `.auth-container` — centered card with logo, text, buttons
- `.btn-google` — Google-styled sign-in button (white bg, Google colors)
- `.premium-badge` — pill badge (locked = gray, active = gold/gradient)
- `.upsell-features` — clean feature list with checkmarks
- `.user-bar` — horizontal bar at top of dashboard with avatar, name, badge, sign out

### messages.ts Additions

```typescript
// Auth messages
interface GoogleSignInMessage { action: 'GOOGLE_SIGN_IN' }
interface SignOutMessage { action: 'SIGN_OUT' }
interface GetAuthStateMessage { action: 'GET_AUTH_STATE' }
interface RefreshPremiumMessage { action: 'REFRESH_PREMIUM' }

interface AuthStateResponse {
  user: { uid: string; displayName: string; email: string; photoURL: string } | null;
  premium: boolean;
}
```

## Firestore Setup (Manual)

1. Create Firestore database in Firebase Console
2. Collection: `users`
3. Document ID: Firebase Auth UID
4. Document fields: `{ premium: boolean, createdAt: timestamp }`
5. Set `premium: true` manually for paying users via Firebase Console

## Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }
  }
}
```

## Security Notes

- Firebase web config (apiKey, projectId, etc.) is safe to expose — security is enforced via Firestore rules + Auth
- `identity` permission allows OAuth without a server callback
- Firestore rules prevent users from modifying their own premium status
- Auth state is stored in `chrome.storage.local` (extension-only, not accessible to web pages)

## Testing Checklist

- [ ] Sign in with Google opens OAuth flow
- [ ] After sign-in, sidebar shows dashboard or upsell based on premium
- [ ] Non-premium user sees upsell screen with feature list
- [ ] Premium user sees full dashboard with user bar
- [ ] Sign out clears state and returns to login screen
- [ ] Refresh premium button fetches fresh status from Firestore
- [ ] Sidebar state persists across panel open/close
- [ ] Extension works after browser restart (auth state persisted)
- [ ] Background script handles auth messages without errors
