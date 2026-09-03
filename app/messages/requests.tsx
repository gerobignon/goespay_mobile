import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { RefreshableScrollView } from '../../src/components/Refreshable';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenBackground } from '../../src/components/ScreenBackground';
import { CustomAlert } from '../../src/components/CustomAlert';
import { showAlert } from '../../src/stores/alertStore';
import { Reveal } from '../../src/components/anim';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useColors } from '../../src/components/ThemeProvider';
import { useResponsive } from '../../src/hooks/useResponsive';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../src/constants/theme';
import { messagingService } from '../../src/services/messagingService';
import { useMessagingStore } from '../../src/stores/messagingStore';
import { ChatAvatar } from '../../src/components/chat/ChatAvatar';
import { shortAgo } from '../../src/components/chat/chatFormat';
import type { ContactRequest } from '../../src/types';

/**
 * Invitations à discuter.
 *
 * Reçues : on voit la fiche du demandeur — c'est lui qui sollicite, il se
 * montre — et son mot d'accompagnement, de quoi décider. Envoyées : on voit
 * seulement qu'elles sont en attente ; rien ne dit si elles ont été lues, ni
 * même si le compte visé existe.
 *
 * Refusées : repliées derrière un bouton, car un refus n'a pas à occuper
 * l'écran. Elles restent en base pour empêcher les relances, donc les montrer
 * est le seul moyen de revenir dessus — accepter, ou effacer pour rouvrir la
 * porte à l'expéditeur.
 */
/**
 * Ligne secondaire d'une carte. L'identifiant n'y figure pas quand le nom est
 * masqué : il tient déjà lieu de nom, l'écrire deux fois ressemblerait à un bug.
 */
function metaOf(peer: ContactRequest['peer'], tail: string): string {
  return [peer && !peer.name_hidden ? `#${peer.id}` : null, peer?.country || null, tail]
    .filter(Boolean)
    .join(' · ');
}

