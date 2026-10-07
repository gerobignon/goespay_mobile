import type { TFunction } from 'i18next';
import i18n from '../i18n';
import { authService } from '../services/authService';
import { showAlert } from '../stores/alertStore';
import { usePinStore } from '../stores/pinStore';
import type { AccountDeletionBlocker, AccountDeletionStatus } from '../types';

/**
 * Parcours « Supprimer mon compte », partagé par le menu Compte (mobile),
 * la barre latérale (desktop) et le menu profil de l'accueil.
 *
 *   . aucun obstacle : confirmation, envoi du lien par mail (48 h), puis
 *     déconnexion ;
 *   . lien déjà envoyé : rappel de l'échéance, annulation possible ;
 *   . obstacle (solde, opération en cours, carte…) : on dit lequel.
 *
 * La confirmation se fait sur le lien du mail : elle déconnecte tous les
 * appareils, et une reconnexion avant l'échéance (delay_days, 30 par défaut)
 * annule la suppression ; à 0 la suppression est immédiate.
 */

function formatDeadline(iso: string | null): string {
  if (!iso) return '';
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR';
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function errorMessage(e: any, t: TFunction): string {
  return e?.response?.data?.error || e?.response?.data?.message || t('common.error');
}

function showBlockers(blockers: AccountDeletionBlocker[], t: TFunction) {
  showAlert(
    t('account.deletionBlockedTitle'),
    blockers.map((b) => b.message).join('\n'),
    [{ text: t('account.deletionClose'), style: 'cancel' }],
    'warning',
  );
}

function showLinkSent(status: AccountDeletionStatus, email: string, t: TFunction) {
  showAlert(
    t('account.deletionLinkSentTitle'),
    t('account.deletionLinkSentMessage', { email, date: formatDeadline(status.link_expires_at) }),
    [
      { text: t('account.deletionClose'), style: 'cancel' },
      { text: t('account.deletionCancelRequest'), style: 'destructive', onPress: () => cancelRequest(t) },
    ],
    'info',
  );
}

async function sendLink(email: string, t: TFunction) {
  try {
    const status = await authService.requestAccountDeletion();
    // Demande envoyée : on déconnecte tout de suite. L'alerte, montée à la
    // racine, reste affichée par-dessus l'écran de connexion.
    showAlert(
      t('account.deletionLinkSentTitle'),
      t('account.deletionLinkSentLoggedOut', {
        email: status.email || email,
        date: formatDeadline(status.link_expires_at),
      }),
      [{ text: t('account.deletionClose'), style: 'cancel' }],
      'info',
    );
    // Import différé : authStore importe déjà ce module (notification à la
    // reconnexion), un import statique formerait un cycle.
    const { useAuthStore } = await import('../stores/authStore');
    await useAuthStore.getState().logout();
    usePinStore.setState({ lockMethod: null, isSetupDone: false, isLocked: false });
  } catch (e: any) {
    const blockers: AccountDeletionBlocker[] | undefined = e?.response?.data?.blockers;
    if (blockers && blockers.length > 0) {
      showBlockers(blockers, t);
      return;
    }
    showAlert(t('common.error'), errorMessage(e, t), undefined, 'error');
  }
}

async function cancelRequest(t: TFunction) {
  try {
    await authService.cancelAccountDeletion();
    showAlert(t('account.deletionCancelledTitle'), t('account.deletionCancelledMessage'), undefined, 'success');
  } catch (e: any) {
    showAlert(t('common.error'), errorMessage(e, t), undefined, 'error');
  }
}

export async function startAccountDeletion(t: TFunction, email: string) {
  let status: AccountDeletionStatus;
  try {
    status = await authService.getAccountDeletion();
  } catch (e: any) {
    showAlert(t('common.error'), errorMessage(e, t), undefined, 'error');
    return;
  }

  if (status.state === 'link_sent') {
    showLinkSent(status, email, t);
    return;
  }

  if (status.blockers.length > 0) {
    showBlockers(status.blockers, t);
    return;
  }

  showAlert(
    t('account.deleteAccount'),
    status.delay_days === 0
      ? t('account.deleteAccountMessageNow')
      : t('account.deleteAccountMessage', { days: status.delay_days ?? 30 }),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.deleteAccountConfirm'), style: 'destructive', onPress: () => sendLink(email, t) },
    ],
    'warning',
  );
}

/** Connexion qui vient d'annuler une suppression programmée : on le dit. */
export function notifyDeletionCancelledOnLogin(user: { deletion_cancelled?: boolean } | null | undefined) {
  if (!user?.deletion_cancelled) return;
  showAlert(
    i18n.t('account.deletionLoginCancelledTitle'),
    i18n.t('account.deletionLoginCancelledMessage'),
    undefined,
    'info',
  );
}
