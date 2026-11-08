/**
 * Proof that requests come from the official GOESPAY app (server: ClientGate).
 *
 * The server issues a one-time challenge (POST client/challenge); the platform
 * attests it (Play Integrity on Android, App Attest on iOS, Cloudflare
 * Turnstile on the web); POST client/attest trades that proof for a short,
 * signed pass that every API request carries in the `X-Goes-Client` header.
 *
 * The pass is cached (secure store on native) and renewed a few minutes before
 * it expires. Any failure returns null: the request goes out without a pass,
 * which the server tolerates in `report` mode and refuses in `enforce` mode
 * (403 client_unverified, retried once by the api.ts interceptor).
 */
import axios from 'axios';
import { Platform } from 'react-native';
import type * as AppIntegrityModule from '@expo/app-integrity';
import { API_BASE_URL } from '../constants/config';
import { SafeStorage } from './storage';

export const CLIENT_PASS_HEADER = 'X-Goes-Client';

const PASS_STORAGE = 'goes_client_pass';
const IOS_KEY_STORAGE = 'goes_app_attest_key_id';
const RENEW_MARGIN_S = 300;
const RETRY_AFTER_FAILURE_MS = 30_000;

/** API paths that never need a pass (server ClientGate::EXEMPT). */
const EXEMPT_PATHS = ['/ping', '/app-version', '/exchange-rates', '/client/challenge', '/client/attest'];

interface StoredPass {
  pass: string;
  exp: number;
}

interface ChallengeResponse {
  challenge: string;
  mode: 'off' | 'report' | 'enforce';
  android_project: string;
  turnstile_site_key: string;
  turnstile_action: string;
}

// Plain instance: going through `api` would re-enter its interceptors.
const bare = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

let cached: StoredPass | null = null;
let loaded = false;
let inflight: Promise<string | null> | null = null;
let lastFailureAt = 0;
let androidPreparedFor: string | null = null;

/**
 * Native module loaded lazily: a binary built before it was added (dev client,
 * Expo Go) must keep working, just without a pass.
 */
let integrity: typeof AppIntegrityModule | null | undefined;
function nativeIntegrity(): typeof AppIntegrityModule | null {
  if (integrity === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      integrity = require('@expo/app-integrity') as typeof AppIntegrityModule;
    } catch {
      integrity = null;
    }
  }
  return integrity;
}

