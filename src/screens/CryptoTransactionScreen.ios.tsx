import { Redirect } from 'expo-router';

/**
 * Variante iOS : aucune opération crypto n'existe dans le binaire iOS (règle
 * App Store 3.1.5(iii)), donc aucun détail à afficher. Voir `cryptoStore.ios.ts`.
 */
export default function CryptoTransactionScreen() {
  return <Redirect href="/(tabs)" />;
}