export default function RequestsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { isWide } = useResponsive();
  const { t } = useTranslation();

  const [incoming, setIncoming] = useState<ContactRequest[]>([]);
  const [outgoing, setOutgoing] = useState<ContactRequest[]>([]);
  const [declined, setDeclined] = useState<ContactRequest[]>([]);
  const [showDeclined, setShowDeclined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const setPendingRequests = useMessagingStore((s) => s.setPendingRequests);

  const load = useCallback(async () => {
    try {
      const data = await messagingService.getRequests();
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
      setDeclined(data.declined);
      // Les badges (onglet, icône de l'app) suivent la liste réellement affichée.
      setPendingRequests(data.incoming.length);
    } catch {
      // Liste vide plutôt qu'un écran d'erreur : rechargeable en revenant.
    } finally {
      setLoading(false);
    }
  }, [setPendingRequests]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  /** Retire une invitation reçue de la liste, badges compris. */
  const dropIncoming = (id: number) => {
    const remaining = incoming.filter((r) => r.id !== id);
    setIncoming(remaining);
    setPendingRequests(remaining.length);
  };

  const accept = async (request: ContactRequest) => {
    setBusyId(request.id);
    try {
      const conversation = await messagingService.acceptRequest(request.id);
      dropIncoming(request.id);
      setDeclined((list) => list.filter((r) => r.id !== request.id));
      router.push(`/messages/${conversation.id}`);
    } catch (e: any) {
      showAlert(t('common.error', 'Erreur'), e?.response?.data?.error || t('messages.actionFailed', 'Action impossible.'));
    } finally {
      setBusyId(null);
    }
  };

  const decline = (request: ContactRequest) => {
    showAlert(
      t('messages.declineTitle', 'Refuser cette invitation ?'),
      t('messages.declineBody', 'Ce compte ne pourra plus vous inviter.'),
      [
        { text: t('common.cancel', 'Annuler'), style: 'cancel' },
        {
          text: t('messages.decline', 'Refuser'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(request.id);
            try {
              await messagingService.declineRequest(request.id);
              dropIncoming(request.id);
              // Elle rejoint la section « Refusées » sans attendre un rechargement.
              setDeclined((list) => [{ ...request, direction: 'declined' }, ...list]);
            } catch {
              // Reste en liste : réessayable.
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  /** Efface le refus : l'expéditeur redevient capable d'inviter. */
  const forget = (request: ContactRequest) => {
    showAlert(
      t('messages.forgetTitle', 'Supprimer ce refus ?'),
      t('messages.forgetBody', 'Ce compte pourra de nouveau vous inviter.'),
      [
        { text: t('common.cancel', 'Annuler'), style: 'cancel' },
        {
          text: t('messages.forget', 'Supprimer'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(request.id);
            try {
              await messagingService.forgetRequest(request.id);
              setDeclined((list) => list.filter((r) => r.id !== request.id));
            } catch (e: any) {
              showAlert(
                t('common.error', 'Erreur'),
                e?.response?.data?.error || t('messages.actionFailed', 'Action impossible.'),
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenBackground edges={['top']}>
      <RefreshableScrollView
        contentContainerStyle={[
          styles.scroll,
          isWide && { alignSelf: 'center', width: '100%', maxWidth: 700 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={colors.text}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <FontAwesome6 name="arrow-left" size={19} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('messages.requestsTitle', 'Invitations')}</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.text} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t('messages.received', 'Reçues')}</Text>
            {incoming.length === 0 ? (
              <Text style={styles.emptyText}>{t('messages.noRequest', 'Aucune invitation en attente.')}</Text>
            ) : (
              <View style={styles.list}>
                {incoming.map((r, i) => (
                  <Reveal key={r.id} delay={i * 45} offset={10}>
                    <View style={styles.card}>
                      <TouchableOpacity
                        style={styles.cardHead}
                        activeOpacity={0.7}
                        onPress={() => r.peer && router.push(`/messages/profile/${r.peer.id}`)}
                      >
                        <ChatAvatar
                          name={r.peer?.name || ''}
                          uri={r.peer?.avatar}
                          size={46}
                          hidden={!!r.peer?.name_hidden}
                        />
                        <View style={styles.cardBody}>
                          <View style={styles.cardTop}>
                            {r.peer?.name_hidden && (
                              <FontAwesome6 name="eye-slash" size={11} color={colors.textMuted} />
                            )}
                            <Text style={styles.cardName} numberOfLines={1}>{r.peer?.name}</Text>
                            {r.peer?.verified && (
                              <FontAwesome6 name="circle-check" size={12} color={colors.positive} />
                            )}
                          </View>
                          <Text style={styles.cardMeta} numberOfLines={1}>
                            {metaOf(r.peer, shortAgo(r.created_at, t))}
                          </Text>
                        </View>
                        <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} />
                      </TouchableOpacity>

                      {!!r.note && <Text style={styles.note}>« {r.note} »</Text>}

                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={[styles.decline, { borderColor: colors.border }]}
                          onPress={() => decline(r)}
                          disabled={busyId === r.id}
                        >
                          <Text style={styles.declineText}>{t('messages.decline', 'Refuser')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.accept, { backgroundColor: colors.primary }]}
                          onPress={() => accept(r)}
                          disabled={busyId === r.id}
                        >
                          {busyId === r.id ? (
                            <ActivityIndicator size="small" color={colors.white} />
                          ) : (
                            <Text style={styles.acceptText}>{t('messages.accept', 'Accepter')}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Reveal>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>{t('messages.sent', 'Envoyées')}</Text>
            {outgoing.length === 0 ? (
              <Text style={styles.emptyText}>{t('messages.noSentRequest', 'Aucune invitation envoyée.')}</Text>
            ) : (
              <View style={styles.list}>
                {outgoing.map((r) => (
                  <View key={r.id} style={[styles.card, styles.cardMuted]}>
                    <View style={styles.cardHead}>
                      <ChatAvatar
                        name={r.peer?.name || '?'}
                        uri={r.peer?.avatar}
                        size={40}
                        hidden={!!r.peer?.name_hidden}
                      />
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName} numberOfLines={1}>{r.peer?.name}</Text>
                        <Text style={styles.cardMeta}>
                          {t('messages.pending', 'En attente')} · {shortAgo(r.created_at, t)}
                        </Text>
                      </View>
                      <View style={[styles.pendingTag, { backgroundColor: withAlpha(colors.pending, 0.18) }]}>
                        <FontAwesome6 name="hourglass-half" size={11} color={colors.pending} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {declined.length > 0 && (
              <>
                <TouchableOpacity
                  style={[styles.toggle, { borderColor: colors.border }]}
                  onPress={() => setShowDeclined((v) => !v)}
                  activeOpacity={0.7}
                >
                  <FontAwesome6 name="ban" size={12} color={colors.textMuted} />
                  <Text style={styles.toggleText}>
                    {t('messages.declinedTitle', 'Refusées')} ({declined.length})
                  </Text>
                  <FontAwesome6
                    name={showDeclined ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>

                {showDeclined && (
                  <View style={styles.list}>
                    {declined.map((r, i) => (
                      <Reveal key={r.id} delay={i * 45} offset={10}>
                        <View style={styles.card}>
                          <TouchableOpacity
                            style={styles.cardHead}
                            activeOpacity={0.7}
                            onPress={() => r.peer && router.push(`/messages/profile/${r.peer.id}`)}
                          >
                            <ChatAvatar
                              name={r.peer?.name || ''}
                              uri={r.peer?.avatar}
                              size={46}
                              hidden={!!r.peer?.name_hidden}
                            />
                            <View style={styles.cardBody}>
                              <View style={styles.cardTop}>
                                {r.peer?.name_hidden && (
                                  <FontAwesome6 name="eye-slash" size={11} color={colors.textMuted} />
                                )}
                                <Text style={styles.cardName} numberOfLines={1}>{r.peer?.name}</Text>
                                {r.peer?.verified && (
                                  <FontAwesome6 name="circle-check" size={12} color={colors.positive} />
                                )}
                              </View>
                              <Text style={styles.cardMeta} numberOfLines={1}>
                                {metaOf(r.peer, shortAgo(r.responded_at || r.created_at, t))}
                              </Text>
                            </View>
                            <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} />
                          </TouchableOpacity>

                          {!!r.note && <Text style={styles.note}>« {r.note} »</Text>}

                          <View style={styles.actions}>
                            <TouchableOpacity
                              style={[styles.decline, { borderColor: colors.border }]}
                              onPress={() => forget(r)}
                              disabled={busyId === r.id}
                            >
                              <Text style={styles.declineText}>{t('messages.forget', 'Supprimer')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.accept, { backgroundColor: colors.primary }]}
                              onPress={() => accept(r)}
                              disabled={busyId === r.id}
                            >
                              {busyId === r.id ? (
                                <ActivityIndicator size="small" color={colors.white} />
                              ) : (
                                <Text style={styles.acceptText}>{t('messages.accept', 'Accepter')}</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </Reveal>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </RefreshableScrollView>
      <CustomAlert />
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.xl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    title: { fontFamily: Fonts.bold, fontSize: FontSize.xl, color: Colors.text },
    sectionTitle: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    list: { gap: Spacing.sm },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.sm + 2,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    toggleText: { fontFamily: Fonts.semiBold, fontSize: FontSize.sm, color: Colors.textMuted },
    card: {
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
    },
    cardMuted: { opacity: 0.75 },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    cardBody: { flex: 1, minWidth: 0 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    cardName: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.md,
      color: Colors.text,
      flexShrink: 1,
    },
    cardMeta: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
      marginTop: 1,
    },
    note: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textSecondary,
      marginTop: Spacing.sm,
      fontStyle: 'italic',
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    decline: {
      flex: 1,
      borderWidth: 1,
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.sm + 2,
      alignItems: 'center',
    },
    declineText: { fontFamily: Fonts.semiBold, fontSize: FontSize.sm, color: Colors.textMuted },
    accept: {
      flex: 1,
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.sm + 2,
      alignItems: 'center',
    },
    acceptText: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: '#fff' },
    pendingTag: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
  });
