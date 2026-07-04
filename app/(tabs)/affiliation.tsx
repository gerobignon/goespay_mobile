import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ImageBackground,
  Share,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Button } from '../../src/components/Button';
import { Reveal, Bounce } from '../../src/components/anim';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useAuthStore } from '../../src/stores/authStore';
import { useWalletStore } from '../../src/stores/walletStore';
import { showAlert } from '../../src/stores/alertStore';
import { CustomAlert } from '../../src/components/CustomAlert';
import { affiliationService } from '../../src/services/affiliationService';
import { formatAmount, formatDate, useFormatXof, useCurrencyCode } from '../../src/utils/format';
import type { AffiliationStats, AffiliationChild, AffiliationHistoryItem, WelcomeBonus } from '../../src/types';

const REFERRAL_BASE_URL = 'https://goespay.io';
// Vrai code parrainage = 4-32 car. [A-Z0-9] (auto 5 car. + codes perso admin) →
// lien court goespay.io/<CODE>. Repli numérique (id) → forme longue ?ref=.
const isShortCode = (c: string) => /^[A-Z0-9]{4,32}$/.test(c);

// Mots réservés (collision avec une route/page goespay.io via le lien court
// goespay.io/<CODE>). Doit rester aligné avec isReservedReferalCode() backend.
const RESERVED_CODES = new Set([
  'ADMIN', 'BACKEND', 'API', 'REGISTER', 'LOGIN', 'LOGOUT', 'SIGNUP', 'SIGNIN',
  'CONTACT', 'BLOG', 'PAYS', 'TARIFS', 'ERROR', 'MAINTENANCE', 'ABOUT',
  'STORAGE', 'THEMES', 'PLUGINS', 'MODULES', 'VENDOR', 'CONFIG', 'BOOTSTRAP',
  'WWW', 'APP', 'MAIL', 'FTP', 'ROOT', 'NULL', 'TRUE', 'FALSE',
  'GOESPAY', 'SUPPORT', 'HELP', 'HOME', 'ME', 'USER', 'USERS', 'ACCOUNT',
  'WALLET', 'CRYPTO', 'KYC', 'DASHBOARD', 'AFFILIATION', 'REFERRAL',
]);

// Masque un nom complet en gardant la 1ère et dernière lettre de chaque mot.
// Ex: "Erol Bignon" → "E**l B****n", "Jo" → "J*", "X" → "X"
function maskName(full?: string | null): string {
  if (!full) return '';
  return full
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (w.length <= 1) return w;
      if (w.length === 2) return w[0] + '*';
      return w[0] + '*'.repeat(Math.max(1, w.length - 2)) + w[w.length - 1];
    })
    .join(' ');
}

