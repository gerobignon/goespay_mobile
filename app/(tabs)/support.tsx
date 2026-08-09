import React, { useState } from 'react';
import { MessagesInbox } from '../../src/components/chat/MessagesInbox';
import { SupportChannels } from '../../src/components/support/SupportChannels';
import { useMessagingAccess } from '../../src/hooks/useMessagingAccess';
import { MessagingGate } from '../../src/components/MessagingGate';

/**
 * Onglet Support.
 *
 * La messagerie in-app est en rodage et réservée aux administrateurs : ils y
 * voient la boîte de réception, tout le monde voit les canaux de contact
 * historiques. L'onglet reste au même endroit dans les deux cas — pas d'onglet
 * qui apparaît et disparaît selon le compte.
 *
 * Le droit vient du serveur (`messaging_enabled` sur le profil), pas d'un test
 * de rôle local : le jour où la messagerie s'ouvre à tous, aucune ligne de
 * l'app ne bouge.
 */
export default function SupportScreen() {
  const canMessage = useMessagingAccess();
  /** Confirmation refusée : on retombe sur les canaux de contact, pas sur du vide. */
  const [denied, setDenied] = useState(false);

  if (!canMessage || denied) return <SupportChannels />;

  return (
    <MessagingGate onDeny={() => setDenied(true)}>
      <MessagesInbox />
    </MessagingGate>
  );
}
