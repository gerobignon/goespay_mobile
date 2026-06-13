import React from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import type { Href } from 'expo-router';

// ─────────────────────────────────────────────────────────────────────────
// Source UNIQUE du menu « Mon compte ».
// Utilisé par la sidebar desktop (account/_layout), le modal avatar de
// l'accueil ((tabs)/index) et l'écran compte mobile (account/index).
// La sidebar fait foi : pour ajouter/retirer une entrée, c'est ICI seulement.
// ─────────────────────────────────────────────────────────────────────────

export interface AccountMenuItem {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  route: Href;
  /** Réservé aux utilisateurs crypto (masqué sinon). */
  cryptoOnly?: boolean;
}

/**
 * Renvoie les entrées du menu compte, déjà filtrées selon le profil.
 * @param t       fonction i18n (les libellés passent par les clés `account.*`)
 * @param opts.isCryptoUser  affiche les entrées `cryptoOnly` si vrai
 */
export function getAccountMenuItems(
  t: (key: string) => string,
  opts: { isCryptoUser?: boolean } = {},
): AccountMenuItem[] {
  const items: AccountMenuItem[] = [
    { key: 'profile', label: t('account.personalInfo'), icon: 'user-pen', route: '/account/profile' },
    { key: 'security', label: t('account.security'), icon: 'shield-halved', route: '/account/security' },
    { key: 'phones', label: t('account.savedPhones'), icon: 'address-book', route: '/account/phones' },
    { key: 'wallets', label: t('account.savedWallets'), icon: 'wallet', route: '/account/wallets', cryptoOnly: true },
    { key: 'settings', label: t('account.customization'), icon: 'gear', route: '/account/settings' },
    { key: 'currency', label: t('account.currency'), icon: 'coins', route: '/account/currency' },
  ];
  return items.filter((item) => !(item.cryptoOnly && !opts.isCryptoUser));
}
