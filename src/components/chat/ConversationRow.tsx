import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BorderRadius, FontSize, Fonts, Spacing, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useColors } from '../ThemeProvider';
import { Bounce } from '../anim';
import type { Conversation } from '../../types';
import { ChatAvatar } from './ChatAvatar';
import { shortAgo } from './chatFormat';

/** Une conversation dans la liste : interlocuteur, dernier message, non-lus. */
export function ConversationRow({
  conversation,
  onPress,
  onLongPress,
  onPressAvatar,
}: {
  conversation: Conversation;
  onPress: () => void;
  /** Menu d'options de la conversation. */
  onLongPress?: () => void;
  /** Agrandissement de la photo de profil. */
  onPressAvatar?: (uri: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { t } = useTranslation();

  const isSupport = conversation.type === 'support';
  const unread = conversation.unread_count;
  const avatar = conversation.avatar;

  return (
    <Bounce style={styles.row} scaleTo={0.985} onPress={onPress} onLongPress={onLongPress}>
      {/* La photo répond au toucher pour elle-même : on la regarde sans ouvrir
          la conversation. Sans photo, le toucher retombe sur la ligne. */}
      <Pressable
        onPress={avatar && onPressAvatar ? () => onPressAvatar(avatar) : onPress}
        onLongPress={onLongPress}
        hitSlop={4}
      >
        <ChatAvatar
          name={conversation.title}
          uri={avatar}
          isSupport={isSupport}
          online={conversation.peer?.online}
          size={50}
        />
      </Pressable>

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={[styles.title, unread > 0 && styles.titleUnread]} numberOfLines={1}>
            {isSupport ? t('messages.supportTitle', 'Support GoesPay') : conversation.title}
          </Text>
          {/* Signalé par moi : le drapeau reste tant que le fil existe, pour
              qu'on sache à qui on parle sans rouvrir la fiche. */}
          {conversation.peer?.reported_by_me && (
            <FontAwesome6 name="flag" size={11} color={colors.error} />
          )}
          <Text style={styles.time}>{shortAgo(conversation.last_message_at, t)}</Text>
        </View>

        <View style={styles.bottomLine}>
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {conversation.peer_typing
              ? t('messages.typing', 'écrit…')
              : conversation.preview || t('messages.noMessage', 'Aucun message')}
          </Text>

          {conversation.muted && (
            <FontAwesome6 name="bell-slash" size={11} color={colors.textMuted} />
          )}

          {unread > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Bounce>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    topLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    title: {
      flex: 1,
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.md,
      color: Colors.text,
    },
    titleUnread: {
      fontFamily: Fonts.bold,
    },
    time: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
    },
    bottomLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: 2,
    },
    preview: {
      flex: 1,
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
    },
    previewUnread: {
      color: Colors.text,
      fontFamily: Fonts.medium,
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      color: '#fff',
      fontFamily: Fonts.bold,
      fontSize: 10,
    },
  });
