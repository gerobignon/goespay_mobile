import React, { useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useColors } from '../ThemeProvider';
import type { ChatMessage } from '../../types';
import { messageTime } from './chatFormat';

/** Distance de balayage au-delà de laquelle la citation se déclenche. */
const SWIPE_TRIGGER = 56;

interface MessageBubbleProps {
  message: ChatMessage;
  /** Dernier message lu par l'interlocuteur → coche double sur mes bulles. */
  peerReadId: number;
  onPressImage: (uri: string) => void;
  onRetry: (tempId: number) => void;
  /** Balayage gauche/droite sur la bulle → citer ce message. */
  onQuote?: (message: ChatMessage) => void;
  /** Toucher sur le bloc cité → remonter au message d'origine. */
  onPressReply?: (messageId: number) => void;
  /** Mise en évidence passagère, après être remonté jusqu'ici. */
  highlighted?: boolean;
}

/**
 * Bulle d'un message. Trois états visuels côté émetteur : en cours d'envoi,
 * envoyé, lu — l'échec reste affiché et réessayable plutôt que de disparaître.
 *
 * Un balayage horizontal cite le message, dans les deux sens : sur un fil, la
 * main tombe indifféremment à gauche ou à droite selon le côté de la bulle.
 */
export function MessageBubble({
  message,
  peerReadId,
  onPressImage,
  onRetry,
  onQuote,
  onPressReply,
  highlighted,
}: MessageBubbleProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { t } = useTranslation();
  const tx = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      // Horizontal franc uniquement : sinon on volerait le défilement du fil.
      onMoveShouldSetPanResponder: (_, g) =>
        !!onQuote && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_, g) => {
        tx.setValue(Math.max(-96, Math.min(96, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const triggered = Math.abs(g.dx) >= SWIPE_TRIGGER;
        Animated.spring(tx, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
        if (triggered && onQuote) onQuote(message);
      },
      onPanResponderTerminate: () => {
        Animated.spring(tx, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
      },
    }),
  ).current;

  if (message.is_system) {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{message.body}</Text>
      </View>
    );
  }

  const mine = message.mine;
  const image = message.localImage || message.attachment?.thumb || message.attachment?.url || null;
  const fullImage = message.attachment?.url || message.localImage || null;
  const read = mine && message.id > 0 && peerReadId >= message.id;

  /**
   * Le fond d'une bulle sortante raconte son avancement, sans qu'on ait à lire
   * la coche : gris tant qu'il part, couleur atténuée une fois chez le serveur,
   * pleine couleur quand l'autre l'a lu.
   */
  const mineBackground = message.pending
    ? withAlpha(colors.textMuted, 0.28)
    : read
      ? colors.primary
      : withAlpha(colors.primary, 0.55);

  return (
    <Animated.View
      style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, { transform: [{ translateX: tx }] }]}
      {...pan.panHandlers}
    >
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: mineBackground, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
          message.failed && { backgroundColor: withAlpha(colors.error, 0.25) },
          // Signet : la bulle s'entoure brièvement quand on vient d'y remonter.
          highlighted && { borderWidth: 2, borderColor: colors.secondary },
        ]}
      >
        {/* Message cité : bloc distinct au-dessus du corps, et non plus recopié
            dans le texte. Le toucher ramène au message d'origine. */}
        {!!message.reply_to && (
          <TouchableOpacity
            style={[
              styles.reply,
              {
                backgroundColor: mine ? withAlpha(colors.black, 0.18) : withAlpha(colors.text, 0.06),
                borderLeftColor: mine ? colors.white : colors.secondary,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => onPressReply?.(message.reply_to!.id)}
            disabled={!onPressReply}
          >
            <Text
              style={[styles.replyAuthor, { color: mine ? colors.white : colors.secondary }]}
              numberOfLines={1}
            >
              {message.reply_to.author}
            </Text>
            <Text
              style={[styles.replyBody, { color: mine ? withAlpha(colors.white, 0.85) : colors.textMuted }]}
              numberOfLines={2}
            >
              {message.reply_to.body || (message.reply_to.photo ? t('messages.photo', 'Photo') : '')}
            </Text>
          </TouchableOpacity>
        )}

        {!!image && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => fullImage && onPressImage(fullImage)}
            disabled={!fullImage}
          >
            <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
          </TouchableOpacity>
        )}

        {!!message.body && (
          <Text style={[styles.text, { color: mine ? colors.white : colors.text }]}>{message.body}</Text>
        )}

        <View style={styles.meta}>
          <Text style={[styles.time, { color: mine ? withAlpha(colors.white, 0.75) : colors.textMuted }]}>
            {messageTime(message.created_at)}
          </Text>

          {mine && message.pending && <ActivityIndicator size="small" color={withAlpha(colors.white, 0.8)} />}

          {mine && !message.pending && !message.failed && (
            <FontAwesome6
              name={read ? 'check-double' : 'check'}
              size={11}
              color={read ? colors.positive : withAlpha(colors.white, 0.75)}
            />
          )}

          {mine && message.failed && (
            <TouchableOpacity style={styles.retry} onPress={() => onRetry(message.id)}>
              <FontAwesome6 name="rotate-right" size={11} color={colors.error} />
              <Text style={[styles.retryText, { color: colors.error }]}>
                {t('messages.retry', 'Réessayer')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      marginBottom: Spacing.sm,
    },
    rowMine: { justifyContent: 'flex-end' },
    rowTheirs: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '82%',
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
    },
    text: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.md,
      lineHeight: FontSize.md * 1.4,
    },
    reply: {
      borderLeftWidth: 3,
      borderRadius: 8,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      marginBottom: Spacing.xs,
    },
    replyAuthor: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.xs,
    },
    replyBody: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      marginTop: 1,
    },
    image: {
      width: 220,
      height: 165,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.xs,
      backgroundColor: Colors.surface,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: Spacing.xs,
      marginTop: 3,
    },
    time: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.xs,
    },
    retry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    retryText: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.xs,
    },
    systemWrap: {
      alignItems: 'center',
      marginVertical: Spacing.sm,
    },
    systemText: {
      fontFamily: Fonts.medium,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
      backgroundColor: Colors.surface,
      paddingHorizontal: Spacing.md,
      paddingVertical: 5,
      borderRadius: BorderRadius.pill,
      overflow: 'hidden',
    },
  });
