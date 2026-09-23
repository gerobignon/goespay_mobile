/**
 * Événements d'application Meta (Facebook) : attribution des installations et
 * mesure des conversions pour les campagnes publicitaires. Aucune connexion
 * sociale, aucun partage : le SDK ne sert qu'à la mesure.
 *
 * L'App ID, le jeton client et l'auto-initialisation sont posés dans le natif
 * par le config plugin `react-native-fbsdk-next` (voir `app.json`) ; ce module
 * ne fait qu'envoyer les événements métier.
 *
 * Suivi publicitaire : sur iOS, l'identifiant publicitaire (IDFA) n'est
 * utilisable qu'avec l'accord explicite de l'utilisateur, demandé par
 * l'App Tracking Transparency (règle App Store 5.1.2(i)). Tant que l'accord
 * n'est pas donné, le SDK tourne sans identifiant : Meta ne reçoit que des
 * conversions agrégées (SKAdNetwork). Sur Android, rien à demander.
 *
 * Deux garde-fous :
 *  - la variante `metaEvents.web.ts` ne fait rien (le SDK est natif, la PWA
 *    n'embarque pas de pixel) ;
 *  - tous les appels sont enveloppés : dans Expo Go le module natif est absent,
 *    la mesure doit échouer en silence et jamais casser un parcours de paiement.
 */
import { AppState, Platform } from 'react-native';
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';

/** Devise de référence du portefeuille : tous les montants sont rapportés en XOF. */
const REPORTING_CURRENCY = 'XOF';

const NEEDS_ATT = Platform.OS === 'ios';

let initialized = false;

/** Exécute un appel au SDK sans jamais laisser remonter d'erreur. */
function safely(run: () => void): void {
  try {
    run();
  } catch {
    // SDK indisponible (Expo Go, module natif absent) : la mesure est optionnelle.
  }
}

/**
 * Autorise ou interdit l'usage de l'identifiant publicitaire par le SDK.
 * Refus de l'utilisateur : Meta continue de recevoir les événements, mais sans
 * identifiant, donc en mesure agrégée seulement.
 */
function applyTrackingConsent(granted: boolean): void {
  safely(() => {
    Settings.setAdvertiserIDCollectionEnabled(granted);
    Settings.setAdvertiserTrackingEnabled(granted);
  });
}

/**
 * Attend que l'app soit au premier plan : iOS refuse d'afficher la demande
 * d'autorisation tant que l'application n'est pas active (écran de démarrage).
 */
function whenActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      subscription.remove();
      resolve();
    });
  });
}

/**
 * Demande l'autorisation de suivi (iOS) et transmet la réponse au SDK. La
 * demande n'est posée qu'une fois par installation : ensuite iOS renvoie le
 * choix mémorisé, que l'utilisateur ne peut changer que dans les Réglages.
 */
async function resolveTrackingConsent(): Promise<void> {
  try {
    const current = await getTrackingPermissionsAsync();
    let granted = current.status === 'granted';
    if (current.status === 'undetermined' && current.canAskAgain) {
      await whenActive();
      const answer = await requestTrackingPermissionsAsync();
      granted = answer.status === 'granted';
    }
    applyTrackingConsent(granted);
  } catch {
    // Module natif absent : on reste sur le réglage prudent posé à l'init.
    applyTrackingConsent(false);
  }
}

/**
 * Démarre le SDK au lancement de l'app. Idempotent : les appels suivants sont
 * ignorés. À appeler une seule fois depuis le layout racine.
 */
export function initMetaEvents(): void {
  if (initialized) return;
  initialized = true;
  safely(() => {
    Settings.setAutoLogAppEventsEnabled(true);
    // iOS démarre sans identifiant publicitaire : la collecte n'est ouverte
    // qu'après l'accord ATT. Android n'est pas concerné par cette demande.
    Settings.setAdvertiserIDCollectionEnabled(!NEEDS_ATT);
    Settings.setAdvertiserTrackingEnabled(!NEEDS_ATT);
    Settings.initializeSDK();
  });
  if (NEEDS_ATT) void resolveTrackingConsent();
}

/** Inscription menée à son terme (compte créé, avant activation par code). */
export function logSignUp(method: string): void {
  safely(() => {
    AppEventsLogger.logEvent(AppEventsLogger.AppEvents.CompletedRegistration, {
      [AppEventsLogger.AppEventParams.RegistrationMethod]: method,
    });
  });
}

/** Recharge lancée : le paiement est parti chez l'opérateur, pas encore confirmé. */
export function logDepositStarted(amountXof: number, operator: string): void {
  if (!(amountXof > 0)) return;
  safely(() => {
    AppEventsLogger.logEvent(AppEventsLogger.AppEvents.InitiatedCheckout, amountXof, {
      [AppEventsLogger.AppEventParams.Currency]: REPORTING_CURRENCY,
      [AppEventsLogger.AppEventParams.ContentType]: operator,
    });
  });
}

/**
 * Recharge confirmée : c'est la conversion optimisée par les campagnes
 * (événement « Purchase » côté Gestionnaire de publicités).
 */
export function logDepositCompleted(amountXof: number, operator: string): void {
  if (!(amountXof > 0)) return;
  safely(() => {
    AppEventsLogger.logPurchase(amountXof, REPORTING_CURRENCY, {
      [AppEventsLogger.AppEventParams.ContentType]: operator,
    });
  });
}
