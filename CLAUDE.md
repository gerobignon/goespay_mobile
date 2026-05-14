# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GoesPay — Mobile money wallet app for West Africa (UEMOA + Cameroon). Deposits, transfers, withdrawals, and crypto transactions via mobile money operators (MTN, Moov, Orange, Wave, T-Money) and card payments. Bilingual (French/English), dark/light themes.

## Commands

```bash
npx expo start              # Dev server (press a for Android, w for web)
npx expo start --web        # Web only
npx tsc --noEmit            # TypeScript check (no test/lint scripts configured)
npx expo export --platform web  # Web production build (output in dist/)

# Android builds (EAS)
eas build --profile preview --platform android --local   # Preview APK
eas build --profile production --platform android --local # Production AAB (Play Store)
```

No test framework is configured. Validate changes with `npx tsc --noEmit`.

## Architecture

**Stack:** Expo SDK 54, React Native 0.81, TypeScript 5.9 (strict), expo-router 6, Zustand 5, Axios, i18next.

### Two Repos

| Repo | Path | Role |
|------|------|------|
| **This repo** (mobile app) | `/Users/gerobignon/Dev/appli/goespay` | Expo/React Native app |
| **Backend** (OctoberCMS) | `/Users/gerobignon/Dev/2025/goespay` | API + admin panel + vitrine |

### Routing (file-based, expo-router)

- `app/_layout.tsx` — Root: fonts, auth guard, PIN lock, push notifications, offline check
- `app/(auth)/` — Login, register, forgot-password, activation, setup-pin, unlock
- `app/(tabs)/` — Home (wallet), history, support
- `app/account/` — Profile, security, settings, phones, wallets, affiliation
- `app/transaction/{deposit,transfer,withdraw,crypto}/[id].tsx` — Transaction details
- `app/kyc.tsx` — Identity verification (document + selfie)

### State (Zustand stores in `src/stores/`)

Standalone stores, no providers. Import and use directly:

- **authStore** — Token in SafeStorage, user in AsyncStorage, auto-logout on 401
- **walletStore** — Balance + paginated history with offline cache
- **pinStore** — PIN lock/unlock + biometric flow (skipped on web)
- **cryptoStore** — Buy/sell crypto, live rates (1-min cache TTL)
- **configStore** — Dynamic config from backend `/config` endpoint (fees, limits, operator lists, feature flags)
- **themeStore** — Dark/light/system
- **alertStore** — Use `showAlert()` instead of `Alert.alert`
- **currencyStore** — Multi-currency (XOF, XAF, CDF, GNF)

### API Layer

- `src/services/api.ts` — Axios instance, Bearer token injection, auto-logout on 401, language header
- `src/constants/config.ts` — API_BASE_URL switches on `__DEV__` + platform; **production always hits `https://goespay.io/api/mobile/v1`**
- Backend response envelopes vary: `{ data }`, `{ data: { data } }`, or raw array — `walletService.ts` handles all three

### Backend (October CMS 4 + Laravel 12)

- **Entire mobile API** in one file: `plugins/lightlab/goes/routes/api_mobile.php` (~3400 lines)
- **Auth**: Custom token (not Sanctum) — `bin2hex(random_bytes(32))`, SHA-256 hash in `lightlab_goes_api_tokens`
- **Config singleton**: `Goes::find(1)` with `$jsonable` fields (`app_config`, `cryptos`)
- **Payment callbacks** are in `routes.php` (not `api_mobile.php`)

**Payment processors:** PayDunya (Mobile Money UEMOA), AfribaPay (multi-country), FedaPay/KKiaPay (Benin), NowPayments (crypto, 5-min sync cron), CoinPayments (crypto legacy)

**TS types ↔ Backend tables:**

| TS Type | Backend Table |
|---------|---------------|
| `User` | `users` (`name`→`first_name`, `surname`→`last_name`) |
| `Transaction` | Union of `lightlab_deposit_wallets`, `lightlab_buy_withdraws`, `lightlab_buy_transfers`, `lightlab_buy_cryptos` |
| `SavedPhone` | `lightlab_goes_user_phones` |
| `SavedWallet` | `lightlab_goes_user_wallets` |

### Mobile Operators

Defined in `src/constants/config.ts` (`OPERATORS`). Two payment gateways with deduplication: PayDunya/Softpay takes precedence; AfribaPay entries flagged with `afribapay: true` for countries not covered by Softpay (Niger, Guinea, Gambia, Chad, Gabon, Congo, DRC).

## Conventions

- **Theming**: `useThemedStyles(createStyles)` factory pattern. Colors from `src/constants/theme.ts`. Never hardcode colors.
- **Font**: Quicksand (use `Fonts.regular`, `Fonts.medium`, `Fonts.semiBold`, `Fonts.bold`)
- **i18n**: All user-facing strings via `t('key')`. Files: `src/i18n/locales/{fr,en}.json`. French is default.
- **Alerts**: `showAlert(title, message, buttons?, type?)` — auto-detects type from French keywords
- **Platform**: PIN/biometric skipped on web. Storage falls back to `localStorage` on web via `SafeStorage` abstraction.
- **Formatting**: `formatAmount()` (French locale: `1 234,56`), `formatDate()` (DD/MM/YYYY HH:MM) from `src/utils/format.ts`
- **Code language**: Variable names in English, comments and UI strings in French. Translation keys in English.
- **Config values**: Fee rates from backend stored as percentages (5 = 5%). Mobile app divides by 100 for calculations.
- **Console**: Production builds strip `console.log` via babel plugin (`babel-plugin-transform-remove-console`). Keep `console.warn`/`console.error` for actual errors.
