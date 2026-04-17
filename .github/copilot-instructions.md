# Copilot Instructions — GoesPay

## Project Overview

GoesPay is a mobile money wallet app targeting West Africa (UEMOA zone). It supports deposits, transfers, withdrawals, and crypto transactions via mobile money operators (MTN, Moov, Orange, Wave, T-Money) and card payments.

**Stack:** Expo SDK 54 + React Native 0.81 + TypeScript (strict) + expo-router (file-based routing).

## Commands

```bash
npx expo start          # Start dev server
npx expo start --web    # Start web version
eas build --profile preview --platform android  # Build preview APK
```

There are no test or lint scripts configured.

## Architecture

### Routing (expo-router, file-based)

- `app/_layout.tsx` — Root layout: loads fonts, handles auth guard, PIN lock flow, push notification setup, API connectivity check
- `app/(auth)/` — Unauthenticated screens: login, register, forgot-password, activation (email verify), setup-pin, unlock
- `app/(tabs)/` — Main authenticated tabs (home, history, support)
- `app/transaction/{deposit,transfer,withdraw,crypto}/[id]` — Transaction detail screens
- `app/account.tsx` — Profile, settings, saved phones/wallets, biometric toggle, language, theme
- `app/kyc.tsx` — Identity verification (document + selfie upload)

### State Management (Zustand)

All stores live in `src/stores/`. Each is a standalone Zustand store (no providers needed):

- `authStore` — Auth state, token management, login/logout. Uses `SafeStorage` for tokens and `AsyncStorage` for cached user data.
- `walletStore` — Balance and transaction history with pagination and offline cache.
- `pinStore` — PIN lock/unlock and biometric auth flow.
- `cryptoStore` — Crypto buy/sell state. Supported: BTC, ETH, TRX, USDT, LTC, BNB, BUSD. Live rates with 1-minute cache.
- `themeStore` — Dark/light/system theme preference.
- `alertStore` — Global alert system. Use `showAlert()` as a drop-in replacement for `Alert.alert`.

### API Layer

- `src/services/api.ts` — Axios instance with Bearer token injection and auto-logout on 401. Base URL configured in `src/constants/config.ts`.
- `src/services/walletService.ts` — Wallet endpoints. Handles multiple Laravel response envelope formats (`{ data }`, `{ data: { data } }`, raw array).
- `src/services/authService.ts` — Auth endpoints (login, 2FA, register, email verification, password reset, profile, avatar upload, KYC document upload).
- `src/services/secureAuthService.ts` — Biometric/PIN credential storage.
- `src/services/notificationService.ts` — Push permissions, token registration, deep linking on notification tap.

Backend API base path: `/api/mobile/v1`

### Backend (October CMS)

- **Stack:** October CMS 3.x + Laravel — repo `/Dev/2025/goespay`
- **Toute l'API mobile** est dans un seul fichier : `plugins/lightlab/goes/routes/api_mobile.php` (~2300 lignes), chargé par `Plugin.php` au boot.
- **Authentification** : token custom (pas Sanctum) — `bin2hex(random_bytes(32))`, hash SHA-256 stocké dans `lightlab_goes_api_tokens`. Middleware `AuthMiddleware.php` injecte `_api_user_id`.

**Plugins October CMS :**

| Plugin | Rôle |
|---|---|
| `lightlab/goes` | Plugin principal : API, auth, wallet, crypto, notifs, 2FA |
| `lightlab/deposit` | Dépôts — table `lightlab_deposit_wallets` |
| `lightlab/buy` | Crypto, transferts, retraits — tables `cryptos`, `transfers`, `withdraws`, `buys` |
| `lightlab/validation` | KYC — table `validations` |
| `rainlab/user` | Utilisateurs base (`users`, étendu avec 2FA) |

**Correspondance types TS ↔ tables backend :**

| Type TS | Table(s) backend |
|---|---|
| `User` | `users` — `name`→`first_name`, `surname`→`last_name` |
| `Transaction` | Union de 4 tables : `lightlab_deposit_wallets`, `lightlab_buy_withdraws`, `lightlab_buy_transfers`, `lightlab_buy_cryptos` |
| `SavedPhone` | `lightlab_goes_user_phones` |
| `SavedWallet` | `lightlab_goes_user_wallets` |

