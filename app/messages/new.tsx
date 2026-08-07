import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenBackground } from '../../src/components/ScreenBackground';
import { CustomAlert } from '../../src/components/CustomAlert';
import { showAlert } from '../../src/stores/alertStore';
import { Bounce, Reveal } from '../../src/components/anim';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useColors } from '../../src/components/ThemeProvider';
import { useResponsive } from '../../src/hooks/useResponsive';
import { BorderRadius, FontSize, Fonts, Spacing, type ColorPalette } from '../../src/constants/theme';
import { useMessagingStore } from '../../src/stores/messagingStore';
import { messagingService } from '../../src/services/messagingService';
import { ChatAvatar } from '../../src/components/chat/ChatAvatar';
import type { PeerCard } from '../../src/types';

const SEARCH_DEBOUNCE_MS = 400;

/**
 * Démarrer une conversation : les contacts déjà liés d'abord (un transfert ou
 * un parrainage vaut présentation), la recherche ensuite pour tout le reste.
 */
export default function NewConversationScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { isWide } = useResponsive();
  const { t } = useTranslation();
  const openDirect = useMessagingStore((s) => s.openDirect);

  const [contacts, setContacts] = useState<PeerCard[]>([]);
  const [results, setResults] = useState<PeerCard[]>([]);
  const [query, setQuery] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searching, setSearching] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagingService
      .getContacts()
      .then(setContacts)
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, []);

  // Recherche différée : on interroge l'annuaire quand la frappe s'arrête, pas
  // à chaque caractère (la route est limitée en fréquence côté serveur).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        setResults(await messagingService.search(q));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const start = async (peer: PeerCard) => {
    setOpeningId(peer.id);
    try {
      const id = await openDirect(peer.id);
      router.replace(`/messages/${id}`);
    } catch (e: any) {
      showAlert(
        t('common.error', 'Erreur'),
        e?.response?.data?.error || t('messages.openFailed', 'Conversation impossible.'),
      );
    } finally {
      setOpeningId(null);
    }
  };

  const sourceLabel = (source?: string) => {
    if (source === 'referral') return t('messages.sourceReferral', 'Filleul');
    if (source === 'sponsor') return t('messages.sourceSponsor', 'Parrain');
    return t('messages.sourceTransfer', 'Transfert');
  };

  const renderPeer = (peer: PeerCard, index: number, withSource: boolean) => (
    <Reveal key={peer.id} delay={index * 35} offset={10}>
      <Bounce style={styles.row} scaleTo={0.985} onPress={() => start(peer)}>
        <ChatAvatar name={peer.name} uri={peer.avatar} online={peer.online} size={46} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>{peer.name}</Text>
            {peer.verified && <FontAwesome6 name="circle-check" size={12} color={colors.positive} />}
          </View>
          <Text style={styles.rowMeta} numberOfLines={1}>
            #{peer.id}
            {peer.country ? ` · ${peer.country}` : ''}
            {withSource && peer.source ? ` · ${sourceLabel(peer.source)}` : ''}
          </Text>
        </View>
        {openingId === peer.id ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : (
          <FontAwesome6 name="message" size={14} color={colors.textMuted} />
        )}
      </Bounce>
    </Reveal>
  );

  const searching2 = query.trim().length >= 2;

  return (
    <ScreenBackground edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isWide && { alignSelf: 'center', width: '100%', maxWidth: 760 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <FontAwesome6 name="arrow-left" size={19} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('messages.newTitle', 'Nouveau message')}</Text>
        </View>

        <View style={styles.searchBox}>
          <FontAwesome6 name="magnifying-glass" size={14} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('messages.searchPlaceholder', 'Nom, identifiant, code, email, téléphone')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <FontAwesome6 name="xmark" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {searching2 ? (
          <>
            <Text style={styles.sectionTitle}>{t('messages.results', 'Résultats')}</Text>
            {searching ? (
              <ActivityIndicator style={{ marginTop: Spacing.md }} color={colors.text} />
            ) : results.length === 0 ? (
              <Text style={styles.emptyText}>{t('messages.noResult', 'Aucun compte trouvé.')}</Text>
            ) : (
              <View style={styles.list}>{results.map((p, i) => renderPeer(p, i, false))}</View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t('messages.contacts', 'Contacts')}</Text>
            {loadingContacts ? (
              <ActivityIndicator style={{ marginTop: Spacing.md }} color={colors.text} />
            ) : contacts.length === 0 ? (
              <Text style={styles.emptyText}>
                {t('messages.noContact', 'Aucun contact pour le moment. Utilisez la recherche.')}
              </Text>
            ) : (
              <View style={styles.list}>{contacts.map((p, i) => renderPeer(p, i, true))}</View>
            )}
          </>
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
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      height: 46,
    },
    searchInput: {
      flex: 1,
      color: Colors.text,
      fontFamily: Fonts.regular,
      fontSize: FontSize.md,
      height: '100%',
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
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    rowName: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.md,
      color: Colors.text,
      flexShrink: 1,
    },
    rowMeta: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
      marginTop: 1,
    },
    emptyText: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.md,
    },
  });
