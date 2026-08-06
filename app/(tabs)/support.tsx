import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
  ActivityIndicator,
  AppState,
} from 'react-native';

import { useRouter, useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { Reveal, Bounce } from '../../src/components/anim';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts, BorderRadius } from '../../src/constants/theme';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTheme } from '../../src/components/ThemeProvider';
import { useMessagingStore } from '../../src/stores/messagingStore';
import { ConversationRow } from '../../src/components/chat/ConversationRow';
import { ChatAvatar } from '../../src/components/chat/ChatAvatar';

const open = (url: string) => Linking.openURL(url).catch(() => {});

/** Canaux hors application — conservés en second rideau sous la messagerie. */
const CHANNELS = [
  { icon: 'telegram' as const, brand: true, label: 'Telegram', color: '#0088cc', url: 'https://t.me/goespaay' },
  { icon: 'whatsapp' as const, brand: true, label: 'WhatsApp', color: '#25D366', url: 'https://wa.me/237659939340' },
  { icon: 'envelope' as const, brand: false, label: 'Email', color: Colors.secondary, url: 'mailto:claims@goespay.io' },
  { icon: 'phone' as const, brand: false, label: 'Téléphone', labelKey: 'support.phone', color: '#ff295b', url: 'tel:+237659939340' },
];

/**
 * Onglet Messages : le fil support en tête, puis les conversations avec les
 * autres clients. Les canaux externes restent accessibles en bas — ils ne sont
 * plus la porte d'entrée, mais le repli quand l'app elle-même pose problème.
 */
