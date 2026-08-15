# Razorpay Freemium + Shared Website Design

## Overview

Make **Perchance Pro** a freemium Chrome extension by adding a Razorpay payment flow (replicating the proven Auto Perchance flow), and turn the existing Auto Perchance website into a shared two-product landing page that shows both extensions (normal + pro) with a shared checkout page.

## Decisions

- **Backend**: One shared website/frontend. A **new, separate Vercel backend** for Perchance Pro (`perchance-pro.vercel.app`) using the `perchance-pro` Firebase project. The existing Auto Perchance backend stays **unchanged**.
- **Razorpay**: One shared Razorpay account. Two webhook URLs (Razorpay supports up to 30 per account), one per backend. Every order carries `notes.app` (`auto_perchance` / `perchance_pro`); each webhook only processes its own app's payments as a safety net.
- **Premium unlock (pro extension)**: Webhook sets **custom claims** (instant unlock) **and** writes Firestore `users/{uid}.premium = true` (existing field the extension reads). Custom claims checked first, Firestore as fallback.
- **Free tier**: Free users get a daily quota (50 prompts/day, max 10 prompts per batch) tracked in `chrome.storage.local` `usageTracker` — same model as Auto Perchance. Premium removes limits.
- **Purchases are separate per extension**: Lifetime on one does not unlock the other.
- **Pricing**: Identical to Auto Perchance — monthly $4.99, lifetime $25 (USD), INR conversion via live exchange rate.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  SHARED WEBSITE (auto-perchance.vercel.app)                   │
│  index.html   — two-product layout (Free vs Pro)              │
│  upgrade.html — shared checkout, ?app= routes API calls       │
│  privacy.html / terms.html                                    │
└───────────┬──────────────────────────────┬────────────────────┘
            │ app=auto_perchance          │ app=perchance_pro
            ▼                              ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ auto_perchance backend      │  │ NEW perchance_pro backend    │
│ (existing, UNCHANGED)       │  │ (perchance-pro.vercel.app)   │
│ /api/createOrder, webhook,  │  │ /api/createOrder, webhook,   │
│   status, pricing           │  │   status, pricing            │
│ Firebase: auto-perchance-f19aa │  │ Firebase: perchance-pro     │
└───────────┬─────────────────┘  └───────────┬─────────────────┘
            │ one Razorpay account           │
            ▼ (2 webhook URLs)               ▼
┌──────────────────────────────────────────────────────────────┐
│  RAZORPAY — 1 account                                         │
│  webhook URL 1 → auto_perchance webhook                       │
│  webhook URL 2 → perchance_pro webhook                        │
│  every order tagged notes.app = which extension               │
└──────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. New Perchance Pro backend (`perchance_pro/backend/`)

New Vercel project. Mirrors `auto_perchance/backend/` but targets the `perchance-pro` Firebase project.

```
backend/
├── package.json            # firebase-admin, razorpay, dotenv, node-fetch
├── .env.example
├── .gitignore
├── api/
│   ├── createOrder.js
│   ├── webhook.js
│   ├── status.js
│   └── pricing.js
└── utils/
    ├── firebaseAdmin.js    # initializes with perchance-pro service account
    └── pricingData.js      # same pricing as auto_perchance
```

- **`api/createOrder.js`**: `POST`. CORS enabled. Verifies Firebase ID token (perchance-pro) via `admin.auth().verifyIdToken`. Creates Razorpay order with `notes: { uid, email, plan, description, app: "perchance_pro" }`. Amount from pricing data, currency USD/INR. Returns order + `prefill_email`.
- **`api/webhook.js`**: `POST` with `bodyParser: false`. Verifies `x-razorpay-signature` HMAC-SHA256 against `RAZORPAY_WEBHOOK_SECRET`. On `payment.captured` / `order.paid`, ignores unless `notes.app === "perchance_pro"`. Extracts uid, plan, paymentId, orderId, amount, currency. Then:
  1. Sets custom claims: `{ premium: true, plan, planActivatedAt: Date.now() }`.
  2. Upserts Firestore `users/{uid}` with `{ uid, userEmail, paymentEmail, premium: true, isPremium: true, plan, updatedAt, lifetimePurchasedAt | monthlyStartedAt }`.
  3. Appends `transactions/{paymentId}` record.
  Firestore write failures are logged but do not fail the webhook (claims already activated the account).
- **`api/status.js`**: `GET`. Verifies token. Returns `{ isPremium, plan }`. For `monthly` plan, expires after 30 days from `monthlyStartedAt` and syncs Firestore + claims to premium:false.
- **`api/pricing.js`**: `GET`. Returns pricing data + `razorpayKey`.
- **`utils/firebaseAdmin.js`**: reads `FIREBASE_SERVICE_ACCOUNT` env (JSON, trimmed, backticks stripped), initializes `firebase-admin` with cert. Must log project id on init.
- **`utils/pricingData.js`**: BASE_PRICES monthly 4.99 / lifetime 25 USD, `open.er-api.com` exchange rate with fallback 84.0. Same shape as auto_perchance.

**Env vars**: `FIREBASE_SERVICE_ACCOUNT`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

### 2. Shared website changes (`auto_perchance/backend/public/`)

