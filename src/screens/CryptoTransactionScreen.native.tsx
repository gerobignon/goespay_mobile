import { Redirect } from 'expo-router';

/**
 * Variante native (iOS et Android) : aucune opération crypto n'existe dans les
 * binaires (licence d'échange exigée par les stores), donc aucun détail à
 * afficher. Voir `cryptoStore.native.ts`.
 */
export default function CryptoTransactionScreen() {
  return <Redirect href="/(tabs)" />;
}
