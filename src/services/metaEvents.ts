/**
 * Événements d'application Meta (Facebook) : attribution des installations et
 * mesure des conversions pour les campagnes publicitaires. Aucune connexion
 * sociale, aucun partage : le SDK ne sert qu'à la mesure.
 *
 * L'App ID, le jeton client et l'auto-initialisation sont posés dans le natif
 * par le config plugin `react-native-fbsdk-next` (voir `app.json`) ; ce module
 * ne fait qu'envoyer les événements métier.
 *
 * Deux garde-fous :
 *  - la variante `metaEvents.web.ts` ne fait rien (le SDK est natif, la PWA
 *    n'embarque pas de pixel) ;
 *  - tous les appels sont enveloppés : dans Expo Go le module natif est absent,
 *    la mesure doit échouer en silence et jamais casser un parcours de paiement.
 */
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';

/** Devise de référence du portefeuille : tous les montants sont rapportés en XOF. */
const REPORTING_CURRENCY = 'XOF';

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
 * Démarre le SDK au lancement de l'app. Idempotent : les appels suivants sont
 * ignorés. À appeler une seule fois depuis le layout racine.
 */
export function initMetaEvents(): void {
  if (initialized) return;
  initialized = true;
  safely(() => {
    Settings.setAutoLogAppEventsEnabled(true);
    Settings.setAdvertiserIDCollectionEnabled(true);
    Settings.initializeSDK();
  });
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
