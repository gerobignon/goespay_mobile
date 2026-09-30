import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────
// Disponibilité des fonctionnalités par plateforme.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Achat et vente de crypto.
 *
 * Absent des binaires iOS et Android : les stores exigent une licence
 * d'échange crypto dans chaque pays de distribution (App Store 3.1.5(iii),
 * règles Google Play sur les produits financiers). Tant que ces licences ne
 * sont pas obtenues, les apps natives n'offrent aucun service d'échange, pour
 * tous les utilisateurs et non pour le seul relecteur (une fonctionnalité
 * masquée puis rallumée côté serveur tombe sous la règle 2.3.1).
 *
 * Seule la PWA (web) est concernée : les flags `crypto_buy_enabled` et
 * `crypto_sell_enabled` du backend y font foi.
 */
export const CRYPTO_AVAILABLE = Platform.OS === 'web';