export function needsClientPass(url: string | undefined): boolean {
  if (!url) return true;
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api\/mobile\/v1/, '').split('?')[0];
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return !EXEMPT_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`));
}

/** Current pass, attesting first if none is valid. Never throws. */
export async function getClientPass(force = false): Promise<string | null> {
  if (!loaded) {
    loaded = true;
    try {
      const raw = await SafeStorage.getItem(PASS_STORAGE);
      if (raw) cached = JSON.parse(raw) as StoredPass;
    } catch {
      cached = null;
    }
  }
  const now = Date.now() / 1000;
  if (!force && cached && cached.exp - RENEW_MARGIN_S > now) {
    return cached.pass;
  }
  if (!force && Date.now() - lastFailureAt < RETRY_AFTER_FAILURE_MS) {
    return null;
  }
  if (!inflight) {
    inflight = attest()
      .catch(() => null)
      .then((pass) => {
        if (!pass) lastFailureAt = Date.now();
        return pass;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function clearClientPass(): Promise<void> {
  cached = null;
  try {
    await SafeStorage.removeItem(PASS_STORAGE);
  } catch {
    // ignore
  }
}

async function attest(): Promise<string | null> {
  const { data: ch } = await bare.post<ChallengeResponse>('/client/challenge');
  if (!ch?.challenge || ch.mode === 'off') return null;

  let body: Record<string, string> | null = null;
  if (Platform.OS === 'android') {
    body = await androidProof(ch);
  } else if (Platform.OS === 'ios') {
    return iosAttest(ch, true);
  } else if (Platform.OS === 'web') {
    body = await webProof(ch);
  }
  if (!body) return null;
  return submit(body);
}

async function submit(body: Record<string, string>): Promise<string | null> {
  const { data } = await bare.post<{ pass: string; expires_at: number }>('/client/attest', body);
  if (!data?.pass) return null;
  cached = { pass: data.pass, exp: data.expires_at };
  try {
    await SafeStorage.setItem(PASS_STORAGE, JSON.stringify(cached));
  } catch {
    // The in-memory pass still works for this session.
  }
  return data.pass;
}

// ─── Android : Play Integrity (standard request) ──────────────────────────

async function androidProof(ch: ChallengeResponse): Promise<Record<string, string> | null> {
  const AppIntegrity = nativeIntegrity();
  if (!ch.android_project || !AppIntegrity) return null;
  if (androidPreparedFor !== ch.android_project) {
    await AppIntegrity.prepareIntegrityTokenProviderAsync(ch.android_project);
    androidPreparedFor = ch.android_project;
  }
  const token = await AppIntegrity.requestIntegrityCheckAsync(ch.challenge);
  return { platform: 'android', challenge: ch.challenge, token };
}

// ─── iOS : App Attest (key attested once, then assertions) ────────────────

async function iosAttest(ch: ChallengeResponse, allowNewKey: boolean): Promise<string | null> {
  const AppIntegrity = nativeIntegrity();
  if (!AppIntegrity || !AppIntegrity.isSupported) return null;
  const keyId = await SafeStorage.getItem(IOS_KEY_STORAGE);

  if (keyId) {
    try {
      const assertion = await AppIntegrity.generateAssertionAsync(keyId, ch.challenge);
      return await submit({ platform: 'ios', challenge: ch.challenge, key_id: keyId, assertion });
    } catch (e: any) {
      // Key unknown to the server or to the Secure Enclave (reinstall, restore
      // on a new phone, revoked): start over with a fresh key.
      const reason = e?.response?.data?.reason;
      const keyGone = reason === 'unknown_key' || reason === 'revoked' || !e?.response;
      if (!keyGone || !allowNewKey) return null;
      await SafeStorage.removeItem(IOS_KEY_STORAGE);
      const { data: next } = await bare.post<ChallengeResponse>('/client/challenge');
      return iosAttest(next, false);
    }
  }

  const newKey = await AppIntegrity.generateKeyAsync();
  const attestation = await AppIntegrity.attestKeyAsync(newKey, ch.challenge);
  const pass = await submit({ platform: 'ios', challenge: ch.challenge, key_id: newKey, attestation });
  if (pass) await SafeStorage.setItem(IOS_KEY_STORAGE, newKey);
  return pass;
}

// ─── Web : Cloudflare Turnstile ────────────────────────────────────────────

declare global {
  interface Window {
    turnstile?: any;
  }
}

let turnstileLoading: Promise<any> | null = null;

function loadTurnstile(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileLoading) {
    turnstileLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')));
      script.onerror = () => {
        turnstileLoading = null;
        reject(new Error('turnstile load failed'));
      };
      document.head.appendChild(script);
    });
  }
  return turnstileLoading;
}

async function webProof(ch: ChallengeResponse): Promise<Record<string, string> | null> {
  if (!ch.turnstile_site_key) return null;
  const turnstile = await loadTurnstile();

  // Invisible unless Cloudflare needs an interaction: the box must then be on
  // screen and clickable, so it sits above everything, bottom centre.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;';
  document.body.appendChild(host);

  let widgetId: string | undefined;
  try {
    const token = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('turnstile timeout')), 60_000);
      widgetId = turnstile.render(host, {
        sitekey: ch.turnstile_site_key,
        action: ch.turnstile_action || 'goes_client',
        cData: ch.challenge,
        appearance: 'interaction-only',
        callback: (t: string) => {
          clearTimeout(timer);
          resolve(t);
        },
        'error-callback': () => {
          clearTimeout(timer);
          reject(new Error('turnstile error'));
        },
        'timeout-callback': () => {
          clearTimeout(timer);
          reject(new Error('turnstile timeout'));
        },
      });
    });
    return { platform: 'web', challenge: ch.challenge, token };
  } finally {
    try {
      if (widgetId) turnstile.remove(widgetId);
    } catch {
      // ignore
    }
    host.remove();
  }
}
