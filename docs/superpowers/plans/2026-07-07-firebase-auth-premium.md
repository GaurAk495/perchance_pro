# Firebase Auth + Premium Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firebase Google Sign-In authentication and Firestore-based premium gating to the Perchance Pro Chrome extension.

**Architecture:** Auth module (`src/auth/`) handles Firebase init, Google sign-in via `chrome.identity`, and Firestore premium checks. Background script manages auth state. Sidebar shows login/upsell/dashboard based on auth state.

**Tech Stack:** Firebase (Auth + Firestore), Chrome Identity API, TypeScript, Bun

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `ext/package.json` | Modify | Add `firebase` dependency |
| `ext/manifest.json` | Modify | Add `identity` permission |
| `ext/src/auth/firebase-config.ts` | Create | Firebase app + auth + Firestore initialization |
| `ext/src/auth/auth-manager.ts` | Create | Google sign-in, sign-out, auth state management |
| `ext/src/auth/premium-checker.ts` | Create | Firestore premium fetch + caching |
| `ext/src/shared/messages.ts` | Modify | Add auth message types |
| `ext/src/background/background.ts` | Modify | Handle auth messages, store auth state |
| `ext/src/sidebar/sidebar.html` | Modify | Add login + upsell screens, user bar |
| `ext/src/sidebar/sidebar.css` | Modify | Auth screen styles |
| `ext/src/sidebar/sidebar.ts` | Modify | Auth gate logic, sign-in/out handlers |

---

### Task 1: Install Firebase Dependency

**Files:**
- Modify: `ext/package.json`

- [ ] **Step 1: Add firebase to dependencies**

```bash
cd F:\code\app\extension\perchance_pro\ext
bun add firebase
```

- [ ] **Step 2: Verify installation**

Run: `bun run bun.lock | head -5`
Expected: `bun.lock` file updated with firebase entry

- [ ] **Step 3: Commit**

```bash
cd F:\code\app\extension\perchance_pro
git add ext/package.json ext/bun.lock
git commit -m "feat: add firebase dependency"
```

---

### Task 2: Add `identity` Permission to Manifest

**Files:**
- Modify: `ext/manifest.json:6`

- [ ] **Step 1: Add identity permission**

In `ext/manifest.json`, change the `permissions` array from:

```json
"permissions": ["storage", "downloads", "sidePanel"],
```

to:

```json
"permissions": ["storage", "downloads", "sidePanel", "identity"],
```

- [ ] **Step 2: Verify manifest is valid JSON**

Run: `cd F:\code\app\extension\perchance_pro\ext && bun -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add ext/manifest.json
git commit -m "feat: add identity permission for Google OAuth"
```

---

### Task 3: Create Firebase Config Module

**Files:**
- Create: `ext/src/auth/firebase-config.ts`

- [ ] **Step 1: Create firebase-config.ts**

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

> **Note:** Replace the placeholder values with your actual Firebase project config from Firebase Console → Project Settings → General → Your apps → Firebase SDK snippet.

- [ ] **Step 2: Verify import resolution**

Run: `cd F:\code\app\extension\perchance_pro\ext && bun build src/auth/firebase-config.ts --outdir /dev/null 2>&1 | head -5`
Expected: No "module not found" errors for firebase imports

- [ ] **Step 3: Commit**

```bash
git add ext/src/auth/firebase-config.ts
git commit -m "feat: add firebase config module"
```

---

### Task 4: Create Auth Manager Module

**Files:**
- Create: `ext/src/auth/auth-manager.ts`

- [ ] **Step 1: Create auth-manager.ts**

```typescript
import { auth, db } from './firebase-config.ts';
import { GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
```

> **Note:** You need to create an OAuth 2.0 Client ID in Google Cloud Console for Chrome Extension type, and replace `YOUR_GOOGLE_OAUTH_CLIENT_ID`. The redirect URL format is `https://<extension-id>.chromiumapp.org/`.

- [ ] **Step 2: Verify build compiles**

Run: `cd F:\code\app\extension\perchance_pro\ext && bun build src/auth/auth-manager.ts --outdir /dev/null 2>&1 | head -10`
Expected: No compilation errors (warnings about chrome API are fine)

