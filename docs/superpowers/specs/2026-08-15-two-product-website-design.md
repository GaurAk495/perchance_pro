# Shared Two-Product Website Design

## Overview

Rebuild the shared frontend (deployed at `https://auto-perchance.vercel.app/`) into a two-product marketing site using the existing Auto Perchance landing page as the visual foundation. The site shows both products — **Auto Perchance** (classic, free) and **Auto Perchance Pro** (flagship, freemium) — with a Free-vs-Premium comparison focused on Pro, and a shared checkout page that routes to the correct backend based on `?app=`. The primary goal is converting visitors to buy the paid version of Auto Perchance Pro.

## Decisions

- **Visual identity**: Reuse the existing site exactly — dark `#050a10` background, particle canvas, Inter font, blue `#38bdf8` + gold `#f59e0b` accents, 16px rounded glass cards.
- **Product naming**: Pro product is branded **Auto Perchance Pro** on the site (the extension manifest still says "Perchance Pro"; renaming the extension is a separate task).
- **Positioning**: Auto Perchance Pro is the flagship — gold "Recommended" badge, primary CTAs point to it.
- **Pricing is per product**:
  - Auto Perchance Pro: monthly `$7`, lifetime `$40` (already in `backend/utils/pricingData.js`).
  - Auto Perchance: monthly `$4.99`, lifetime `$25` (served by its own unchanged backend).
  - Shared checkout fetches pricing from the correct backend per `?app=`.
- **Pro install link**: No Chrome Web Store listing yet — install CTAs use a clearly-marked placeholder config value for easy swap later.
- **Architecture**: Plain static HTML/CSS/JS (no framework, no build step), matching the existing site. Vercel static hosting.
- **Scope**: Rebuild `index.html` and `upgrade.html`; add `perchance-pro.html` and `auto-perchance.html`; add shared `assets/styles.css`, `assets/site.js`, and `assets/auto_perchance_pro_logo.png` (copied from `ext/public/icon128.png`). Leave `privacy.html` / `terms.html` content unchanged. Backend API code (`api/*`) and extension code are out of scope.

## Architecture

```
backend/public/                      (deployed to auto-perchance.vercel.app)
├── index.html          Landing — both products, benefits, comparison, pricing
├── perchance-pro.html  Auto Perchance Pro deep-dive + pricing + upgrade CTA
├── auto-perchance.html Auto Perchance deep-dive + pricing + install
├── upgrade.html        Shared checkout driven by ?app= (auto_perchance | perchance_pro)
├── privacy.html        unchanged
├── terms.html          unchanged
├── assets/
│   ├── styles.css      shared design system (nav, buttons, cards, tables, footer, particles)
│   ├── site.js         shared behavior (particles canvas, FAQ accordion, nav shadow)
│   └── auto_perchance_pro_logo.png
```

Backend routing from `upgrade.html`:

```
upgrade.html?app=perchance_pro   → API base https://perchance-pro.vercel.app/api/*
upgrade.html (no app / auto_perchance) → API base same-origin /api/*
```

## Component Details

### 1. Shared assets

- **`assets/styles.css`**: Extract the current inline `<style>` from `index.html` into a shared stylesheet, plus new components:
  - `.product-card` + `.product-card.featured` — two-product hero cards; featured has gold border/badge.
  - `.recommended-badge` — gold "Recommended" pill.
  - `.compare-table` — Free vs Premium comparison table (rows with ✓ / ✗ / value pairs, highlighted Premium column, CTA row).
  - `.price-row` — per-product pricing rows with two "Unlock" buttons.
  - Reused: nav, hero, buttons (`.btn-primary`, `.btn-ghost`), cards, feature grid, steps, use cases, FAQ, dev card, CTA banner, footer, telegram FAB, responsive rules.
- **`assets/site.js`**: Extract the existing inline scripts (background particles, FAQ accordion, scroll-based nav shadow) into one shared script. Runs on all pages; guards for elements that may not exist.
- **`assets/auto_perchance_pro_logo.png`**: Copy `ext/public/icon128.png`.

### 2. `index.html` — Landing page

1. **Navbar**: brand + logo → `/`, links: Products, Pricing, FAQ; CTA "Install Auto Perchance Pro" (placeholder) + "Upgrade".
2. **Hero**: badge "Two tools. One workflow." headline, sub-copy, and two product cards:
   - **Auto Perchance** — "Simple, free automation" — install via real Chrome Web Store link (`aepjemnnfffjloeidiijcpiopapaddhh`). Short feature bullets. CTA "Install Free".
   - **Auto Perchance Pro** — "Recommended" gold badge — "Freemium power tools for creators" — install free (placeholder) + "Upgrade to Premium" (`upgrade.html?app=perchance_pro`). Feature bullets: multi-worker, per-prompt negatives, art-style mix, unlimited potential.
3. **Stats bar**: e.g. images/batch, manual clicks, workers, free to install.
4. **Why Pro** — benefit cards: Multi-worker parallel speed, Per-prompt control (negatives + skip), Art-style mix & shape, No limits (Premium).
5. **Comparison — Free vs Premium (Pro)** — the conversion centerpiece. Columns: Feature | Free | Premium. Rows:
   - Daily prompt quota: 50/day → Unlimited
   - Max prompts per batch: 10 → Unlimited
   - Per-prompt negative prompts: ✓ → ✓
   - Per-prompt skip / disable: ✓ → ✓
   - Multi-worker parallel: 1 → Up to 6
   - Art style mix & shape: ✓ → ✓
   - Custom filename patterns & folders: ✓ → ✓
   - Import prompts (TXT/CSV): ✓ → ✓
   - Priority support: ✗ → ✓
   - CTA row → "Upgrade to Premium" button (`upgrade.html?app=perchance_pro`).
