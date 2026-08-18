import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenBackground } from '../../../src/components/ScreenBackground';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { showAlert } from '../../../src/stores/alertStore';
import { Bounce } from '../../../src/components/anim';
import { useThemedStyles } from '../../../src/hooks/useThemedStyles';
import { useColors } from '../../../src/components/ThemeProvider';
import { useResponsive } from '../../../src/hooks/useResponsive';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../../src/constants/theme';
import { messagingService } from '../../../src/services/messagingService';
import { useMessagingStore } from '../../../src/stores/messagingStore';
import { ChatAvatar } from '../../../src/components/chat/ChatAvatar';
import { presenceLabel } from '../../../src/components/chat/chatFormat';
import type { PublicProfile, ReportReason } from '../../../src/types';

const REASONS: ReportReason[] = ['scam', 'spam', 'harassment', 'other'];

/**
 * Fiche publique d'un client : de quoi reconnaître un interlocuteur (nom,
 * pays, ancienneté, KYC) et agir sur lui (écrire, bloquer, signaler). Ni
 * email, ni téléphone, ni montant — le serveur ne les envoie pas.
 */
export default function PeerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { isWide } = useResponsive();
  const { t } = useTranslation();
  const openDirect = useMessagingStore((s) => s.openDirect);
  const fetchConversations = useMessagingStore((s) => s.fetchConversations);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('scam');
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (!userId) return;
    messagingService
      .getProfile(userId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId]);

  const message = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const convId = profile.conversation_id || (await openDirect(profile.id));
      router.replace(`/messages/${convId}`);
    } catch (e: any) {
      showAlert(
        t('common.error', 'Erreur'),
        e?.response?.data?.error || t('messages.openFailed', 'Conversation impossible.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = () => {
    if (!profile) return;
    const blocking = !profile.blocked_by_me;

    const apply = async () => {
      setBusy(true);
      try {
        if (blocking) await messagingService.block(profile.id);
        else await messagingService.unblock(profile.id);
        setProfile({ ...profile, blocked_by_me: blocking });
        // Bloquer retire le fil des deux listes : la liste locale doit suivre.
        fetchConversations(true);
      } catch {
        showAlert(t('common.error', 'Erreur'), t('messages.actionFailed', 'Action impossible.'));
      } finally {
        setBusy(false);
      }
    };

    if (!blocking) {
      apply();
      return;
    }

    showAlert(
      t('messages.blockTitle', 'Bloquer ce compte ?'),
      t('messages.blockBody', 'Vous ne recevrez plus ses messages et il ne recevra plus les vôtres.'),
      [
        { text: t('common.cancel', 'Annuler'), style: 'cancel' },
        { text: t('messages.block', 'Bloquer'), style: 'destructive', onPress: apply },
      ],
    );
  };

  const submitReport = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const msg = await messagingService.report(profile.id, reason, details, profile.conversation_id);
      setReportOpen(false);
      setDetails('');
      setProfile({ ...profile, reported_by_me: true });
      // Le drapeau apparaît aussi dans la liste des fils.
      fetchConversations(true);
      showAlert(t('messages.reportSentTitle', 'Signalement envoyé'), msg);
    } catch (e: any) {
      showAlert(
        t('common.error', 'Erreur'),
        e?.response?.data?.error || t('messages.actionFailed', 'Action impossible.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const metaLine = [profile?.name_hidden ? null : profile ? `#${profile.id}` : null, profile?.country]
    .filter(Boolean)
    .join(' · ');

  const memberSince = profile?.member_since
    ? new Date(profile.member_since).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '';

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
          <Text style={styles.title}>{t('messages.profileTitle', 'Profil')}</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.text} />
        ) : !profile ? (
          <Text style={styles.emptyText}>{t('messages.profileMissing', 'Compte introuvable.')}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <ChatAvatar
                name={profile.name}
                uri={profile.avatar}
                online={profile.online}
                size={84}
                hidden={!!profile.name_hidden}
              />
              <View style={styles.nameRow}>
                {profile.name_hidden && (
                  <FontAwesome6 name="eye-slash" size={13} color={colors.textMuted} />
                )}
                <Text style={styles.name}>
                  {profile.name_hidden ? `#${profile.id}` : profile.name}
                </Text>
              </View>
              {/* Nom masqué : l'identifiant tient déjà lieu de titre, le répéter
                  ici donnerait trois fois la même chose. */}
              {!!metaLine && <Text style={styles.meta}>{metaLine}</Text>}
              {!!presenceLabel(profile.online, profile.last_seen_at, t) && (
                <Text style={[styles.presence, profile.online && { color: colors.positive }]}>
                  {presenceLabel(profile.online, profile.last_seen_at, t)}
                </Text>
              )}

              <View style={styles.tags}>
                {profile.verified && (
                  <View style={[styles.tag, { backgroundColor: withAlpha(colors.positive, 0.15) }]}>
                    <FontAwesome6 name="circle-check" size={11} color={colors.positive} />
                    <Text style={[styles.tagText, { color: colors.positive }]}>
                      {t('messages.verified', 'Identité vérifiée')}
                    </Text>
                  </View>
                )}
                {profile.reported_by_me && (
                  <View style={[styles.tag, { backgroundColor: withAlpha(colors.error, 0.15) }]}>
                    <FontAwesome6 name="flag" size={11} color={colors.error} />
                    <Text style={[styles.tagText, { color: colors.error }]}>
                      {t('messages.reported', 'Signalé')}
                    </Text>
                  </View>
                )}
                {profile.is_contact && (
                  <View style={[styles.tag, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
                    <FontAwesome6 name="user-check" size={11} color={colors.primary} />
                    <Text style={[styles.tagText, { color: colors.primary }]}>
                      {t('messages.contact', 'Contact')}
                    </Text>
                  </View>
                )}
              </View>

              {!!memberSince && (
                <Text style={styles.since}>
                  {t('messages.memberSince', 'Membre depuis')} {memberSince}
                </Text>
              )}
            </View>

            <Bounce
              style={[styles.primaryBtn, { backgroundColor: colors.primary }, busy && { opacity: 0.6 }]}
              onPress={message}
              disabled={busy || profile.blocked_by_me}
            >
              <FontAwesome6 name="message" size={15} color={colors.white} />
              <Text style={styles.primaryBtnText}>{t('messages.sendMessage', 'Envoyer un message')}</Text>
            </Bounce>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionRow} onPress={toggleBlock} disabled={busy}>
                <FontAwesome6
                  name={profile.blocked_by_me ? 'unlock' : 'ban'}
                  size={14}
                  color={profile.blocked_by_me ? colors.text : colors.error}
                />
                <Text style={[styles.actionText, !profile.blocked_by_me && { color: colors.error }]}>
                  {profile.blocked_by_me
                    ? t('messages.unblock', 'Débloquer ce compte')
                    : t('messages.block', 'Bloquer')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionRow} onPress={() => setReportOpen(true)} disabled={busy}>
                <FontAwesome6 name="flag" size={14} color={colors.error} />
                <Text style={[styles.actionText, { color: colors.error }]}>
                  {t('messages.report', 'Signaler')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Signalement */}
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('messages.reportTitle', 'Signaler ce compte')}</Text>

            <View style={styles.reasons}>
              {REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.reason,
                    reason === r && { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, 0.12) },
                  ]}
                  onPress={() => setReason(r)}
                >
                  <Text style={[styles.reasonText, reason === r && { color: colors.primary }]}>
                    {t(`messages.reason_${r}`, r)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reportInput}
              value={details}
              onChangeText={setDetails}
              placeholder={t('messages.reportDetails', 'Précisez (facultatif)')}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setReportOpen(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Annuler')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, { backgroundColor: colors.error }, busy && { opacity: 0.6 }]}
                onPress={submitReport}
                disabled={busy}
              >
                <Text style={styles.modalSubmitText}>{t('messages.reportSend', 'Signaler')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    card: {
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      gap: 4,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    name: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.lg,
      color: Colors.text,
      textAlign: 'center',
    },
    meta: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
    },
    presence: {
      fontFamily: Fonts.medium,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      justifyContent: 'center',
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: Spacing.md,
      paddingVertical: 5,
      borderRadius: BorderRadius.pill,
    },
    tagText: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.xs,
    },
    since: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
      marginTop: Spacing.sm,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.md,
      marginTop: Spacing.lg,
    },
    primaryBtnText: {
      color: '#fff',
      fontFamily: Fonts.bold,
      fontSize: FontSize.md,
    },
    actions: {
      marginTop: Spacing.lg,
      gap: Spacing.sm,
    },
    actionRow: {
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
    actionText: {
      fontFamily: Fonts.medium,
      fontSize: FontSize.md,
      color: Colors.text,
    },
    emptyText: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.xl,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: Colors.cardSolid,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.lg,
    },
    modalTitle: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.lg,
      color: Colors.text,
      marginBottom: Spacing.md,
    },
    reasons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    reason: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    reasonText: {
      fontFamily: Fonts.medium,
      fontSize: FontSize.sm,
      color: Colors.text,
    },
    reportInput: {
      marginTop: Spacing.md,
      minHeight: 80,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      color: Colors.text,
      fontFamily: Fonts.regular,
      fontSize: FontSize.md,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    modalCancel: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm + 2,
      borderRadius: BorderRadius.pill,
    },
    modalCancelText: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.md,
      color: Colors.textMuted,
    },
    modalSubmit: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm + 2,
      borderRadius: BorderRadius.pill,
    },
    modalSubmitText: {
      color: '#fff',
      fontFamily: Fonts.bold,
      fontSize: FontSize.md,
    },
  });
