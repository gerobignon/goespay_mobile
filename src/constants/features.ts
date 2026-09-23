import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────
// Disponibilité des fonctionnalités par plateforme.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Achat et vente de crypto.
 *
 * Absent du binaire iOS : la règle 3.1.5(iii) de l'App Store exige une licence
 * d'échange crypto dans chaque pays de distribution. Tant que ces licences ne
 * sont pas obtenues, l'app iOS n'offre aucun service d'échange, pour tous les
 * utilisateurs et non pour le seul relecteur (une fonctionnalité masquée puis
 * rallumée côté serveur tombe sous la règle 2.3.1).
 *
 * Android et la PWA ne sont pas concernés : les flags `crypto_buy_enabled` et
 * `crypto_sell_enabled` du backend continuent d'y faire foi.
 */
export const CRYPTO_AVAILABLE = Platform.OS !== 'ios';