export default function MessagesScreen() {
  const router = useRouter();
  const { isWide } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();

  const conversations = useMessagingStore((s) => s.conversations);
  const isLoading = useMessagingStore((s) => s.isLoading);
  const fetchConversations = useMessagingStore((s) => s.fetchConversations);
  const openSupport = useMessagingStore((s) => s.openSupport);

  const [refreshing, setRefreshing] = useState(false);
  const [openingSupport, setOpeningSupport] = useState(false);
  const [showChannels, setShowChannels] = useState(false);

  const support = conversations.find((c) => c.type === 'support') || null;
  const directs = conversations.filter((c) => c.type === 'direct');

  // Rechargement à l'ouverture de l'onglet, puis rafraîchissement régulier tant
  // qu'il est affiché (les push couvrent l'app fermée, pas l'app ouverte).
  // Le mode silencieux est décidé à l'exécution : lié aux dépendances, l'effet
  // se relancerait au premier chargement pour rien.
  useFocusEffect(
    useCallback(() => {
      fetchConversations(useMessagingStore.getState().conversations.length > 0);
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') fetchConversations(true);
      }, 30000);
      return () => clearInterval(timer);
    }, []),
  );

  const refresh = async () => {
    setRefreshing(true);
    await fetchConversations(true);
    setRefreshing(false);
  };

  const goSupport = async () => {
    if (support) {
      router.push(`/messages/${support.id}`);
      return;
    }
    setOpeningSupport(true);
    const id = await openSupport();
    setOpeningSupport(false);
    if (id) router.push(`/messages/${id}`);
  };

  const SOCIALS = [
    { icon: 'telegram' as const, brand: true, color: Colors.primary, url: 'https://t.me/goespay' },
    { icon: 'whatsapp' as const, brand: true, color: '#25D366', url: 'https://wa.me/237659939340' },
    { icon: 'facebook-f' as const, brand: true, color: Colors.primary, url: 'http://fb.me/goespaay' },
    { icon: 'instagram' as const, brand: true, color: '#E1306C', url: 'http://instagram.com/goespaay' },
    { icon: 'x-twitter' as const, brand: true, color: isDark ? '#fff' : '#000', url: 'http://twitter.com/goespaay' },
    { icon: 'youtube' as const, brand: true, color: '#FF0000', url: 'https://youtube.com/channel/UCxooykyhvHYo_zAI1yckRsw/?sub_confirmation=1' },
  ];

  return (
    <ScreenBackground edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isWide && { alignSelf: 'center', width: '100%', maxWidth: 800 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('messages.title', 'Messages')}</Text>
          <View style={styles.headerActions}>
            <Bounce style={styles.headerBtn} onPress={() => router.push('/messages/settings')}>
              <FontAwesome6 name="sliders" size={15} color={colors.text} />
            </Bounce>
            <Bounce
              style={[styles.headerBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => router.push('/messages/new')}
            >
              <FontAwesome6 name="pen" size={14} color={colors.white} />
            </Bounce>
          </View>
        </View>

        {/* Support */}
        <Reveal offset={12}>
          <Bounce style={styles.supportCard} scaleTo={0.985} onPress={goSupport}>
            <ChatAvatar name="Support" isSupport size={50} />
            <View style={styles.supportBody}>
              <Text style={styles.supportTitle}>{t('messages.supportTitle', 'Support GoesPay')}</Text>
              <Text style={styles.supportSub} numberOfLines={1}>
                {support?.preview || t('messages.supportSub', 'Une question ? Écrivez-nous.')}
              </Text>
            </View>
            {openingSupport ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : support && support.unread_count > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.error }]}>
                <Text style={styles.badgeText}>{support.unread_count > 99 ? '99+' : support.unread_count}</Text>
              </View>
            ) : (
              <FontAwesome6 name="arrow-right" size={13} color={colors.textMuted} />
            )}
          </Bounce>
        </Reveal>

        {/* Conversations */}
        <Text style={styles.sectionTitle}>{t('messages.conversations', 'Conversations')}</Text>

        {isLoading && conversations.length === 0 ? (
          <ActivityIndicator style={{ marginTop: Spacing.lg }} color={colors.text} />
        ) : directs.length === 0 ? (
          <View style={styles.empty}>
            <FontAwesome6 name="comments" size={26} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('messages.empty', 'Aucune conversation')}</Text>
            <Bounce
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/messages/new')}
            >
              <Text style={styles.emptyBtnText}>{t('messages.startOne', 'Démarrer une conversation')}</Text>
            </Bounce>
          </View>
        ) : (
          <View style={styles.list}>
            {directs.map((c, i) => (
              <Reveal key={c.id} delay={i * 45} offset={12}>
                <ConversationRow conversation={c} onPress={() => router.push(`/messages/${c.id}`)} />
              </Reveal>
            ))}
          </View>
        )}

        {/* Canaux externes */}
        <TouchableOpacity style={styles.channelsToggle} onPress={() => setShowChannels((v) => !v)}>
          <Text style={styles.channelsToggleText}>{t('messages.otherChannels', 'Autres canaux')}</Text>
          <FontAwesome6 name={showChannels ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textMuted} />
        </TouchableOpacity>

        {showChannels && (
          <View style={styles.channels}>
            {CHANNELS.map((ch) => (
              <Bounce key={ch.label} style={styles.channel} scaleTo={0.97} onPress={() => open(ch.url)}>
                <FontAwesome6 name={ch.icon} size={16} color={ch.color} iconStyle={ch.brand ? 'brands' : 'solid'} />
                <Text style={styles.channelLabel}>{ch.labelKey ? t(ch.labelKey) : ch.label}</Text>
              </Bounce>
            ))}
          </View>
        )}

        {/* Réseaux sociaux */}
        <View style={styles.socialSection}>
          <Text style={styles.socialTitle}>{t('support.followUs')}</Text>
          <View style={styles.socialRow}>
            {SOCIALS.map((s) => (
              <Bounce key={s.url} onPress={() => open(s.url)} style={styles.socialBtn}>
                <FontAwesome6 name={s.icon} size={20} color={s.color} iconStyle="brands" />
              </Bounce>
            ))}
          </View>
        </View>
      </ScrollView>
      <CustomAlert />
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  supportBody: {
    flex: 1,
  },
  supportTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  supportSub: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 1,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  list: {
    gap: Spacing.sm,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  emptyBtn: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.pill,
  },
  emptyBtnText: {
    color: '#fff',
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.sm,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 10,
  },
  channelsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  channelsToggleText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  channels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  channelLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  socialSection: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  socialTitle: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  socialBtn: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