**`index.html`** — two-product layout:
- Nav keeps brand; add "Pro" awareness (install/upgrade CTAs stay).
- Hero: two product cards side-by-side — **Auto Perchance** (free install) and **Perchance Pro** (freemium: install + upgrade).
- Features grouped per product. Pro features: per-prompt negatives, per-prompt skip, multi-worker, custom filenames & folders, live dashboard.
- Shared pricing section (monthly $4.99 / lifetime $25, INR toggle). Each plan card has two buttons: "Unlock Auto Perchance" → `upgrade.html?app=auto_perchance`, "Unlock Perchance Pro" → `upgrade.html?app=perchance_pro`.
- FAQ / developer / footer unchanged.
- Add `perchance_pro_logo.png` asset.

**`upgrade.html`** — shared checkout driven by `?app=`:
- `app=perchance_pro` → API base `https://perchance-pro.vercel.app`, product name "Perchance Pro", pro logo, pro install link.
- no param / `app=auto_perchance` → same-origin `/api/*`, current Auto Perchance behavior.
- `initPricing()`, `setupBtn()`, `checkUserStatus()` use the resolved API base for `/api/pricing`, `/api/createOrder`, `/api/status`.
- Razorpay `name` option dynamic per app.
- Extension feature grid dynamic per app (or shared list with product-specific extras).

### 3. Pro extension changes (`perchance_pro/ext/`)

- **`src/auth/premium-checker.ts`**:
  - `checkPremium(uid)`: check custom claims first via `auth.currentUser.getIdTokenResult(true)` → `claims.premium === true`; fallback to Firestore `users/{uid}` `.premium === true`. Cache in `chrome.storage.local`.
  - Keep `getCachedPremium`, `refreshPremium`.
- **`src/auth/auth-manager.ts`**:
  - On `googleSignIn`, force `getIdToken(true)` so fresh claims are picked up before checking premium.
  - Add `openCheckout()`: `const token = await user.getIdToken(); chrome.tabs.create({ url: 'https://auto-perchance.vercel.app/upgrade.html?app=perchance_pro&token=' + token })`.
- **`src/sidebar/sidebar.html`**:
  - Upsell screen: add "Upgrade to Pro" button (`btn-upgrade-upsell`).
  - Dashboard premium banner: add "Upgrade" button (`btn-upgrade-banner`); banner text updated for free-tier messaging.
  - Add free quota display (e.g., "Free: N prompts left today").
- **`src/sidebar/sidebar.ts`**:
  - Wire upgrade buttons → `openCheckout()`.
  - On start: if not premium, enforce free limits (max 10 prompts/batch, 50/day) using `usageTracker`; show status messages; otherwise send START.
  - Render free quota remaining.
- **`src/background/background.ts`**:
  - START handler: remove hard `blocked: 'Premium required'` gate. Allow free-tier runs; read premium from `authState` and/or START message `isPremium`.
  - Track `usageTracker` (`{date, count}`) in `chrome.storage.local`; increment per completed prompt when not premium (mirror auto_perchance background).
- **`manifest.json`**: no permission changes needed.

### 4. Manual setup (user, outside code)

1. Razorpay dashboard → Settings → Webhooks → add 2nd webhook URL `https://perchance-pro.vercel.app/api/webhook`, events `payment.captured` + `order.paid`, generate its own webhook secret.
2. Vercel → new project from `perchance_pro/backend/` → env vars: `FIREBASE_SERVICE_ACCOUNT` (perchance-pro service account JSON), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
3. Keep auto_perchance backend/website deployed as-is (updated files pushed to its existing Vercel project).

## Security

- Webhook HMAC-SHA256 signature verification with the app-specific secret.
- `notes.app` filter — each webhook only processes its own extension's payments.
- `createOrder`/`status` verify the Firebase ID token against the correct project (a `perchance-pro` token fails on the auto_perchance backend and vice versa).
- Firestore rules unchanged: read own doc only, writes only via Admin SDK (webhook).
- Razorpay key id exposed to client (standard, non-secret); key secret / webhook secret / service account stay server-side only.

## Error Handling

- Webhook: Firestore write failure does not fail the webhook (custom claims already activated).
- Webhook: missing uid / wrong app → logged and ignored with 200.
- createOrder: missing env keys → 500 misconfiguration; invalid token → 401.
- Pricing API failure in upgrade.html → static fallback prices.
- Payment failure in checkout → `payment.failed` handler shows error card.
- Geo-detection failure → payment notice silently hidden (existing behavior).

## Testing

- Backend (curl): createOrder with valid/invalid token; webhook with tampered signature (400); status for non-premium, monthly, expired monthly.
- Extension: build (`bun run build`), load unpacked, sign in; verify free quota (10/batch, 50/day); upgrade button opens checkout with app=perchance_pro; Razorpay test-mode payment → custom claims + Firestore premium → instant unlock.
- Website: both product cards render; upgrade.html routes to correct API base per `?app=`.

## Out of Scope

- Cross-extension lifetime entitlement (purchases remain per-extension).
- Recurring Razorpay subscriptions (monthly is a 30-day one-time order + expiry, same as auto_perchance).
- Real-time quota enforcement server-side (client-side only, same as auto_perchance).