- [ ] **Step 3: Commit**

```bash
git add ext/src/auth/auth-manager.ts
git commit -m "feat: add auth manager with Google sign-in"
```

---

### Task 5: Create Premium Checker Module

**Files:**
- Create: `ext/src/auth/premium-checker.ts`

- [ ] **Step 1: Create premium-checker.ts**

```typescript
import { db } from './firebase-config.ts';
import { doc, getDoc } from 'firebase/firestore';

interface PremiumCache {
  premium: boolean;
  checkedAt: number;
}

const CACHE_KEY = 'premiumCache';

export async function checkPremium(uid: string): Promise<boolean> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  const premium = userDoc.exists() ? (userDoc.data().premium === true) : false;

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
```

- [ ] **Step 2: Verify build compiles**

Run: `cd F:\code\app\extension\perchance_pro\ext && bun build src/auth/premium-checker.ts --outdir /dev/null 2>&1 | head -10`
Expected: No compilation errors

- [ ] **Step 3: Commit**

```bash
git add ext/src/auth/premium-checker.ts
git commit -m "feat: add premium checker with Firestore"
```

---

### Task 6: Add Auth Message Types

**Files:**
- Modify: `ext/src/shared/messages.ts`

- [ ] **Step 1: Add auth message types**

Append to the end of `ext/src/shared/messages.ts`:

```typescript
// ─── Auth Messages ───

export interface GoogleSignInMessage {
  readonly action: 'GOOGLE_SIGN_IN';
}

export interface SignOutMessage {
  readonly action: 'SIGN_OUT';
}

export interface GetAuthStateMessage {
  readonly action: 'GET_AUTH_STATE';
}

export interface RefreshPremiumMessage {
  readonly action: 'REFRESH_PREMIUM';
}

export interface AuthStateResponse {
  user: {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string;
  } | null;
  premium: boolean;
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd F:\code\app\extension\perchance_pro\ext && bun build src/shared/messages.ts --outdir /dev/null 2>&1 | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add ext/src/shared/messages.ts
git commit -m "feat: add auth message types"
```

---

### Task 7: Add Auth Handlers to Background Script

**Files:**
- Modify: `ext/src/background/background.ts`

- [ ] **Step 1: Add auth imports at top of background.ts**

Add after the existing import on line 1:

```typescript
import { googleSignIn, signOut, getAuthState, setAuthPremium } from '../auth/auth-manager.ts';
import { refreshPremium } from '../auth/premium-checker.ts';
```

- [ ] **Step 2: Add auth message handlers in the onMessage listener**

In the `chrome.runtime.onMessage.addListener` callback, add these handlers before the `return true;` at line 533. Insert after the `CLEAR_LOGS` handler block:

```typescript
  } else if (msg.action === 'GOOGLE_SIGN_IN') {
    try {
      const authState = await googleSignIn();
      sendResponse(authState);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      log(`Google sign-in failed: ${message}`, 'error');
      sendResponse({ user: null, premium: false });
    }
    return true;
  } else if (msg.action === 'SIGN_OUT') {
    await signOut();
    log('User signed out.', 'info');
    sendResponse({ status: 'signed_out' });
  } else if (msg.action === 'GET_AUTH_STATE') {
    const authState = await getAuthState();
    sendResponse(authState);
  } else if (msg.action === 'REFRESH_PREMIUM') {
    const authState = await getAuthState();
    if (authState.user) {
      const premium = await refreshPremium(authState.user.uid);
      await setAuthPremium(premium);
      sendResponse({ premium });
    } else {
      sendResponse({ premium: false });
    }
  }
```

- [ ] **Step 3: Make the onMessage callback async-compatible**

The current `onMessage` callback uses `sendResponse` synchronously. For the auth handlers that use `await`, we need to return `true` to indicate async response. The existing `return true` at line 533 already handles this — verify it's the last statement in the callback.

- [ ] **Step 4: Verify build compiles**

Run: `cd F:\code\app\extension\perchance_pro\ext && bun build src/background/background.ts --outdir /dev/null 2>&1 | head -10`
Expected: No compilation errors

- [ ] **Step 5: Commit**