6. **Products** — two cards linking to `perchance-pro.html` and `auto-perchance.html` ("Explore Auto Perchance Pro →" / "Explore Auto Perchance →").
7. **Use cases** — reuse existing grid (artists, writers, social creators, print-on-demand, game devs, researchers).
8. **Pricing** — shared section with per-product prices:
   - Auto Perchance Pro: $7/mo, $40 lifetime → "Unlock Auto Perchance Pro" → `upgrade.html?app=perchance_pro`.
   - Auto Perchance: $4.99/mo, $25 lifetime → "Unlock Auto Perchance" → `upgrade.html?app=auto_perchance`.
   - Payment methods note (PayPal / Razorpay UPI) kept.
9. **FAQ** — updated for both products + shared checkout (what each product does, how to install each, free vs premium, payment methods, cross-product purchases are separate).
10. **Developer card, CTA banner, footer** — reused with updated links.

SEO: update title/description/keywords/OG/JSON-LD to cover both products (Pro flagship). Keep `SoftwareApplication` + `FAQPage` structured data.

### 3. `perchance-pro.html` — Auto Perchance Pro product page

- Hero: Pro logo, "Auto Perchance Pro", tagline, CTAs: "Install Free" (placeholder) + "Upgrade to Premium".
- Feature deep-dive grid (from the extension): Batch prompt automation, Per-prompt negative prompts, Per-prompt skip/disable, Multi-worker parallel generation (up to 6), Art style + style mix + shape controls, Global negative prompt, Prefix/suffix enhancers, Custom filename patterns, Per-prompt folders, TXT/CSV import, Live stats & logs, Pause/Resume/Stop.
- "How it works" steps (install, open Perchance + side panel, paste prompts & start).
- Free vs Premium comparison table (same as landing).
- Pricing: $7/mo / $40 lifetime → upgrade CTA (`upgrade.html?app=perchance_pro`).
- FAQ subset, link back to landing.

### 4. `auto-perchance.html` — Auto Perchance product page

- Mirrors existing index.html content (features, how-it-works, use cases) for the classic extension.
- Pricing: $4.99/mo / $25 lifetime → upgrade CTA (`upgrade.html?app=auto_perchance`).
- Real Chrome Web Store install link.
- FAQ subset, link back to landing.

### 5. `upgrade.html` — shared checkout

- Top-of-file `APPS` config object:
  ```
  {
    auto_perchance: { apiBase: '/api', productName: 'Auto Perchance', logo: 'auto_perchance_logo.png', installUrl: 'https://chromewebstore.google.com/detail/perchance-automation-auto/aepjemnnfffjloeidiijcpiopapaddhh' },
    perchance_pro:  { apiBase: 'https://perchance-pro.vercel.app/api', productName: 'Auto Perchance Pro', logo: 'auto_perchance_pro_logo.png', installUrl: '' } // TODO store url
  }
  ```
- `app` param resolution: `perchance_pro` → pro config; anything else → auto_perchance.
- All API calls (`/api/pricing`, `/api/createOrder`, `/api/status`) use `apiBase`.
- Dynamic: Razorpay `name`, extension logo/title/feature grid, fallback static prices per product (Pro $7/$40, Auto Perchance $4.99/$25).
- Keeps existing behavior: token from `?token=`, plan status card, currency toggle (USD/INR), geo payment notice, Razorpay checkout, success/error cards, FAQ, support banner.
- Replace the `name: "Auto Perchance"` literal in Razorpay init with `app.productName`.

## Security

- No new secrets on the frontend. API keys/tokens passed via `?token=` as today (Bearer header on API calls).
- `apiBase` for pro is cross-origin — all of `pricing.js`, `createOrder.js`, `status.js` already set `Access-Control-Allow-Origin: *` (with credentials) and allow the `Authorization` header, so the shared checkout at `auto-perchance.vercel.app` can call `perchance-pro.vercel.app/api/*` without changes.
- No payment handling client-side beyond the existing Razorpay checkout invocation.

## Error Handling

- Pricing fetch failure → static fallback prices per product (as today).
- Geo detection failure → payment notice hidden (as today).
- Payment failure → `payment.failed` shows error card (as today).
- Placeholder install URL for Pro → clicking shows a "Coming soon" notice (small inline script) instead of a dead link.

## Testing

- Open all 4 pages locally; verify shared nav/footer/particles work on each.
- Verify comparison table renders and is responsive (<640px stacks).
- `upgrade.html` without `?app=` behaves as Auto Perchance (same-origin API). With `?app=perchance_pro` routes to `https://perchance-pro.vercel.app/api/*`, shows "Auto Perchance Pro" branding and $7/$40.
- Verify placeholder install link shows "Coming soon".
- Confirm JSON-LD/SEO meta present on index.html.

## Out of Scope

- Renaming the extension from "Perchance Pro" to "Auto Perchance Pro" (manifest, sidebar, store listing).
- Fixing the merge-conflict markers in `ext/src/sidebar/sidebar.ts` (lines ~663-689).
- Backend API changes (`api/*`), webhook, Firestore, extension quota logic.
- Auto Perchance backend changes (unchanged, serves its own `/api/*`).
