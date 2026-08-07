import { useAuthStore } from '../stores/authStore';

/**
 * Droit d'accès à la messagerie in-app, tel que déclaré par le serveur sur le
 * profil (`messaging_enabled`).
 *
 * Aujourd'hui le serveur ne l'accorde qu'au groupe admin, le temps du rodage.
 * L'app ne teste jamais un rôle elle-même : le jour où la messagerie ouvre à
 * tous, c'est `Messaging::isAllowed` côté backend qui change, et rien ici.
 *
 * Par défaut faux : un profil pas encore chargé ne doit pas faire clignoter la
 * boîte de réception avant de la retirer.
 */
export function useMessagingAccess(): boolean {
  return useAuthStore((s) => s.user?.messaging_enabled === true);
}
