import { router } from 'expo-router';
import type { User } from '../types';
import { showAlert } from '../stores/alertStore';

/**
 * Niveau KYC effectif : 2 = vérification complète (validate = 1), 1 = basique
 * (Mobile Money + transferts GOESPAY, sorties plafonnées), 0 = aucun.
 */
export function kycLevelOf(user?: Partial<User> | null): 0 | 1 | 2 {
  if (!user) return 0;
  if (user.validate === 1) return 2;
  return (user.kyc_level ?? 0) >= 1 ? 1 : 0;
}

/** Alerte « passez au Niveau 2 » avec accès direct au formulaire complet. */
export function promptKycUpgrade(t: (key: string, opts?: any) => string, message?: string) {
  showAlert(
    t('kyc.upgradeTitle'),
    message || t('kyc.upgradeText'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('kyc.upgradeBtn'), onPress: () => router.push('/kyc?level=2') },
    ],
  );
}

/**
 * Erreur API « Niveau 2 requis » (plafond du Niveau 1 atteint ou fonctionnalité
 * avancée) : affiche l'alerte de passage au Niveau 2 et renvoie true.
 */
export function handleKycUpgradeError(error: any, t: (key: string, opts?: any) => string): boolean {
  const data = error?.response?.data;
  if (error?.response?.status !== 403 || data?.code !== 'kyc_level2_required') return false;
  promptKycUpgrade(t, typeof data?.error === 'string' ? data.error : undefined);
  return true;
}
