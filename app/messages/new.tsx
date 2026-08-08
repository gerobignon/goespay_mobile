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
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../src/constants/theme';
import { useMessagingStore } from '../../src/stores/messagingStore';
import { messagingService } from '../../src/services/messagingService';
import { ChatAvatar } from '../../src/components/chat/ChatAvatar';
import type { PeerCard } from '../../src/types';

const SEARCH_DEBOUNCE_MS = 400;

/**
 * Démarrer une conversation.
 *
 * Deux chemins, et un seul principe : personne n'apparaît sans l'avoir voulu.
 *  - Les personnes déjà liées (filleuls, parrain, transferts) sont listées :
 *    leur nom est déjà connu, le masquer ne protégerait rien. Écrire demande
 *    quand même une invitation tant qu'elles ne l'ont pas acceptée.
 *  - La recherche ne remonte que les comptes qui ont choisi de figurer dans
 *    l'annuaire. Pour tous les autres, on envoie une invitation à l'aveugle :
 *    l'écran ne dit jamais si le compte existe.
 */
export default function NewConversationScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { isWide } = useResponsive();
  const { t } = useTranslation();
  const openDirect = useMessagingStore((s) => s.openDirect);

  const [known, setKnown] = useState<PeerCard[]>([]);
  const [results, setResults] = useState<PeerCard[]>([]);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [loadingKnown, setLoadingKnown] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagingService
      .getContacts()
      .then(setKnown)
      .catch(() => {})
      .finally(() => setLoadingKnown(false));
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

  /** Ami : on ouvre le fil. Sinon : on invite. */
  const act = async (peer: PeerCard) => {
    if (peer.relation !== 'friend') {
      await sendInvite(peer.id.toString(), peer.name);
      return;
    }
    setBusyId(peer.id);
    try {
      const id = await openDirect(peer.id);
      router.replace(`/messages/${id}`);
    } catch (e: any) {
      showAlert(
        t('common.error', 'Erreur'),
        e?.response?.data?.error || t('messages.openFailed', 'Conversation impossible.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  const sendInvite = async (identifier: string, label?: string) => {
    setInviting(true);
    try {
      const message = await messagingService.invite(identifier, note);
      setNote('');
      setQuery('');
      showAlert(t('messages.inviteSentTitle', 'Invitation envoyée'), message);
    } catch (e: any) {
      showAlert(
        t('common.error', 'Erreur'),
        e?.response?.data?.error || t('messages.actionFailed', 'Action impossible.'),
      );
    } finally {
      setInviting(false);
    }
  };

  const sourceLabel = (peer: PeerCard) => {
    if (peer.source === 'referral') return t('messages.sourceReferral', 'Filleul');
    if (peer.source === 'sponsor') return t('messages.sourceSponsor', 'Parrain');
    return t('messages.sourceTransfer', 'Transfert');
  };

  const renderPeer = (peer: PeerCard, index: number, withSource: boolean) => {
    const isFriend = peer.relation === 'friend';

    return (
      <Reveal key={peer.id} delay={index * 35} offset={10}>
        <Bounce style={styles.row} scaleTo={0.985} onPress={() => act(peer)}>
          <ChatAvatar name={peer.name} uri={peer.avatar} online={peer.online} size={46} />
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.rowName} numberOfLines={1}>{peer.name}</Text>
              {peer.verified && <FontAwesome6 name="circle-check" size={12} color={colors.positive} />}
            </View>
            <Text style={styles.rowMeta} numberOfLines={1}>
              #{peer.id}
              {peer.country ? ` · ${peer.country}` : ''}
              {withSource && peer.source ? ` · ${sourceLabel(peer)}` : ''}
            </Text>
          </View>

          {busyId === peer.id || (inviting && !isFriend) ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <View
              style={[
                styles.rowTag,
                { backgroundColor: withAlpha(isFriend ? colors.primary : colors.secondary, 0.16) },
              ]}
            >
              <FontAwesome6
                name={isFriend ? 'message' : 'user-plus'}
                size={12}
                color={isFriend ? colors.primary : colors.secondary}
              />
              <Text
                style={[styles.rowTagText, { color: isFriend ? colors.primary : colors.secondary }]}
              >
                {isFriend ? t('messages.write', 'Écrire') : t('messages.invite', 'Inviter')}
              </Text>
            </View>
          )}
        </Bounce>
      </Reveal>
    );
  };

  const searchingNow = query.trim().length >= 2;
  const canInviteRaw = query.trim().length >= 2 && !searching;

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
            placeholder={t('messages.searchPlaceholder', 'Identifiant, code, email, téléphone')}
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

        {searchingNow && (
          <>
            {searching ? (
              <ActivityIndicator style={{ marginTop: Spacing.lg }} color={colors.text} />
            ) : (
              <>
                {results.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>{t('messages.results', 'Résultats')}</Text>
                    <View style={styles.list}>{results.map((p, i) => renderPeer(p, i, false))}</View>
                  </>
                ) : (
                  // Formulé sans mentir : l'absence de résultat ne prouve pas
                  // l'absence de compte — un compte hors annuaire ne sort
                  // jamais d'une recherche, et c'est exactement le but.
                  <View style={styles.noResult}>
                    <FontAwesome6 name="user-slash" size={18} color={colors.textMuted} />
                    <Text style={styles.noResultText}>
                      {t('messages.noResult', 'Aucun compte visible pour cette recherche.')}
                    </Text>
                    <Text style={styles.noResultHint}>
                      {t(
                        'messages.noResultHint',
                        'Le compte existe peut-être sans figurer dans la recherche. Envoyez-lui une invitation ci-dessous.',
                      )}
                    </Text>
                  </View>
                )}

                {/* Invitation à l'aveugle : proposée quoi qu'il arrive, y compris
                    sans résultat. C'est ce qui empêche de déduire l'existence
                    d'un compte de la présence ou non d'un bouton. */}
                <View style={styles.inviteCard}>
                  <Text style={styles.inviteTitle}>{t('messages.inviteTitle', 'Inviter à discuter')}</Text>
                  {/* Le texte dépend de ce que l'écran montre déjà : annoncer
                      qu'on ignore si le compte existe n'a aucun sens quand il
                      est affiché juste au-dessus. */}
                  <Text style={styles.inviteHint}>
                    {results.length > 0
                      ? t(
                          'messages.inviteHintFound',
                          'Votre invitation part vers cet identifiant, avec le mot que vous écrivez ici.',
                        )
                      : t(
                          'messages.inviteHint',
                          'Votre invitation part vers cet identifiant. Vous ne saurez pas s’il correspond à un compte tant que la personne n’a pas accepté.',
                        )}
                  </Text>
                  <TextInput
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder={t('messages.notePlaceholder', 'Un mot pour vous présenter (facultatif)')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={280}
                  />
                  <TouchableOpacity
                    style={[
                      styles.inviteBtn,
                      { backgroundColor: canInviteRaw ? colors.primary : withAlpha(colors.textMuted, 0.25) },
                    ]}
                    onPress={() => sendInvite(query.trim())}
                    disabled={!canInviteRaw || inviting}
                  >
                    {inviting ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.inviteBtnText}>{t('messages.sendInvite', 'Envoyer l’invitation')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}

        {!searchingNow && (
          <>
            <Text style={styles.sectionTitle}>{t('messages.knownPeople', 'Personnes que vous connaissez')}</Text>
            {loadingKnown ? (
              <ActivityIndicator style={{ marginTop: Spacing.md }} color={colors.text} />
            ) : known.length === 0 ? (
              <Text style={styles.emptyText}>
                {t('messages.noKnown', 'Personne pour le moment. Utilisez la recherche ci-dessus.')}
              </Text>
            ) : (
              <View style={styles.list}>{known.map((p, i) => renderPeer(p, i, true))}</View>
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
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.xl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    title: { fontFamily: Fonts.bold, fontSize: FontSize.xl, color: Colors.text },
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
    list: { gap: Spacing.sm },
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
    rowBody: { flex: 1, minWidth: 0 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
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
    rowTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: 6,
      borderRadius: BorderRadius.pill,
    },
    rowTagText: { fontFamily: Fonts.semiBold, fontSize: FontSize.xs },
    noResult: {
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.md,
    },
    noResultText: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.md,
      color: Colors.text,
      textAlign: 'center',
    },
    noResultHint: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.sm * 1.45,
    },
    inviteCard: {
      marginTop: Spacing.lg,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
    },
    inviteTitle: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: Colors.text },
    inviteHint: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
      marginTop: 4,
      lineHeight: FontSize.xs * 1.5,
    },
    noteInput: {
      marginTop: Spacing.md,
      minHeight: 64,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm + 2,
      color: Colors.text,
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      textAlignVertical: 'top',
    },
    inviteBtn: {
      marginTop: Spacing.md,
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.sm + 4,
      alignItems: 'center',
    },
    inviteBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: '#fff' },
    emptyText: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.md,
    },
  });
