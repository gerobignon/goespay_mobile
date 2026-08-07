import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useColors } from '../ThemeProvider';
import type { ChatMessage } from '../../types';
import { messageTime } from './chatFormat';

interface MessageBubbleProps {
  message: ChatMessage;
  /** Dernier message lu par l'interlocuteur → coche double sur mes bulles. */
  peerReadId: number;
  onPressImage: (uri: string) => void;
  onRetry: (tempId: number) => void;
}

/**
 * Bulle d'un message. Trois états visuels côté émetteur : en cours d'envoi,
 * envoyé, lu — l'échec reste affiché et réessayable plutôt que de disparaître.
 */
export function MessageBubble({ message, peerReadId, onPressImage, onRetry }: MessageBubbleProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { t } = useTranslation();

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
  const agentName = message.author?.is_agent ? message.author.agent_name : '';
  const read = mine && message.id > 0 && peerReadId >= message.id;

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
          message.failed && { backgroundColor: withAlpha(colors.error, 0.25) },
        ]}
      >
        {!!agentName && <Text style={[styles.agent, { color: colors.secondary }]}>{agentName}</Text>}

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
    </View>
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
    agent: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.xs,
      marginBottom: 2,
    },
    text: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.md,
      lineHeight: FontSize.md * 1.4,
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
