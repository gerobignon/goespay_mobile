import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Image,
  Linking,
  ImageBackground,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import {
  paylinkService,
  type PayLink,
  type PayLinkPayment,
  type FeeBearer,
} from '../../src/services/paylinkService';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ResponsiveModal } from '../../src/components/ResponsiveModal';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { showAlert } from '../../src/stores/alertStore';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useAuthStore } from '../../src/stores/authStore';
import { useFormatXof } from '../../src/utils/format';
import { getApiErrorMessage } from '../../src/utils/apiError';

export default function PaymentLinksScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const fmtXof = useFormatXof();

  const [links, setLinks] = useState<PayLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  // Paiements chargés à la demande, par lien.
  const [payments, setPayments] = useState<Record<number, PayLinkPayment[]>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  // Lien dont le QR est affiché (un seul à la fois).
  const [qrId, setQrId] = useState<number | null>(null);

  // Formulaire de création.
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [freeAmount, setFreeAmount] = useState(false);
  const [reusable, setReusable] = useState(false);
  const [feeBearer, setFeeBearer] = useState<FeeBearer>('payer');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    paylinkService.list()
      .then((res) => { setLinks(res); setLoadError(null); })
      .catch((e) => setLoadError(getApiErrorMessage(e, t, t('paylinks.loadError'))))
      .finally(() => setLoading(false));
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const copy = async (link: PayLink) => {
    await Clipboard.setStringAsync(link.url);
    setCopied(link.id);
    setTimeout(() => setCopied((c) => (c === link.id ? null : c)), 1500);
  };

  const share = async (link: PayLink) => {
    try {
      await Share.share({ message: `${link.title} — ${link.url}`, url: link.url });
    } catch (_) {}
  };

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const link = await paylinkService.create({
        title: title.trim(),
        amount: freeAmount ? undefined : Number(amount),
        reusable,
        fee_bearer: feeBearer,
      });
      setLinks((prev) => [link, ...prev]);
      setFormOpen(false);
      setTitle(''); setAmount(''); setFreeAmount(false); setReusable(false); setFeeBearer('payer');
      copy(link);
    } catch (e: any) {
      showAlert(t('common.error'), getApiErrorMessage(e, t, t('paylinks.createError')));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (link: PayLink) => {
    try {
      const updated = await paylinkService.update(link.id, { is_active: !link.is_active });
      setLinks((prev) => prev.map((l) => (l.id === link.id ? updated : l)));
    } catch (e: any) {
      showAlert(t('common.error'), getApiErrorMessage(e, t, t('paylinks.updateError')));
    }
  };

  const remove = (link: PayLink) => {
    showAlert(t('paylinks.deleteTitle'), t('paylinks.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive', onPress: async () => {
          try {
            await paylinkService.remove(link.id);
            setLinks((prev) => prev.filter((l) => l.id !== link.id));
          } catch (e: any) {
            showAlert(t('common.error'), getApiErrorMessage(e, t, t('paylinks.updateError')));
          }
        },
      },
    ]);
  };

  const openPayments = async (link: PayLink) => {
    if (openId === link.id) { setOpenId(null); return; }
    setOpenId(link.id);
    if (payments[link.id]) return;
    try {
      const list = await paylinkService.payments(link.id);
      setPayments((prev) => ({ ...prev, [link.id]: list }));
    } catch (_) {}
  };

  const statusLabel = (link: PayLink) => {
    if (link.open) return t('paylinks.statusActive');
    if (link.closed_reason === 'expired') return t('paylinks.statusExpired');
    if (link.closed_reason === 'used') return t('paylinks.statusUsed');
    return t('paylinks.statusDisabled');
  };

  const renderLink = (link: PayLink) => {
    const list = payments[link.id];
    const open = openId === link.id;
    return (
      <View key={link.id} style={[styles.card, link.open && styles.cardOpen]}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{link.title}</Text>
            <Text style={styles.cardSub}>
              {link.amount !== null ? fmtXof(link.amount) : t('paylinks.freeAmount')}
              {link.reusable ? ` · ${t('paylinks.reusable')}` : ''}
            </Text>
          </View>
          <View style={[styles.badge, !link.open && styles.badgeOff]}>
            <View style={[styles.badgeDot, !link.open && styles.badgeDotOff]} />
            <Text style={[styles.badgeText, !link.open && styles.badgeTextOff]}>{statusLabel(link)}</Text>
          </View>
        </View>

        {/* Le lien lui-même : toute la barre copie, l'icône confirme. */}
        <TouchableOpacity style={styles.urlRow} onPress={() => copy(link)} activeOpacity={0.7}>
          <FontAwesome6 name="link" size={12} color={Colors.primary} />
          <Text style={styles.url} numberOfLines={1} ellipsizeMode="middle" selectable>{link.url}</Text>
          <View style={[styles.urlCopy, copied === link.id && styles.urlCopyOn]}>
            <FontAwesome6
              name={copied === link.id ? 'check' : 'copy'}
              size={13}
              color={copied === link.id ? Colors.white : Colors.primary}
            />
          </View>
        </TouchableOpacity>

        <View style={styles.totals}>
          <View style={styles.total}>
            <View style={styles.totalHead}>
              <FontAwesome6 name="arrow-down" size={10} color={Colors.success} />
              <Text style={styles.totalLabel}>{t('paylinks.received')}</Text>
            </View>
            <Text style={[styles.totalValue, { color: Colors.success }]}>{fmtXof(link.received)}</Text>
          </View>
          <View style={styles.totalSep} />
          <View style={styles.total}>
            <View style={styles.totalHead}>
              <FontAwesome6 name="receipt" size={10} color={Colors.secondary} />
              <Text style={styles.totalLabel}>{t('paylinks.payments')}</Text>
            </View>
            <Text style={[styles.totalValue, { color: Colors.secondary }]}>{link.uses_count}</Text>
          </View>
        </View>

        {/* Affiche : ce que le client colle sur son comptoir. Mêmes éléments que
            la version imprimable (/pay/<code>/affiche) pour qu'il reconnaisse
            l'aperçu qu'il vient de voir. */}
        {qrId === link.id && (
          <View style={styles.poster}>
            {/* Halos de marque : les mêmes que le fond de la version web. */}
            <View style={[styles.posterGlow, { top: -180, left: -150, backgroundColor: '#4285F4' }]} pointerEvents="none" />
            <View style={[styles.posterGlow, { bottom: -190, right: -140, backgroundColor: '#F5A623' }]} pointerEvents="none" />

            <View style={styles.posterHead}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.posterLogo}
                resizeMode="contain"
              />
              <Text style={styles.posterTitle}>{t('paylinks.posterTitle')}</Text>
              <Text style={styles.posterBeneficiary} numberOfLines={1}>
                {user ? `${user.name} ${(user.surname || '').charAt(0)}.` : ''}
              </Text>
            </View>

            <View style={styles.posterAmountBlock}>
              {link.amount !== null && (
                <Text style={styles.posterAmount}>{fmtXof(link.amount)}</Text>
              )}
              <Text style={styles.posterReason} numberOfLines={1}>{link.title}</Text>
            </View>

            <View style={styles.posterQr}>
              <QRCode
                value={link.url}
                size={186}
                backgroundColor="#ffffff"
                color="#0a1020"
                logo={require('../../assets/picto.png')}
                logoSize={46}
                logoBackgroundColor="#ffffff"
                logoBorderRadius={8}
                logoMargin={3}
                quietZone={10}
                // Correction d'erreur élevée : le picto masque une partie des
                // modules, sans ça le QR devient illisible.
                ecl="H"
              />
            </View>

            <View style={styles.posterScan}>
              <Text style={styles.posterScanText}>{t('paylinks.posterScan')}</Text>
            </View>

            <View style={styles.posterFoot}>
              <Text style={styles.posterUrlLabel}>{t('paylinks.posterDirectLink')}</Text>
              <Text style={styles.posterUrl} numberOfLines={1} selectable>{link.url}</Text>
            </View>
          </View>
        )}

        {qrId === link.id && (
          <View style={styles.posterActions}>
            <TouchableOpacity
              style={styles.posterBtn}
              onPress={() => Linking.openURL(`${link.url}/affiche?lang=${i18n.language?.slice(0, 2) || 'fr'}`)}
              activeOpacity={0.85}
            >
              <FontAwesome6 name="print" size={13} color="#0a1020" />
              <Text style={styles.posterBtnText}>{t('paylinks.posterPrint')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions courantes en pastilles ; la suppression reste à l'écart,
            en icône seule, pour ne pas peser autant que le reste. */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.action, { backgroundColor: Colors.secondary + '18' }, qrId === link.id && { backgroundColor: Colors.secondary }]}
            onPress={() => setQrId((c) => (c === link.id ? null : link.id))}
            activeOpacity={0.8}
          >
            <FontAwesome6 name="qrcode" size={12} color={qrId === link.id ? Colors.white : Colors.secondary} />
            <Text style={[styles.actionText, { color: qrId === link.id ? Colors.white : Colors.secondary }]}>
              {t('paylinks.qr')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.action, { backgroundColor: Colors.primary + '18' }]}
            onPress={() => share(link)}
            activeOpacity={0.8}
          >
            <FontAwesome6 name="share-nodes" size={12} color={Colors.primary} />
            <Text style={[styles.actionText, { color: Colors.primary }]}>{t('paylinks.share')}</Text>
          </TouchableOpacity>

          {/* Reprise / suspension : vert quand l'action REND le lien payable,
              ambre quand elle le coupe. */}
          <TouchableOpacity
            style={[styles.action, { backgroundColor: (link.is_active ? Colors.warning : Colors.success) + '20' }]}
            onPress={() => toggleActive(link)}
            activeOpacity={0.8}
          >
            <FontAwesome6
              name={link.is_active ? 'pause' : 'play'}
              size={12}
              color={link.is_active ? Colors.warning : Colors.success}
            />
            <Text style={[styles.actionText, { color: link.is_active ? Colors.warning : Colors.success }]}>
              {link.is_active ? t('paylinks.disable') : t('paylinks.enable')}
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={styles.actionDanger}
            onPress={() => remove(link)}
            activeOpacity={0.8}
            accessibilityLabel={t('common.delete')}
          >
            <FontAwesome6 name="trash" size={12} color={Colors.error} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.toggle} onPress={() => openPayments(link)} activeOpacity={0.7}>
          <Text style={styles.toggleText}>
            {open ? t('paylinks.hidePayments') : t('paylinks.showPayments')}
          </Text>
          <FontAwesome6 name={open ? 'chevron-up' : 'chevron-down'} size={11} color={Colors.primary} />
        </TouchableOpacity>

        {open && (
          !list ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : list.length === 0 ? (
            <Text style={styles.empty}>{t('paylinks.noPayments')}</Text>
          ) : (
            <View style={styles.entries}>
              {list.map((p) => (
                <View key={p.id} style={styles.entry}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryPayer} numberOfLines={1}>
                      {p.payer_name || t('paylinks.unknownPayer')}
                    </Text>
                    <Text style={styles.entryDate}>
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      }) : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.entryAmount}>+ {fmtXof(p.amount)}</Text>
                    <Text style={styles.entryStatus}>{t('paylinks.paid')}</Text>
                  </View>
                </View>
              ))}
            </View>
          )
        )}
      </View>
    );
  };

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('paylinks.title')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('paylinks.title')}</Text>}

      <Button
        title={t('paylinks.newLink')}
        onPress={() => {
          if (user?.validate !== 1) {
            showAlert(t('depositModal.kycRequired3'), t('depositModal.kycRequired2'));
            return;
          }
          setFormOpen(true);
        }}
        style={{ marginBottom: Spacing.lg }}
      />

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <>
          {links.map(renderLink)}
          {links.length === 0 && <Text style={styles.empty}>{loadError ?? t('paylinks.none')}</Text>}
          {!!loadError && links.length > 0 && <Text style={styles.empty}>{loadError}</Text>}
        </>
      )}
    </>
  );

  const form = (
    <ResponsiveModal visible={formOpen} onClose={() => setFormOpen(false)}>
      <View style={styles.formHead}>
        <Text style={styles.formTitle}>{t('paylinks.newLink')}</Text>
        <TouchableOpacity style={styles.formClose} onPress={() => setFormOpen(false)} hitSlop={10}>
          <FontAwesome6 name="xmark" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Input
          label={t('paylinks.reason')}
          value={title}
          onChangeText={setTitle}
          maxLength={190}
          placeholder={t('paylinks.reasonPlaceholder')}
          containerStyle={{ alignSelf: 'stretch', marginBottom: Spacing.md }}
        />

        {/* Montant : le champ disparaît quand le payeur choisit lui-même. */}
        {!freeAmount && (
          <Input
            label={t('paylinks.amount')}
            value={amount ? Number(amount).toLocaleString('fr-FR') : ''}
            onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
            prefix="XOF"
            containerStyle={{ alignSelf: 'stretch', marginBottom: Spacing.md }}
          />
        )}

        {/* Options : un seul bloc, une ligne par option. La ligne ENTIÈRE bascule
            l'option — le Switch est décoratif (pointerEvents none) pour éviter le
            double toggle quand le clic tombe pile dessus. */}
        <View style={styles.optionCard}>
          {([
            { key: 'free', value: freeAmount, set: setFreeAmount, label: 'paylinks.freeAmount', hint: 'paylinks.freeAmountHint' },
            { key: 'reuse', value: reusable, set: setReusable, label: 'paylinks.reusable', hint: 'paylinks.reusableHint' },
          ] as const).map((opt, i, all) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.optionRow, i === all.length - 1 && styles.optionRowLast]}
              onPress={() => opt.set(!opt.value)}
              activeOpacity={0.7}
              accessibilityRole="switch"
              accessibilityState={{ checked: opt.value }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{t(opt.label)}</Text>
                <Text style={styles.optionHint}>{t(opt.hint)}</Text>
              </View>
              <View pointerEvents="none">
                <Switch
                  value={opt.value}
                  onValueChange={opt.set}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.groupLabel}>{t('paylinks.feesLabel')}</Text>
        <View style={styles.segment}>
          {(['payer', 'owner'] as FeeBearer[]).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.segmentItem, feeBearer === v && styles.segmentItemOn]}
              onPress={() => setFeeBearer(v)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, feeBearer === v && styles.segmentTextOn]}>
                {v === 'payer' ? t('paylinks.feesPayer') : t('paylinks.feesOwner')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.formFoot}>
        <Button
          title={t('paylinks.create')}
          onPress={create}
          loading={busy}
          disabled={!title.trim() || (!freeAmount && !amount)}
        />
      </View>
    </ResponsiveModal>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
        {form}
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
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        </SafeAreaView>
        {form}
        <CustomAlert />
      </ImageBackground>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  background: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontFamily: Fonts.bold, color: Colors.text, marginBottom: Spacing.md },

  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardOpen: { borderColor: Colors.success + '55' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text },
  cardSub: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 3 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.success + '1F',
  },
  badgeOff: { backgroundColor: Colors.border },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  badgeDotOff: { backgroundColor: Colors.textSecondary },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.semiBold, color: Colors.success },
  badgeTextOff: { color: Colors.textSecondary },

  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
  },
  url: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  urlCopy: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '18',
  },
  urlCopyOn: { backgroundColor: Colors.success },

  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  total: { flex: 1, alignItems: 'center' },
  totalHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  totalSep: { width: 1, alignSelf: 'stretch', backgroundColor: Colors.border },
  totalLabel: { fontSize: FontSize.xs, fontFamily: Fonts.medium, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text, marginTop: 3 },

  // Affiche : fond blanc volontaire (identique à la version imprimée), donc
  // couleurs figées plutôt que celles du thème.
  // Affiche : couleurs de marque figées (identiques à la version web
  // /pay/<code>/affiche), volontairement indépendantes du thème clair/sombre —
  // c'est une image destinée à être partagée telle quelle.
  poster: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0b1120',
    borderRadius: 22,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  posterGlow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.1,
  },
  posterHead: { alignItems: 'center' },
  posterLogo: { height: 46, width: 210 },
  posterTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: '#ffffff', marginTop: Spacing.sm },
  posterBeneficiary: { fontSize: FontSize.sm, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  posterAmountBlock: { alignItems: 'center' },
  posterAmount: { fontSize: FontSize.xxl, fontFamily: Fonts.bold, color: '#F5A623' },
  posterReason: { fontSize: FontSize.md, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.65)', marginTop: 2, textAlign: 'center' },
  // Le QR garde son fond blanc : les lecteurs lisent mal l'inverse vidéo.
  posterQr: {
    alignItems: 'center',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#ffffff',
  },
  posterScan: {
    backgroundColor: '#F5A623',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  posterScanText: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: '#0a0a12' },
  posterFoot: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  posterUrlLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  posterUrl: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 1,
  },
  posterActions: { alignItems: 'center', marginBottom: Spacing.md },
  posterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.pill,
    backgroundColor: '#F5A623',
  },
  posterBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: '#0a1020' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.primary + '14',
  },
  actionOn: { backgroundColor: Colors.primary },
  actionText: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: Fonts.semiBold },
  actionTextOn: { color: Colors.white },
  actionDanger: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error + '12',
  },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  toggleText: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: Fonts.semiBold },

  entries: { marginTop: Spacing.sm, gap: Spacing.sm },
  entry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  entryPayer: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Fonts.semiBold },
  entryDate: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  entryAmount: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.success },
  entryPending: { color: Colors.textSecondary },
  entryStatus: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  empty: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.lg },

  // En-tête et pied fixes : seul le corps du formulaire défile.
  formHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  formTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text },
  formClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  formScroll: { padding: Spacing.lg, paddingBottom: Spacing.md },
  formFoot: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  optionCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionRowLast: { borderBottomWidth: 0 },
  optionLabel: { fontSize: FontSize.md, color: Colors.text, fontFamily: Fonts.medium },
  optionHint: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  groupLabel: { fontSize: FontSize.sm, fontFamily: Fonts.medium, color: Colors.textSecondary, marginBottom: Spacing.sm },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  segmentItemOn: { backgroundColor: Colors.primary },
  segmentText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: Fonts.medium },
  segmentTextOn: { color: Colors.white, fontFamily: Fonts.bold },
});
