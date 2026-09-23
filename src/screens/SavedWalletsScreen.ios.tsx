import { Redirect } from 'expo-router';

/**
 * Variante iOS : les adresses crypto enregistrées n'existent pas dans le
 * binaire iOS (règle App Store 3.1.5(iii)). L'entrée de menu est déjà coupée
 * par `CRYPTO_AVAILABLE` ; la route renvoie au compte si on l'atteint quand
 * même. Voir `cryptoStore.ios.ts`.
 */
export default function SavedWalletsScreen() {
  return <Redirect href="/account" />;
}