```bash
git add ext/src/background/background.ts
git commit -m "feat: add auth message handlers to background"
```

---

### Task 8: Add Auth Screens to Sidebar HTML

**Files:**
- Modify: `ext/src/sidebar/sidebar.html`

- [ ] **Step 1: Add auth screens before the existing `<div id="app">`**

Insert after the `<body>` tag (line 15) and before `<div id="app">` (line 16):

```html
    <!-- Auth: Login Screen -->
    <div id="auth-login" class="auth-screen" style="display:none">
      <div class="auth-container">
        <div class="auth-logo">Perchance Pro</div>
        <p class="auth-tagline">Bulk image generation automation</p>
        <button id="btn-google-signin" class="btn-google">
          <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>

    <!-- Auth: Upsell Screen -->
    <div id="auth-upsell" class="auth-screen" style="display:none">
      <div class="auth-container">
        <img id="upsell-avatar" class="auth-avatar" src="" alt="" style="display:none">
        <div id="upsell-name" class="auth-name"></div>
        <div class="premium-badge locked">Premium Required</div>
        <p class="upsell-text">Upgrade to premium to use Perchance Pro.</p>
        <ul class="upsell-features">
          <li>Bulk image generation</li>
          <li>Multiple worker support</li>
          <li>Custom filenames and folders</li>
        </ul>
        <button id="btn-signout-upsell" class="btn-text">Sign out</button>
      </div>
    </div>

    <!-- Auth: Dashboard -->
    <div id="auth-dashboard" class="auth-screen" style="display:none">
```

- [ ] **Step 2: Add user bar inside auth-dashboard, before existing header**

Inside the `<div id="auth-dashboard">` that wraps existing content, add before the existing `<div id="header">`:

```html
      <div class="user-bar">
        <img id="user-avatar" class="user-bar-avatar" src="" alt="">
        <span id="user-name" class="user-bar-name"></span>
        <span class="premium-badge active">Premium</span>
        <button id="btn-refresh-premium" class="btn-icon" title="Refresh premium status">&#8635;</button>
        <button id="btn-signout" class="btn-text">Sign out</button>
      </div>
```

- [ ] **Step 3: Close the auth-dashboard div**

After the closing `</div>` of `<div id="app">` (line 138), add:

```html
    </div><!-- /auth-dashboard -->
```

- [ ] **Step 4: Verify HTML structure**

Run: `cd F:\code\app\extension\perchance_pro\ext && bun -e "const h=require('fs').readFileSync('src/sidebar/sidebar.html','utf8'); const opens=(h.match(/<div/g)||[]).length; const closes=(h.match(/<\/div>/g)||[]).length; console.log('divs:', opens, 'opens', closes, 'closes', opens===closes?'OK':'MISMATCH')"`
Expected: `divs: N opens N closes OK`

- [ ] **Step 5: Commit**

```bash
git add ext/src/sidebar/sidebar.html
git commit -m "feat: add login, upsell, and dashboard auth screens to sidebar"
```

---

### Task 9: Add Auth Screen Styles

**Files:**
- Modify: `ext/src/sidebar/sidebar.css`

- [ ] **Step 1: Add auth screen styles**

Append to the end of `ext/src/sidebar/sidebar.css`:

```css
/* ─── Auth Screens ─── */

.auth-screen {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px;
  box-sizing: border-box;
}

.auth-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 16px;
  text-align: center;
  padding: 24px 16px;
}

.auth-logo {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.5px;
}

.auth-tagline {
  font-size: 12px;
  color: var(--text-dim);
  margin: 0;
}

.auth-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border);
}

.auth-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

/* Google Sign-In Button */

.btn-google {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  font-family: inherit;
}

.btn-google:hover {
  background: var(--surface-hover, #2a2a2a);
  border-color: var(--text-dim);
}

.google-icon {
  flex-shrink: 0;
}

/* Premium Badge */

.premium-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.premium-badge.locked {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-dim);
  border: 1px solid var(--border);
}

.premium-badge.active {
  background: linear-gradient(135deg, #f5c842, #e6a817);
  color: #1a1a1a;
}

/* Upsell Screen */

.upsell-text {
  font-size: 13px;
  color: var(--text-dim);
  margin: 0;
}

.upsell-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 220px;
}

.upsell-features li {
  font-size: 12px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.upsell-features li::before {
  content: "\2713";
  color: #4caf50;
  font-weight: 700;
  flex-shrink: 0;
}

/* Text Button */

.btn-text {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 11px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  transition: color 0.15s;
}

.btn-text:hover {
  color: var(--text);
}

/* User Bar (top of dashboard when logged in) */

.user-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.user-bar-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}

.user-bar-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-bar .btn-icon {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  line-height: 1;
  transition: color 0.15s;
}

.user-bar .btn-icon:hover {
  color: var(--text);
}

.user-bar .btn-text {
  font-size: 11px;
}
```

