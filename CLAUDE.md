# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GoesPay is a multi-currency wallet for West/Central Africa: Mobile Money deposits/withdrawals/transfers + crypto buy/sell. It's an Expo / React Native app (iOS, Android, and PWA web) that talks to an OctoberCMS backend (plugin `lightlab/goes`) via a REST API. This repo is the **frontend only**; the backend lives in a separate project.

## Commands

```bash
npm start              # expo start (Metro dev server)
npm run android        # expo run:android (native build)
npm run ios            # expo run:ios
npm run web            # expo start --web

npx tsc --noEmit       # typecheck (strict mode; no separate lint/test setup)
npx expo export --platform web   # production web build → dist/ (used by CI)
```

There is **no test runner and no linter configured** — `tsc` is the only static check. EAS Build (`eas.json`) produces APK/AAB binaries; web is auto-deployed.

## Deployment

- **Web (PWA):** the GitHub Action is **disabled** (`.github/workflows/deploy-web.yml.disabled`). Deploys now go through **`deploy.sh`** (DeployByLight) — incremental FTP upload of changed files (diff since `.deploy-last`), respecting `.gitignore`, driven by a git **pre-push hook** (FTP creds live in `.env`, never committed). Build the web bundle with `npx expo export --platform web` → `dist/` before deploying. The web app is served at `goespay.io` (API on the same host; when the front is hosted at `app.goespay.io` it's cross-origin to the `goespay.io` API — see nginx CORS).
- **Mobile:** EAS Build profiles in `eas.json` (`development`, `preview` → internal APK, `production` → auto-incremented AAB).

## Architecture

### Backend connection
- All HTTP goes through `src/services/api.ts` (single axios instance). `API_BASE_URL` is chosen in `src/constants/config.ts`: dev points at a LAN IP / localhost (`__DEV__`), prod at `https://goespay.io/api/mobile/v1`. **When testing on a physical Android device, update the `DEV_API` LAN IP in config.ts.**
- Request interceptor injects `Bearer <auth_token>` (from `SafeStorage`) and `Accept-Language`. Response interceptor auto-logs-out on 401 / suspended-account 403, and tags KYC-block errors (`KYC_EXPIRED` / `KYC_REQUIRED`) onto the error object as `error.kycBlocked` for the UI.
- `checkApiConnection()` (`/ping`) drives the maintenance / offline / connection-error screens in `app/_layout.tsx`. On web, an OctoberCMS BackendUser (cookie `goespay_admin`) bypasses maintenance.
- Service modules wrap endpoints by domain: `authService` (auth, profile, KYC upload, 2FA), `walletService` (balance, history, deposit/transfer/withdraw, **Fincra** payouts/rails/banks/rate, saved phones/wallets, claims), `affiliationService`, `notificationService`, `catalogService` / `corridorService` (`/catalog` referential + routing corridors), `secureAuthService` (credentials/PIN/biometric persistence via `SafeStorage`).

### State (Zustand, in `src/stores/`)
Stores are plain Zustand (no persist middleware) — caching is done manually via `AsyncStorage` / `SafeStorage`:
- `authStore` — user + token, `loadToken()` bootstraps the session (instant cached-user display when "remember me" is on, then background profile refresh). Logout clears token, PIN, biometric method, and credentials.
- `pinStore` — app lock state (`pin` | `biometric`), drives the `setup-pin` / `unlock` routing. **Lock is mobile-only; web is never locked.**
- `configStore` — server-driven feature flags (`deposit_enabled`, etc.) + fees/limits/alerts + admin-managed promo slides (drive the home `PromoCarousel`) from `/config`. Has hardcoded `DEFAULT_APP_CONFIG` fallback for offline. Admin toggles features here.
- `currencyStore` — **XOF is the canonical source of truth**; all display amounts are derived via `convertFromXof` / `formatFromXof`. Fetches rates (`1 XOF = N currency`), cached 12h. Per-currency decimal rules live here.
- `catalogStore` / `corridorStore` — **server-driven catalog (P3)**, fed by `/catalog` (admin "Marchés": normalized countries/currencies/networks + `aggregator_routing` corridors). These progressively replace the hardcoded `OPERATORS`/`COUNTRIES` lists: availability comes from the server, presentation (logos) stays local. `catalogStore` maps server `logo_key` → bundled asset via a static `LOGO_BY_KEY` require() map (Metro requires static requires). `corridorStore` exposes routing helpers (`isPayoutAvailable`, `isCodeEnabled`, `hasEnabledAggregator`, `dialCodeFor`, `networkLabel`). `config.ts` remains the **fallback** until the catalog loads (offline / first render).
- `walletStore`, `cryptoStore`, `fincraRateStore`, `alertStore` (global `showAlert()` + `CustomAlert`), `themeStore`.

### Storage abstraction
`src/services/storage.ts` exports `SafeStorage` — `localStorage` on web, `expo-secure-store` on mobile. Use it for anything sensitive (tokens, PIN, credentials). Non-sensitive caches use `AsyncStorage` directly.

### Navigation (expo-router, file-based in `app/`)
- `app/_layout.tsx` is the gatekeeper: loads fonts, token, PIN state, language, push notifications, API status; then a routing effect redirects between `(auth)`, `setup-pin`/`unlock`, and `(tabs)` based on `isAuthenticated` + lock state. It also handles the Fincra web-redirect deep link (`?reference=FCD-…`) and notification-tap navigation.
- Route groups: `(auth)` (login/register/activation/forgot-password/setup-pin/unlock), `(tabs)` (index/history/affiliation/support), `account/*` (index/profile/security/settings/phones/wallets/bank-accounts), `transaction/{deposit,transfer,withdraw,crypto}/[id]`, `kyc`.
- The home tab (`(tabs)/index.tsx`) is composed from `src/components/home/HomeWidgets.tsx` — exports `PromoCarousel`, `MonthlyInsights`, `RecentBeneficiaries`, `QuickConverter`, `ReferralCard`.
- Display currency: `currencyStore` holds `currencySource: 'auto' | 'manual'` and `setUserCurrency(currency, source)` / `hydrateFromUser(...)` (persists to the user profile + refreshes rates). Currency is currently hydrated from the user's profile/country (`auto`); there is no standalone `account/currency.tsx` picker route.
- `account/phones.tsx` (saved phones) resolves its operator list the **same way as the deposit/withdraw modals**: catalog (`catalogStore.operators`) ∪ `OPERATORS` fallback, filtered by `operatorServesCountry(op, userCountry)` so the picker shows only the user's country (not the full list), and auto-selects when a single operator is available. Use `operatorServesCountry` + `OperatorLogo` rather than re-deriving from raw `OPERATORS`.

### Payment providers
Operators are a hardcoded `OPERATORS` list in `config.ts` (the offline fallback; the server catalog above is the live source), tagged by provider: Softpay/PayDunya (default), `afribapay: true`, or `fincra: true` (there are **no** hardcoded `klasha` operators — Klasha comes from the catalog only). The four gateways (PayDunya, AfribaPay, Fincra, Klasha) are rendered by `src/components/GatewayBadge.tsx` from operator flags (`afribapay`/`fincra`/`klasha`). Key rules in config.ts:
- `isAfribapayDuplicate()` / `getOperatorNetwork()` — a country+network served by both Softpay and AfribaPay shows **only Softpay** (AfribaPay duplicate is hidden).
- Fincra is multi-rail (`mobile_money` | `bank_transfer` | `SWIFT` | `SEPA`) and multi-currency; `FINCRA_ZONES` maps XOF/XAF zones to country pickers + phone prefixes. Fincra phone/account helpers are in `src/utils/fincraPhone.ts`.
- **Klasha** is the 4th aggregator; its per-country availability is **server-driven** via the catalog/corridor routing (no hardcoded Klasha operators in `config.ts` — it's enabled per country from the backend).

### Operator display & receipts
- `src/utils/operatorDisplay.ts` (`resolveOperatorDisplay(mode)`) is the **single resolver** turning a raw payment-mode string (e.g. `fincra-bank_transfer`, `klasha-mm-…`) into a clean `{ name, flag, logo }` (precise operator + rail + catalog lookup, falling back to the raw code). It is shared by history, transaction detail, **and** the PDF receipt (`src/utils/receipt.ts`) / invoice (`src/utils/invoice.ts`) — never re-parse mode strings ad hoc.

### i18n & theming
- `src/i18n/` — i18next with `fr` (default/fallback) + `en`. `initLanguage()` runs at startup, persists choice via `SafeStorage`. **UI strings must go through `t()` and be added to both `fr.json` and `en.json`.**
- Theming via `ThemeProvider` + `useThemedStyles(createStyles)` hook; `createStyles(Colors)` receives the active `DarkColors`/`LightColors` palette from `src/constants/theme.ts`. Font is Quicksand (force-patched globally onto `<Text>` for Android).
- `useResponsive` distinguishes mobile vs desktop web (desktop gets `DesktopHeader`/`DesktopFooter`, `ResponsiveContainer`/`ResponsiveModal`).

## Conventions

- **Language:** respond to the user in French; code, comments, and commit messages in English (existing inline comments are mostly French — match the surrounding file).
- **Git:** commit directly on `main` (no `feat/*` branches unless asked). Never push without explicit per-operation confirmation.
- Production builds strip `console.log` (keeps `error`/`warn`) via `babel.config.js`.
- `.npmrc` sets `legacy-peer-deps=true` — use it when installing.
- Copy-to-clipboard (referral code, crypto address) goes through `expo-clipboard`.
- Large `*.apk` / `*.aab` build artifacts are committed at the repo root; ignore them.
