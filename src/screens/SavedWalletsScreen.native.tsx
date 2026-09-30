import { Redirect } from 'expo-router';

/**
 * Variante native (iOS et Android) : les adresses crypto enregistrées
 * n'existent pas dans les binaires (licence d'échange exigée par les stores).
 * L'entrée de menu est déjà coupée par `CRYPTO_AVAILABLE` ; la route renvoie au
 * compte si on l'atteint quand même. Voir `cryptoStore.native.ts`.
 */
export default function SavedWalletsScreen() {
  return <Redirect href="/account" />;
}
