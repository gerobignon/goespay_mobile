import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenBackground } from '../../src/components/ScreenBackground';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useColors } from '../../src/components/ThemeProvider';
import { useResponsive } from '../../src/hooks/useResponsive';
import { BorderRadius, FontSize, Fonts, Spacing, type ColorPalette } from '../../src/constants/theme';
import { useMessagingStore } from '../../src/stores/messagingStore';
import { useAuthStore } from '../../src/stores/authStore';
import { API_BASE_URL } from '../../src/constants/config';
import { messagingService } from '../../src/services/messagingService';
import { ChatAvatar } from '../../src/components/chat/ChatAvatar';
import type { BlockedUser, ChatPrefs, ChatVisibility, VisibilityLevel } from '../../src/types';

/** Réglages de la messagerie : visibilité, premiers contacts, comptes bloqués. */
export default function MessagingSettingsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { isWide } = useResponsive();
  const { t } = useTranslation();

  const user = useAuthStore((s) => s.user);
  const prefs = useMessagingStore((s) => s.prefs);
  const savePrefs = useMessagingStore((s) => s.savePrefs);

  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [visibility, setVisibility] = useState<ChatVisibility | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    messagingService
      .getBlocked()
      .then(setBlocked)
      .catch(() => {})
      .finally(() => setLoading(false));

    messagingService.getVisibility().then(setVisibility).catch(() => {});
  }, []);

  /** Optimiste : le curseur suit le doigt, la sauvegarde suit derrière. */
  const setLevel = (field: keyof ChatVisibility, level: VisibilityLevel) => {
    if (!visibility) return;
    const next = { ...visibility, [field]: level };
    setVisibility(next);
    messagingService.saveVisibility({ [field]: level }).catch(() => setVisibility(visibility));
  };

  const LEVELS: { key: VisibilityLevel; label: string }[] = [
    { key: 'public', label: t('messages.levelPublic', 'Tous') },
    { key: 'friends', label: t('messages.levelFriends', 'Amis') },
    { key: 'private', label: t('messages.levelPrivate', 'Personne') },
  ];

  const fullName = [user?.surname, user?.name].filter(Boolean).join(' ');
  const avatarUri = user?.avatar
    ? user.avatar.startsWith('http')
      ? user.avatar
      : `${API_BASE_URL.replace('/api/mobile/v1', '')}${user.avatar}`
    : null;
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '—';

  /**
   * Chaque réglage montre la valeur qu'il gouverne : on décide de cacher son
   * pays en voyant écrit « BJ », pas en imaginant ce que « Pays » recouvre.
   */
  const FIELDS: { key: keyof ChatVisibility; label: string; preview: React.ReactNode }[] = [
    {
      key: 'name',
      label: t('messages.fieldName', 'Nom'),
      preview: <Text style={styles.preview} numberOfLines={1}>{fullName || '—'}</Text>,
    },
    {
      key: 'avatar',
      label: t('messages.fieldAvatar', 'Photo'),
      preview: <ChatAvatar name={fullName} uri={avatarUri} size={30} />,
    },
    {
      key: 'country',
      label: t('messages.fieldCountry', 'Pays'),
      preview: <Text style={styles.preview}>{user?.country?.toUpperCase() || '—'}</Text>,
    },
    {
      key: 'member_since',
      label: t('messages.fieldSince', 'Ancienneté'),
      preview: <Text style={styles.preview}>{memberSince}</Text>,
    },
    {
      key: 'verified',
      label: t('messages.fieldVerified', 'Identité vérifiée'),
      preview:
        user?.validate === 1 ? (
          <View style={styles.previewTag}>
            <FontAwesome6 name="circle-check" size={11} color={colors.positive} />
            <Text style={[styles.previewTagText, { color: colors.positive }]}>
              {t('messages.verified', 'Identité vérifiée')}
            </Text>
          </View>
        ) : (
          <Text style={styles.preview}>{t('messages.notVerified', 'Non vérifiée')}</Text>
        ),
    },
    {
      key: 'presence',
      label: t('messages.fieldPresence', 'Statut en ligne'),
      preview: (
        <View style={styles.previewTag}>
          <View style={[styles.dot, { backgroundColor: colors.positive }]} />
          <Text style={[styles.previewTagText, { color: colors.positive }]}>
            {t('messages.online', 'En ligne')}
          </Text>
        </View>
      ),
    },
  ];

  const unblock = async (userId: number) => {
    try {
      setBlocked(await messagingService.unblock(userId));
    } catch {
      // La liste reste inchangée : réessayable.
    }
  };

  const toggles: { key: keyof ChatPrefs; label: string; hint: string }[] = [
    {
      key: 'discoverable',
      label: t('messages.prefDiscoverable', 'Apparaître dans la recherche'),
      hint: t('messages.prefDiscoverableHint', 'Les autres peuvent vous trouver par votre nom.'),
    },
    {
      key: 'allow_unknown',
      label: t('messages.prefUnknown', 'Messages d’inconnus'),
      hint: t('messages.prefUnknownHint', 'Recevoir un premier message hors de vos contacts.'),
    },
    {
      key: 'show_presence',
      label: t('messages.prefPresence', 'Statut en ligne'),
      hint: t('messages.prefPresenceHint', 'Montrer quand vous êtes connecté.'),
    },
  ];

  return (
    <ScreenBackground edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isWide && { alignSelf: 'center', width: '100%', maxWidth: 620 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <FontAwesome6 name="arrow-left" size={19} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('messages.settingsTitle', 'Réglages des messages')}</Text>
        </View>

        <View style={styles.card}>
          {toggles.map((item, i) => (
            <View key={item.key} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowHint}>{item.hint}</Text>
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={(v) => savePrefs({ [item.key]: v })}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.white}
              />
            </View>
          ))}
        </View>

        {/* Qui voit quoi de mon profil */}
        <Text style={styles.sectionTitle}>{t('messages.visibilityTitle', 'Qui voit mes informations')}</Text>

        {!visibility ? (
          <ActivityIndicator style={{ marginTop: Spacing.md }} color={colors.text} />
        ) : (
          <View style={styles.card}>
            {FIELDS.map((field, i) => (
              <View key={field.key} style={[styles.visRow, i > 0 && styles.rowDivider]}>
                <View style={styles.visHead}>
                  <Text style={styles.visLabel}>{field.label}</Text>
                  <View style={styles.previewSlot}>{field.preview}</View>
                </View>
                <View style={styles.levels}>
                  {LEVELS.map((level) => {
                    const active = visibility[field.key] === level.key;
                    return (
                      <TouchableOpacity
                        key={level.key}
                        style={[
                          styles.level,
                          active && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setLevel(field.key, level.key)}
                      >
                        <Text style={[styles.levelText, active && { color: '#fff' }]}>{level.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('messages.blockedTitle', 'Comptes bloqués')}</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.md }} color={colors.text} />
        ) : blocked.length === 0 ? (
          <Text style={styles.emptyText}>{t('messages.noBlocked', 'Aucun compte bloqué.')}</Text>
        ) : (
          <View style={styles.list}>
            {blocked.map((b) => (
              <View key={b.id} style={styles.blockedRow}>
                <ChatAvatar name={b.name} uri={b.avatar} size={40} />
                <Text style={styles.blockedName} numberOfLines={1}>{b.name}</Text>
                <TouchableOpacity
                  style={[styles.unblockBtn, { borderColor: colors.border }]}
                  onPress={() => unblock(b.id)}
                >
                  <Text style={styles.unblockText}>{t('messages.unblockShort', 'Débloquer')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <CustomAlert />
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    scroll: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    title: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.xl,
      color: Colors.text,
      flexShrink: 1,
    },
    card: {
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    rowBody: {
      flex: 1,
    },
    rowLabel: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.md,
      color: Colors.text,
    },
    rowHint: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
      marginTop: 2,
    },
    visRow: {
      paddingVertical: Spacing.md - 2,
    },
    visHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    visLabel: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.md,
      color: Colors.text,
      flexShrink: 0,
    },
    previewSlot: {
      flex: 1,
      alignItems: 'flex-end',
      minWidth: 0,
    },
    preview: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      textAlign: 'right',
    },
    previewTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    previewTagText: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.xs,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    levels: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    level: {
      flex: 1,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.pill,
      paddingVertical: 7,
      alignItems: 'center',
    },
    levelText: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
    },
    sectionTitle: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: Spacing.xl,
      marginBottom: Spacing.sm,
    },
    list: {
      gap: Spacing.sm,
    },
    blockedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
    },
    blockedName: {
      flex: 1,
      fontFamily: Fonts.medium,
      fontSize: FontSize.md,
      color: Colors.text,
    },
    unblockBtn: {
      borderWidth: 1,
      borderRadius: BorderRadius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
    },
    unblockText: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.sm,
      color: Colors.text,
    },
    emptyText: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.md,
    },
  });