**Passerelles de paiement :**
- **PayDunya** — mobile money UEMOA (Softpay), retraits (Disburse), carte (Checkout)
- **KKiaPay** — dépôts Bénin, CI, Nigeria
- **PayCI** — dépôts CI alternatif
- **CoinPayments** — crypto (BTC, ETH, LTC, TRX, BNB)
- **Perfect Money / Payeer** — stablecoins
- Les callbacks paiement sont dans `routes.php` (pas `api_mobile.php`)

**Routes API publiques :** `GET /ping`, `POST /auth/login`, `/auth/2fa-verify`, `/auth/register`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/logout`

**Routes protégées (Bearer) :** `GET|PUT /me`, `POST /me/avatar`, `POST /me/kyc`, `GET /wallet/balance`, `GET /wallet/history`, `POST /deposit/init`, `GET /deposit/status/{id}`, `POST /transfer`, `GET /crypto/rates`, `POST /crypto/buy`, `/crypto/sell`, CRUD `/user/phones`, `/user/wallets`, `POST /notifications/register`, gestion 2FA

**Push notifications :** envoyées via Expo Push API directement depuis `PushNotification.php`. Deeplinks dans les mails : `goespay:///transaction/deposit/{{ depo }}`

### Storage

- `SafeStorage` (`src/services/storage.ts`) — Abstraction: `expo-secure-store` on mobile, `localStorage` on web. Use for sensitive data (tokens, credentials).
- `AsyncStorage` — Use for non-sensitive cached data (user profile, transactions, preferences).

## Key Conventions

### Theming

Styles are theme-aware via a factory pattern:

```tsx
const styles = useThemedStyles(createStyles);
// ...
const createStyles = (Colors: ColorPalette) => StyleSheet.create({ ... });
```

Use design tokens from `src/constants/theme.ts`: `Colors`, `Spacing`, `BorderRadius`, `FontSize`, `Fonts`, `Shadow`. Never hardcode colors in components.

### Internationalization (i18n)

- Uses `react-i18next` with `expo-localization`. Supported: French (default), English.
- Translation files: `src/i18n/locales/fr.json`, `en.json`
- All user-facing strings must use `t('key')` from `useTranslation()`.
- Language is auto-detected from device, persisted in `SafeStorage`.

### Font

Quicksand is the global font (patched onto `Text.defaultProps` in root layout). Use `Fonts.regular`, `Fonts.medium`, `Fonts.semiBold`, `Fonts.bold` constants.

### Alerts

Use `showAlert(title, message, buttons?, type?)` instead of `Alert.alert`. Type is auto-detected from title keywords (French: "erreur", "succès", "requis").

### Platform Handling

The app runs on Android, iOS, and web. PIN lock and biometric auth are skipped on web (`Platform.OS === 'web'`). Storage falls back to `localStorage` on web.

### Types

Shared types in `src/types/index.ts`. Key ones: `User`, `Transaction`, `PaginatedResponse<T>`, `LoginRequest/Response`, `DepositRequest`, `TransferRequest`.

### Mobile Operators

Operator list is defined in `src/constants/config.ts` (`OPERATORS`). Each entry has: `id`, `name`, `flag`, `country` (ISO), `withdraw` (boolean), `logo` (require'd image).

### Code Language

Comments and some hardcoded UI strings are in **French**. Translation keys and variable names are in English.

### Formatting Utilities

- `src/utils/format.ts` — `formatAmount()` (French locale, e.g. `1 234,56`), `formatDate()` (DD/MM/YYYY HH:MM)
- `src/utils/receipt.ts` — Receipt generation and printing via `expo-print` / `expo-sharing`
- `src/hooks/useResponsive.ts` — Breakpoint detection: mobile, tablet, desktop

### Countries Data

`src/constants/countries.ts` contains 250+ countries with phone codes. Target markets: Bénin, Burkina Faso, Côte d'Ivoire, Guinée-Bissau, Mali, Niger, Sénégal, Togo.
