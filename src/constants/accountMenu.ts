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
  /** Réservé au super-admin (user id 1) — gestion du board Dev. */
  adminOnly?: boolean;
}

/**
 * Renvoie les entrées du menu compte, déjà filtrées selon le profil.
 * @param t       fonction i18n (les libellés passent par les clés `account.*`)
 * @param opts.isCryptoUser  affiche les entrées `cryptoOnly` si vrai
 * @param opts.isSuperAdmin  affiche les entrées `adminOnly` si vrai (user id 1)
 */
export function getAccountMenuItems(
  t: (key: string) => string,
  opts: { isCryptoUser?: boolean; isSuperAdmin?: boolean } = {},
): AccountMenuItem[] {
  const items: AccountMenuItem[] = [
    { key: 'profile', label: t('account.personalInfo'), icon: 'user-pen', route: '/account/profile' },
    { key: 'security', label: t('account.security'), icon: 'shield-halved', route: '/account/security' },
    { key: 'statement', label: t('statement.title'), icon: 'file-invoice-dollar', route: '/account/statement' },
    { key: 'phones', label: t('account.savedPhones'), icon: 'address-book', route: '/account/phones' },
    { key: 'bank-accounts', label: t('account.savedBanks'), icon: 'building-columns', route: '/account/bank-accounts' },
    { key: 'virtual-accounts', label: t('account.virtualAccounts'), icon: 'landmark', route: '/account/virtual-accounts' },
    { key: 'wallets', label: t('account.savedWallets'), icon: 'wallet', route: '/account/wallets', cryptoOnly: true },
    { key: 'settings', label: t('account.customization'), icon: 'gear', route: '/account/settings' },
    { key: 'dev-kanban', label: t('dev.menuTitle'), icon: 'diagram-project', route: '/admin/kanban', adminOnly: true },
  ];
  return items.filter((item) => {
    if (item.cryptoOnly && !opts.isCryptoUser) return false;
    if (item.adminOnly && !opts.isSuperAdmin) return false;
    return true;
  });
}