- [ ] **Step 2: Verify CSS is syntactically valid**

Run: `cd F:\code\app\extension\perchance_pro\ext && bun -e "const c=require('fs').readFileSync('src/sidebar/sidebar.css','utf8'); const opens=(c.match(/\{/g)||[]).length; const closes=(c.match(/\}/g)||[]).length; console.log('braces:', opens, 'open', closes, 'close', opens===closes?'OK':'MISMATCH')"`
Expected: `braces: N open N close OK`

- [ ] **Step 3: Commit**

```bash
git add ext/src/sidebar/sidebar.css
git commit -m "feat: add auth screen styles"
```

---

### Task 10: Add Auth Gate Logic to Sidebar TypeScript

**Files:**
- Modify: `ext/src/sidebar/sidebar.ts`

- [ ] **Step 1: Add auth-related DOM refs and types**

After the existing `// ─── DOM refs ───` section (line 65), add:

```typescript
interface AuthUser {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoURL: string;
}

interface AuthState {
  user: AuthUser | null;
  premium: boolean;
}
```

- [ ] **Step 2: Add auth initialization in DOMContentLoaded**

In the `DOMContentLoaded` listener (line 78), add auth check before the existing `initTabs()` call:

```typescript
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  initTabs();
  initDashboardActions();
  initSettingsForm();
  initLogActions();
  initImportExport();
  loadSettings();

  chrome.runtime.sendMessage({ action: 'GET_STATE' }, (state: AppState) => {
    if (state) {
      cachedState = state;
      renderAll(state);
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'STATE_UPDATED') {
      cachedState = msg.state as AppState;
      renderAll(msg.state as AppState);
    }
  });
});
```

- [ ] **Step 3: Add initAuth function**

Add after the `// ─── Init ───` section comment, before the `initTabs` function:

