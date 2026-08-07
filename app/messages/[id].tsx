import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenBackground } from '../../src/components/ScreenBackground';
import { CustomAlert } from '../../src/components/CustomAlert';
import { showAlert, type AlertButton } from '../../src/stores/alertStore';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useColors } from '../../src/components/ThemeProvider';
import { useResponsive } from '../../src/hooks/useResponsive';
import { BorderRadius, FontSize, Fonts, Spacing, type ColorPalette } from '../../src/constants/theme';
import { useMessagingStore } from '../../src/stores/messagingStore';
import { ChatAvatar } from '../../src/components/chat/ChatAvatar';
import { ChatComposer } from '../../src/components/chat/ChatComposer';
import { MessageBubble } from '../../src/components/chat/MessageBubble';
import { DevImageViewer } from '../../src/components/dev/DevImageViewer';
import { dayLabel, isNewDay, presenceLabel } from '../../src/components/chat/chatFormat';
import type { ChatMessage } from '../../src/types';

/**
 * Fil de conversation. La liste est inversée : le bas est l'ancre naturelle
 * d'un chat (dernier message visible sans calcul de défilement) et le haut
 * devient la fin de liste, donc l'endroit où charger l'historique.
 */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { isWide } = useResponsive();
  const { t } = useTranslation();

  const conversation = useMessagingStore((s) => s.conversations.find((c) => c.id === conversationId));
  const messages = useMessagingStore((s) => s.threads[conversationId]);
  const hasMore = useMessagingStore((s) => s.hasMore[conversationId]);
  const isLoadingThread = useMessagingStore((s) => s.isLoadingThread);
  const isSending = useMessagingStore((s) => s.isSending);
  const error = useMessagingStore((s) => s.error);
  const {
    loadThread,
    loadOlder,
    send,
    retry,
    markRead,
    notifyTyping,
    setMuted,
    startThreadPolling,
    stopThreadPolling,
    clearError,
  } = useMessagingStore();

  const [viewerUri, setViewerUri] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    loadThread(conversationId, !!messages);
  }, [conversationId]);

  // Le sondage ne tourne que sur l'écran visible : quitter le fil le coupe.
  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      startThreadPolling(conversationId);
      return () => stopThreadPolling();
    }, [conversationId]),
  );

  // Revenir sur un fil déjà chargé efface ses non-lus sans recharger la liste.
  useEffect(() => {
    if (conversationId && conversation && conversation.unread_count > 0) {
      markRead(conversationId);
    }
  }, [conversationId, conversation?.unread_count]);

  // Un refus du serveur (blocage, quota de premier contact) doit être dit :
  // la bulle barrée seule ne se comprend pas.
  useEffect(() => {
    if (!error) return;
    showAlert(t('common.error', 'Erreur'), error);
    clearError();
  }, [error]);

  const isSupport = conversation?.type === 'support';
  const peer = conversation?.peer || null;

  // Liste inversée : le message le plus récent en tête de données.
  const data = useMemo(() => [...(messages || [])].reverse(), [messages]);

  const subtitle = conversation?.peer_typing
    ? t('messages.typing', 'écrit…')
    : isSupport
      ? t('messages.supportSub', 'Une question ? Écrivez-nous.')
      : peer
        ? presenceLabel(peer.online, peer.last_seen_at, t)
        : '';

  const openMenu = () => {
    if (!conversation) return;

    const actions: AlertButton[] = [
      {
        text: conversation.muted
          ? t('messages.unmute', 'Réactiver les notifications')
          : t('messages.mute', 'Couper les notifications'),
        onPress: () => setMuted(conversation.id, !conversation.muted),
      },
    ];

    if (!isSupport && peer) {
      actions.push({
        text: t('messages.viewProfile', 'Voir le profil'),
        onPress: () => router.push(`/messages/profile/${peer.id}`),
      });
    }

    actions.push({ text: t('common.cancel', 'Annuler'), style: 'cancel' });

    showAlert(conversation.title, '', actions);
  };

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    // `data` est inversée : l'élément suivant est le message précédent dans le temps.
    const previous = data[index + 1];
    const showDay = isNewDay(previous?.created_at ?? null, item.created_at);

    return (
      <View>
        {showDay && (
          <View style={styles.dayWrap}>
            <Text style={styles.dayText}>{dayLabel(item.created_at, t)}</Text>
          </View>
        )}
        <MessageBubble
          message={item}
          peerReadId={conversation?.peer_read_id ?? 0}
          onPressImage={setViewerUri}
          onRetry={(tempId) => retry(conversationId, tempId)}
        />
      </View>
    );
  };

  return (
    <ScreenBackground edges={['top']} animateEntrance={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* En-tête */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <FontAwesome6 name="arrow-left" size={19} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerWho}
            activeOpacity={peer ? 0.7 : 1}
            onPress={() => peer && router.push(`/messages/profile/${peer.id}`)}
          >
            <ChatAvatar
              name={conversation?.title || ''}
              uri={conversation?.avatar}
              isSupport={isSupport}
              online={peer?.online}
              size={38}
            />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isSupport ? t('messages.supportTitle', 'Support GoesPay') : conversation?.title || ''}
              </Text>
              {!!subtitle && (
                <Text
                  style={[styles.headerSub, conversation?.peer_typing && { color: colors.positive }]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={openMenu} hitSlop={10}>
            <FontAwesome6 name="ellipsis-vertical" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Fil */}
        {isLoadingThread && !messages ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : (
          <FlatList
            data={data}
            inverted
            keyExtractor={(m) => String(m.id)}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.list,
              isWide && { alignSelf: 'center', width: '100%', maxWidth: 760 },
            ]}
            onEndReached={() => hasMore && loadOlder(conversationId)}
            onEndReachedThreshold={0.3}
            keyboardDismissMode="on-drag"
            ListFooterComponent={
              hasMore ? <ActivityIndicator style={{ marginVertical: Spacing.md }} color={colors.textMuted} /> : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {isSupport
                    ? t('messages.supportEmpty', 'Décrivez votre demande, nous vous répondons ici.')
                    : t('messages.directEmpty', 'Envoyez le premier message.')}
                </Text>
              </View>
            }
          />
        )}

        <ChatComposer
          onSend={(body, imageUri) => send(conversationId, body, imageUri)}
          onTyping={() => notifyTyping(conversationId)}
          sending={isSending}
        />
      </KeyboardAvoidingView>

      <DevImageViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
      <CustomAlert />
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    headerWho: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      minWidth: 0,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.md,
      color: Colors.text,
    },
    headerSub: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
      marginTop: 1,
    },
    list: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayWrap: {
      alignItems: 'center',
      marginVertical: Spacing.sm,
    },
    dayText: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
      backgroundColor: Colors.surface,
      paddingHorizontal: Spacing.md,
      paddingVertical: 4,
      borderRadius: BorderRadius.pill,
      overflow: 'hidden',
    },
    empty: {
      // La liste est inversée : le vide se retourne aussi, sinon le texte
      // s'affiche à l'envers.
      transform: [{ scaleY: -1 }],
      alignItems: 'center',
      paddingVertical: Spacing.xl,
    },
    emptyText: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      textAlign: 'center',
      maxWidth: 280,
    },
  });