export default function AffiliationScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const currencyCode = useCurrencyCode();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);

  const [stats, setStats] = useState<AffiliationStats | null>(null);
  const [bonus, setBonus] = useState<WelcomeBonus | null>(null);
  const [children, setChildren] = useState<AffiliationChild[]>([]);
  const [history, setHistory] = useState<AffiliationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [tab, setTab] = useState<'children' | 'history'>('children');
  const [editing, setEditing] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [savingCode, setSavingCode] = useState(false);

  const referralCode = stats?.referral_code || (user?.id ? String(user.id) : '');
  const referralLink = referralCode
    ? (isShortCode(referralCode)
        ? `${REFERRAL_BASE_URL}/${referralCode}`
        : `${REFERRAL_BASE_URL}/register?ref=${referralCode}`)
    : '';

  const loadAll = useCallback(async () => {
    try {
      const [s, c, h, b] = await Promise.all([
        affiliationService.getStats(),
        affiliationService.getChildren(1).catch(() => ({ data: [] as AffiliationChild[], current_page: 1, last_page: 1, per_page: 20, total: 0 })),
        affiliationService.getHistory(1).catch(() => ({ data: [] as AffiliationHistoryItem[], current_page: 1, last_page: 1, per_page: 20, total: 0 })),
        affiliationService.getWelcomeBonus().catch(() => null),
      ]);
      setStats(s);
      setChildren(c.data);
      setHistory(h.data);
      setBonus(b);
    } catch {
      showAlert(t('common.error'), t('affiliation.loadError', 'Impossible de charger les données.'));
    }
  }, [t]);

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    showAlert(t('common.success'), t('affiliation.codeCopied', 'Code copié'));
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;
    await Clipboard.setStringAsync(referralLink);
    showAlert(t('common.success'), t('affiliation.linkCopied', 'Lien copié'));
  };

  const handleShare = async () => {
    if (!referralLink) return;
    try {
      await Share.share({
        message: t('affiliation.shareMessage', { link: referralLink, defaultValue: `Rejoins-moi sur GoesPay : ${referralLink}` }),
      });
    } catch {}
  };

  const startEdit = () => {
    // Pré-remplit avec le code court existant, sinon champ vide (repli id numérique).
    setCodeInput(isShortCode(referralCode) ? referralCode : '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setCodeInput('');
  };

  const handleSaveCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!isShortCode(code)) {
      showAlert(t('common.error'), t('affiliation.codeInvalid', 'Code invalide : 4 à 32 caractères, lettres A-Z et chiffres uniquement.'));
      return;
    }
    if (RESERVED_CODES.has(code)) {
      showAlert(t('common.error'), t('affiliation.codeReserved', 'Ce code est réservé. Choisissez-en un autre.'));
      return;
    }
    if (code === referralCode) {
      cancelEdit();
      return;
    }
    setSavingCode(true);
    try {
      const res = await affiliationService.updateCode(code);
      const newCode = res.referral_code || code;
      setStats((prev) => (prev ? { ...prev, referral_code: newCode } : prev));
      if (user) setUser({ ...user, referral_code: newCode });
      setEditing(false);
      setCodeInput('');
      showAlert(t('common.success'), res.message || t('affiliation.codeUpdated', 'Votre code de parrainage a été mis à jour.'));
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || t('common.error');
      showAlert(t('common.error'), msg);
    } finally {
      setSavingCode(false);
    }
  };

  const handleClaim = () => {
    if (!stats || stats.unpayed <= 0) return;
    showAlert(
      t('affiliation.claimTitle', 'Réclamer les commissions'),
      t('affiliation.claimConfirm', { amount: fmtXof(stats.unpayed), defaultValue: `Transférer ${fmtXof(stats.unpayed)} sur votre solde ?` }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('affiliation.claim', 'Réclamer'),
          onPress: async () => {
            setClaiming(true);
            try {
              const res = await affiliationService.claim();
              showAlert(t('common.success'), res.message);
              await Promise.all([loadAll(), fetchBalance()]);
            } catch (e: any) {
              const msg = e?.response?.data?.error || e?.response?.data?.message || t('common.error');
              showAlert(t('common.error'), msg);
            } finally {
              setClaiming(false);
            }
          },
        },
      ]
    );
  };

  const renderBonusProgress = (label: string, current: number, target: number, valueText: string) => {
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const done = current >= target;
    return (
      <View>
        <View style={styles.bonusProgressHead}>
          <Text style={styles.bonusProgressLabel}>{label}</Text>
          <Text style={[styles.bonusProgressValue, done && { color: Colors.success }]}>{valueText}</Text>
        </View>
        <View style={styles.bonusTrack}>
          <View style={[styles.bonusFill, { width: `${pct}%`, backgroundColor: done ? Colors.success : Colors.warning }]} />
        </View>
      </View>
    );
  };

  const headerBlock = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>{t('affiliation.title', 'Parrainage')}</Text>
    </View>
  );

  const content = (
    <>

      {/* Code de parrainage */}
      <View style={styles.formCard}>
        <Text style={styles.sectionLabel}>{t('affiliation.yourCode', 'Votre code de parrainage')}</Text>
        {editing ? (
          <>
            <View style={styles.codeBox}>
              <TextInput
                style={styles.codeInput}
                value={codeInput}
                onChangeText={(v) => setCodeInput(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32))}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={32}
                editable={!savingCode}
                placeholder={t('affiliation.codePlaceholder', 'EX : MONCODE2026')}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <Text style={styles.helperText}>{t('affiliation.codeRules', '4 à 32 caractères, lettres (A-Z) et chiffres uniquement.')}</Text>
            <View style={styles.actionsRow}>
              <Button
                title={t('common.cancel', 'Annuler')}
                variant="outline"
                onPress={cancelEdit}
                disabled={savingCode}
                style={[styles.smallBtn, { flex: 1 }]}
                textStyle={styles.smallBtnText}
              />
              <Button
                title={t('common.save', 'Enregistrer')}
                icon="check"
                onPress={handleSaveCode}
                loading={savingCode}
                style={[styles.smallBtn, { flex: 1 }]}
                textStyle={styles.smallBtnText}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{referralCode || '—'}</Text>
              <Bounce style={styles.inlineIconBtn} onPress={startEdit}>
                <FontAwesome6 name="pen" size={13} color={Colors.primary} />
              </Bounce>
              <Bounce style={styles.inlineIconBtn} onPress={handleCopyCode}>
                <FontAwesome6 name="copy" size={14} color={Colors.primary} />
              </Bounce>
            </View>
            <Text style={styles.helperText}>{t('affiliation.description', 'Partagez ce code ou ce lien avec vos amis. Lorsqu\'ils s\'inscrivent avec, ils deviennent vos filleuls et vous recevez des commissions sur leurs transactions.')}</Text>

            <View style={styles.actionsRow}>
          <Button
            title={t('affiliation.copyLink', 'Copier le lien')}
            icon="link"
            variant="outline"
            onPress={handleCopyLink}
            style={[styles.smallBtn, { flex: 1 }]}
            textStyle={styles.smallBtnText}
          />
          <Button
            title={t('affiliation.share', 'Partager')}
            icon="share-nodes"
            onPress={handleShare}
            style={[styles.smallBtn, { flex: 1 }]}
            textStyle={styles.smallBtnText}
          />
            </View>
          </>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <Reveal delay={0} offset={14} style={styles.statCardWrap}>
          <View style={styles.statCard}>
            <FontAwesome6 name="users" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{stats?.children ?? 0}</Text>
            <Text style={styles.statLabel}>{t('affiliation.filleuls', 'Filleuls')}</Text>
          </View>
        </Reveal>
        <Reveal delay={70} offset={14} style={styles.statCardWrap}>
          <View style={styles.statCard}>
            <FontAwesome6 name="coins" size={16} color={Colors.success} />
            <Text style={styles.statValue}>{fmtXof(stats?.total ?? 0, { withCode: false })}</Text>
            <Text style={styles.statLabel}>{t('affiliation.totalEarned', 'Total gagné')} ({currencyCode})</Text>
          </View>
        </Reveal>
        <Reveal delay={140} offset={14} style={styles.statCardWrap}>
          <View style={styles.statCard}>
            <FontAwesome6 name="hourglass-half" size={16} color={Colors.secondary} />
            <Text style={styles.statValue}>{fmtXof(stats?.unpayed ?? 0, { withCode: false })}</Text>
            <Text style={styles.statLabel}>{t('affiliation.unpayed', 'En attente')} ({currencyCode})</Text>
          </View>
        </Reveal>
        <Reveal delay={210} offset={14} style={styles.statCardWrap}>
          <View style={styles.statCard}>
            <FontAwesome6 name="circle-check" size={16} color={Colors.textMuted} />
            <Text style={styles.statValue}>{fmtXof(stats?.payed ?? 0, { withCode: false })}</Text>
            <Text style={styles.statLabel}>{t('affiliation.payed', 'Reçu')} ({currencyCode})</Text>
          </View>
        </Reveal>
      </View>

      {/* Bonus de bienvenue KYC */}
      {bonus && bonus.state !== 'none' && (
        <Reveal delay={0} offset={14}>
          <View style={styles.bonusCard}>
            <View style={styles.bonusHeader}>
              <View style={styles.bonusIcon}>
                <FontAwesome6 name="gift" size={16} color={Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bonusTitle}>{t('affiliation.bonusTitle', 'Bonus de bienvenue')}</Text>
                <Text style={styles.bonusSubtitle}>
                  {bonus.state === 'unlocked'
                    ? t('affiliation.bonusUnlocked', { amount: fmtXof(bonus.amount), defaultValue: `${fmtXof(bonus.amount)} crédités sur votre solde` })
                    : t('affiliation.bonusBlocked', { amount: fmtXof(bonus.amount), defaultValue: `Débloquez ${fmtXof(bonus.amount)} en remplissant les 2 conditions` })}
                </Text>
              </View>
              <FontAwesome6
                name={bonus.state === 'unlocked' ? 'circle-check' : 'lock'}
                size={16}
                color={bonus.state === 'unlocked' ? Colors.success : Colors.textMuted}
              />
            </View>

            {bonus.state === 'blocked' && (
              <View style={styles.bonusProgressList}>
                {renderBonusProgress(
                  t('affiliation.bonusVolume', 'Volume de transactions'),
                  bonus.volume.current,
                  bonus.volume.target,
                  `${fmtXof(bonus.volume.current, { withCode: false })} / ${fmtXof(bonus.volume.target, { withCode: false })}`,
                )}
                {renderBonusProgress(
                  t('affiliation.bonusFilleuls', 'Filleuls actifs (KYC + 1 transaction)'),
                  bonus.filleuls.current,
                  bonus.filleuls.target,
                  `${bonus.filleuls.current} / ${bonus.filleuls.target}`,
                )}
              </View>
            )}
          </View>
        </Reveal>
      )}

      {/* Claim */}
      {(stats?.unpayed ?? 0) > 0 && (
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>{t('affiliation.claimSection', 'Réclamer mes commissions')}</Text>
          <Text style={styles.helperText}>{t('affiliation.claimHelper', { amount: fmtXof(stats?.unpayed ?? 0), defaultValue: `Vous avez ${fmtXof(stats?.unpayed ?? 0)} de commissions en attente.` })}</Text>
          <Button
            title={t('affiliation.claim', 'Réclamer')}
            icon="wallet"
            onPress={handleClaim}
            loading={claiming}
            style={[styles.smallBtn, { marginTop: Spacing.sm }]}
            textStyle={styles.smallBtnText}
          />
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Bounce
          style={[styles.tabBtn, tab === 'children' && styles.tabBtnActive]}
          scaleTo={0.97}
          onPress={() => setTab('children')}
        >
          <Text style={[styles.tabBtnText, tab === 'children' && styles.tabBtnTextActive]}>
            {t('affiliation.filleuls', 'Filleuls')}
          </Text>
        </Bounce>
        <Bounce
          style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
          scaleTo={0.97}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabBtnText, tab === 'history' && styles.tabBtnTextActive]}>
            {t('affiliation.commissions', 'Commissions')}
          </Text>
        </Bounce>
      </View>

      {/* List */}
      <View style={styles.formCard}>
        {tab === 'children' ? (
          children.length > 0 ? children.map((child) => (
            <View key={child.id} style={styles.entryRow}>
              <View style={styles.entryIcon}>
                <FontAwesome6 name="user" size={14} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>{maskName(child.name) || `#${child.id}`}</Text>
              </View>
              {child.created_at && <Text style={styles.entryDate}>{formatDate(child.created_at)}</Text>}
            </View>
          )) : (
            <Text style={styles.emptyText}>{t('affiliation.noFilleuls', 'Aucun filleul pour le moment.')}</Text>
          )
        ) : (
          history.length > 0 ? history.map((item) => (
            <View key={item.id} style={styles.entryRow}>
              <View style={[styles.entryIcon, { backgroundColor: item.payed === 'yes' ? Colors.success + '22' : Colors.secondary + '22' }]}>
                <FontAwesome6 name={item.payed === 'yes' ? 'circle-check' : 'hourglass-half'} size={14} color={item.payed === 'yes' ? Colors.success : Colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>+ {fmtXof(item.commission)}</Text>
                <Text style={styles.entrySub}>{maskName(item.filleul_name) || `#${item.filleul_id}`} · {item.type}</Text>
              </View>
              {item.created_at && <Text style={styles.entryDate}>{formatDate(item.created_at)}</Text>}
            </View>
          )) : (
            <Text style={styles.emptyText}>{t('affiliation.noCommissions', 'Aucune commission pour le moment.')}</Text>
          )
        )}
      </View>
    </>
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.desktopWrap}>
          {headerBlock}
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: 0 }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            {content}
          </ScrollView>
        </View>
        <CustomAlert />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
        style={styles.background}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {headerBlock}
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: 0 }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            {content}
          </ScrollView>
        </SafeAreaView>
        <CustomAlert />
      </ImageBackground>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  background: { flex: 1 },
  // Desktop : page centrée à largeur limitée (comme les autres pages), pas pleine largeur.
  desktopWrap: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  smallBtn: { paddingVertical: Spacing.xs + 1, minHeight: 36 },
  smallBtnText: { fontSize: FontSize.sm },
  scroll: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.xxl + Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  bonusCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.warning + '55',
    marginBottom: Spacing.md,
  },
  bonusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bonusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.warning + '22',
  },
  bonusTitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  bonusSubtitle: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
    marginTop: 2,
  },
  bonusProgressList: {
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  bonusProgressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  bonusProgressLabel: {
    flex: 1,
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  bonusProgressValue: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  bonusTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.inputBg,
    overflow: 'hidden',
  },
  bonusFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  codeText: {
    flex: 1,
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    letterSpacing: 1,
  },
  codeInput: {
    flex: 1,
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    letterSpacing: 1,
    padding: 0,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  helperText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCardWrap: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: 4,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: Colors.primary + '11',
    borderColor: Colors.primary,
  },
  tabBtnText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: Colors.primary,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  entrySub: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  entryDate: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  inlineIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '22',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});
