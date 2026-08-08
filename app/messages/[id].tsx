import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenBackground } from '../../src/components/ScreenBackground';
import { CustomAlert } from '../../src/components/CustomAlert';
import { showAlert } from '../../src/stores/alertStore';
import { ActionSheet, type SheetAction } from '../../src/components/ActionSheet';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useColors } from '../../src/components/ThemeProvider';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useKeyboardInset, useLockDocumentScroll } from '../../src/hooks/useKeyboardInset';
import { BorderRadius, FontSize, Fonts, Spacing, type ColorPalette } from '../../src/constants/theme';
import { useMessagingStore } from '../../src/stores/messagingStore';
import { ChatAvatar } from '../../src/components/chat/ChatAvatar';
import { ChatComposer, type ComposerQuote } from '../../src/components/chat/ChatComposer';
import { MessageBubble } from '../../src/components/chat/MessageBubble';
import { ImageLightbox } from '../../src/components/chat/ImageLightbox';
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
  const { isWide, isDesktop } = useResponsive();
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
  const [quote, setQuote] = useState<ComposerQuote | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { keyboard: keyboardInset, viewportHeight } = useKeyboardInset();
  const insets = useSafeAreaInsets();
  useLockDocumentScroll();
  // Ouvrir les emojis ferme le clavier : sa hauteur est déjà retombée à zéro
  // quand le panneau s'affiche. On garde la dernière mesure pour lui donner
  // exactement la place que le clavier occupait — pas de saut de mise en page.
  const lastKeyboardRef = useRef(0);
  if (keyboardInset > 180) lastKeyboardRef.current = keyboardInset;

  // Web : on impose au conteneur la hauteur RÉELLEMENT visible, moins la barre
  // d'état déjà réservée par ScreenBackground. Avec le défilement du document
  // verrouillé, la saisie reste en bas de l'écran quoi qu'il arrive.
  //
  // Surtout pas `position: fixed` : il se cale sur le premier ancêtre porteur
  // d'une transform — et ScreenBackground en a une — au lieu du viewport, ce
  // qui décalait tout l'écran vers le bas et poussait la saisie hors champ.
  // Calage sur le viewport visible : utile UNIQUEMENT sur mobile web, où le
  // clavier virtuel réduit la zone visible sans réduire le document.
  //
  // Sur desktop il n'y a pas de clavier virtuel, mais un en-tête et un pied de
  // page autour de l'écran : imposer la hauteur du viewport y faisait déborder
  // le fil, et la saisie passait sous le pied de page. On laisse donc le flex
  // faire son travail.
  //
  // `flexBasis: 'auto'` est indispensable : le conteneur porte déjà `flex: 1`,
  // qui vaut flexBasis 0%. Poser une hauteur sans corriger la base laissait
  // l'élément s'effondrer — la liste disparaissait et la saisie remontait
  // contre l'en-tête.
  const webViewportStyle =
    Platform.OS === 'web' && viewportHeight && !isDesktop
      ? ({
          height: Math.max(320, viewportHeight - insets.top),
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 'auto',
        } as any)
      : null;

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

  const menuActions: SheetAction[] = conversation
    ? [
        {
          label: conversation.muted
            ? t('messages.unmute', 'Réactiver les notifications')
            : t('messages.mute', 'Couper les notifications'),
          icon: conversation.muted ? 'bell' : 'bell-slash',
          onPress: () => setMuted(conversation.id, !conversation.muted),
        },
        ...(!isSupport && peer
          ? [
              {
                label: t('messages.viewProfile', 'Voir le profil'),
                icon: 'user',
                onPress: () => router.push(`/messages/profile/${peer.id}`),
              },
              {
                label: t('messages.report', 'Signaler'),
                icon: 'flag',
                destructive: true,
                onPress: () => router.push(`/messages/profile/${peer.id}`),
              },
            ]
          : []),
      ]
    : [];

  /** Balayage sur une bulle → elle se retrouve citée au-dessus de la saisie. */
  const startQuote = (message: ChatMessage) => {
    if (message.is_system || message.id <= 0) return;
    const author = message.mine
      ? t('messages.you', 'Vous')
      : message.author?.name || conversation?.title || '';
    const body = message.body || (message.attachment ? t('messages.photo', 'Photo') : '');
    setQuote({ id: message.id, author, body, photo: !!message.attachment, mine: message.mine });
  };

  /**
   * Signet : remonter au message cité. S'il n'est pas encore chargé, on tire
   * une page d'historique et on réessaie — sans quoi le lien serait mort dès
   * qu'on cite un message ancien.
   */
  const jumpToMessage = async (messageId: number) => {
    let index = data.findIndex((m) => m.id === messageId);
    if (index < 0) {
      await loadOlder(conversationId);
      index = useMessagingStore
        .getState()
        .threads[conversationId]?.slice()
        .reverse()
        .findIndex((m) => m.id === messageId) ?? -1;
      if (index < 0) return;
    }
    try {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    } catch {
      // Index hors de la fenêtre rendue : le highlight suffit à situer.
    }
    setHighlightId(messageId);
    setTimeout(() => setHighlightId((v) => (v === messageId ? null : v)), 1800);
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
          onQuote={startQuote}
          onPressReply={jumpToMessage}
          highlighted={highlightId === item.id}
        />
      </View>
    );
  };

  return (
    <ScreenBackground edges={['top']} animateEntrance={false}>
      {/* Sur le web, l'écran est calé sur le viewport VISIBLE et posé en position
          fixe : le clavier virtuel ne réduit pas le document, si bien qu'une
          simple réserve en bas laissait la saisie au bas de la page — donc
          sous le clavier — et la faisait suivre le défilement. En natif, il
          suffit de réserver la place du clavier. */}
      <View
        style={[
          styles.flex,
          webViewportStyle,
          !webViewportStyle && { paddingBottom: keyboardInset },
        ]}
      >
        {/* En-tête — aligné sur la colonne de lecture en grand écran. */}
        <View style={[styles.header, isWide && styles.headerWide]}>
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

          <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={10}>
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
            ref={listRef}
            // Prend explicitement la place laissée entre l'en-tête et la
            // saisie : sans ça, dans un conteneur de hauteur fixe, la liste
            // peut se réduire à rien.
            style={styles.flex}
            data={data}
            inverted
            // Un saut vers un message non encore mesuré échoue autrement.
            onScrollToIndexFailed={() => {}}
            keyExtractor={(m) => String(m.id)}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.list,
              // Sur grand écran, un fil pleine largeur étire chaque échange
              // d'un bord à l'autre : on borne à une colonne de lecture et on
              // resserre l'interligne pour qu'il tienne plus d'échanges à
              // l'écran.
              isWide && styles.listWide,
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
          onSend={(body, imageUri) => {
            // La citation part comme référence, pas comme texte recopié.
            const replyTo = quote;
            setQuote(null);
            return send(conversationId, body, imageUri, replyTo);
          }}
          onTyping={() => notifyTyping(conversationId)}
          sending={isSending}
          quote={quote}
          onCancelQuote={() => setQuote(null)}
          keyboardHeight={lastKeyboardRef.current}
          style={isWide ? styles.composerWide : undefined}
        />
      </View>

      <ActionSheet
        visible={menuOpen}
        title={isSupport ? t('messages.supportTitle', 'Support GoesPay') : conversation?.title}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />
      <ImageLightbox uri={viewerUri} onClose={() => setViewerUri(null)} />
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
    headerWide: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 940,
      paddingHorizontal: Spacing.xl,
    },
    composerWide: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 940,
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
      // Liste inversée : son axe est retourné, donc « flex-start » place bien
      // le contenu EN BAS à l'écran. Avec « flex-end », un fil de deux messages
      // se serait collé en haut, sous l'en-tête, avec un grand vide au-dessus
      // de la saisie.
      justifyContent: 'flex-start',
    },
    listWide: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 940,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
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