```typescript
async function initAuth(): Promise<void> {
  const authState = await new Promise<AuthState>((resolve) => {
    chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' }, (response: AuthState) => {
      resolve(response ?? { user: null, premium: false });
    });
  });

  showAuthScreen(authState);

  const loginBtn = document.getElementById('btn-google-signin');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleGoogleSignIn);
  }

  const signOutBtn = document.getElementById('btn-signout');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', handleSignOut);
  }

  const signOutUpsellBtn = document.getElementById('btn-signout-upsell');
  if (signOutUpsellBtn) {
    signOutUpsellBtn.addEventListener('click', handleSignOut);
  }

  const refreshBtn = document.getElementById('btn-refresh-premium');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefreshPremium);
  }
}

function showAuthScreen(authState: AuthState): void {
  const loginScreen = document.getElementById('auth-login');
  const upsellScreen = document.getElementById('auth-upsell');
  const dashboardScreen = document.getElementById('auth-dashboard');

  if (!loginScreen || !upsellScreen || !dashboardScreen) return;

  loginScreen.style.display = 'none';
  upsellScreen.style.display = 'none';
  dashboardScreen.style.display = 'none';

  if (!authState.user) {
    loginScreen.style.display = 'flex';
  } else if (!authState.premium) {
    upsellScreen.style.display = 'flex';
    populateUpsell(authState.user);
  } else {
    dashboardScreen.style.display = 'flex';
    populateUserBar(authState.user);
  }
}

function populateUpsell(user: AuthUser): void {
  const avatar = document.getElementById('upsell-avatar') as HTMLImageElement | null;
  const name = document.getElementById('upsell-name');
  if (avatar && user.photoURL) {
    avatar.src = user.photoURL;
    avatar.style.display = 'block';
  }
  if (name) {
    name.textContent = user.displayName || user.email;
  }
}

function populateUserBar(user: AuthUser): void {
  const avatar = document.getElementById('user-avatar') as HTMLImageElement | null;
  const name = document.getElementById('user-name');
  if (avatar && user.photoURL) {
    avatar.src = user.photoURL;
  }
  if (name) {
    name.textContent = user.displayName || user.email;
  }
}

async function handleGoogleSignIn(): Promise<void> {
  const btn = document.getElementById('btn-google-signin') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Signing in...';
  }

  const authState = await new Promise<AuthState>((resolve) => {
    chrome.runtime.sendMessage({ action: 'GOOGLE_SIGN_IN' }, (response: AuthState) => {
      resolve(response ?? { user: null, premium: false });
    });
  });

  showAuthScreen(authState);

  if (!authState.user) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Sign in with Google';
    }
  }
}

async function handleSignOut(): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ action: 'SIGN_OUT' }, () => resolve());
  });

  showAuthScreen({ user: null, premium: false });
}

async function handleRefreshPremium(): Promise<void> {
  const btn = document.getElementById('btn-refresh-premium') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  const result = await new Promise<{ premium: boolean }>((resolve) => {
    chrome.runtime.sendMessage({ action: 'REFRESH_PREMIUM' }, (response) => {
      resolve(response ?? { premium: false });
    });
  });

  if (btn) btn.disabled = false;

  const authState = await new Promise<AuthState>((resolve) => {
    chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' }, (response: AuthState) => {
      resolve(response ?? { user: null, premium: false });
    });
  });

  showAuthScreen(authState);
}
```

- [ ] **Step 4: Verify build compiles**

Run: `cd F:\code\app\extension\perchance_pro\ext && bun build src/sidebar/sidebar.ts --outdir /dev/null 2>&1 | head -10`
Expected: No compilation errors

- [ ] **Step 5: Commit**

```bash
git add ext/src/sidebar/sidebar.ts
git commit -m "feat: add auth gate logic to sidebar"
```

---

### Task 11: Build and Load Extension for Testing

**Files:**
- None (build + manual test)

- [ ] **Step 1: Build the extension**

Run: `cd F:\code\app\extension\perchance_pro\ext && bun run build`
Expected: Build completes without errors, `dist/` folder updated

- [ ] **Step 2: Load in Chrome**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder
5. Note the extension ID from the URL bar

- [ ] **Step 3: Update OAuth redirect URI**

Update `ext/src/auth/auth-manager.ts` line 87 with your actual extension ID:

```typescript
const clientId = 'YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com';
```

Also update `ext/src/auth/firebase-config.ts` with your actual Firebase config.

Rebuild: `bun run build`

- [ ] **Step 4: Test sign-in flow**

1. Click extension icon to open sidebar
2. Verify login screen appears with "Sign in with Google" button
3. Click the button
4. Google OAuth popup should appear
5. Sign in with a Google account
6. After sign-in, verify you see either upsell or dashboard (depending on Firestore `users/{uid}.premium` value)

- [ ] **Step 5: Test upsell screen**

If user is not premium in Firestore:
1. Verify upsell screen shows avatar, name, "Premium Required" badge
2. Verify feature list is displayed
3. Click "Sign out" — should return to login screen

- [ ] **Step 6: Test dashboard screen**

Set `premium: true` in Firestore for your user, then:
1. Sign in again
2. Verify dashboard shows with user bar at top
3. Verify avatar, name, premium badge, refresh button, sign out button
4. Verify existing extension functionality works (prompts, workers, etc.)

- [ ] **Step 7: Test refresh premium**

1. While on dashboard, change `premium` field in Firestore
2. Click refresh button in user bar
3. Verify UI updates (should show upsell if premium changed to false)

- [ ] **Step 8: Test persistence**

1. Sign in
2. Close sidebar panel
3. Reopen sidebar
4. Verify still signed in (no login screen)

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat: firebase auth + premium gating complete"
```
