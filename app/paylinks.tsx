import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Image,
  ImageBackground,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { posterImageUrl, downloadPoster } from '../src/utils/posterImage';
import {
  paylinkService,
  type PayLink,
  type PayLinkPayment,
  type FeeBearer,
} from '../src/services/paylinkService';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { ResponsiveModal } from '../src/components/ResponsiveModal';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';
import { useThemedStyles } from '../src/hooks/useThemedStyles';
import { showAlert } from '../src/stores/alertStore';
import { CustomAlert } from '../src/components/CustomAlert';
import { DesktopHeader } from '../src/components/DesktopHeader';
import { DesktopFooter } from '../src/components/DesktopFooter';
import { useTheme } from '../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n';
import { useResponsive } from '../src/hooks/useResponsive';
import { useAuthStore } from '../src/stores/authStore';
import { useFormatXof } from '../src/utils/format';
import { getApiErrorMessage } from '../src/utils/apiError';

export default function PaymentLinksScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const fmtXof = useFormatXof();

  const [links, setLinks] = useState<PayLink[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  // Paiements chargés à la demande, par lien.
  const [payments, setPayments] = useState<Record<number, PayLinkPayment[]>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  // Lien dont l'affiche est montrée (une seule à la fois).
  const [qrId, setQrId] = useState<number | null>(null);
  // Chargement de l'affiche (image servie par le backend), par lien.
  const [posterState, setPosterState] = useState<Record<number, 'ready' | 'failed'>>({});

  // Formulaire de création.
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  // Description libre : facultative, elle s'affiche au payeur sous le motif.
  const [description, setDescription] = useState('');
  // Illustration facultative du lien (photo du produit, visuel de l'événement).
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [freeAmount, setFreeAmount] = useState(false);
  const [reusable, setReusable] = useState(false);
  const [feeBearer, setFeeBearer] = useState<FeeBearer>('payer');
  // Acceptation de la clause de responsabilité — obligatoire à chaque création.
  const [accepted, setAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Ouvrir les conditions doit amener le texte à l'écran, pas le laisser hors champ.
  const formScrollRef = useRef<ScrollView>(null);
  const termsCardY = useRef(0);

  const closeForm = () => {
    setFormOpen(false);
    setAccepted(false);
    setTermsOpen(false);
  };

  /** Choix de l'illustration dans la galerie. Un refus se solde par un no-op. */
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    paylinkService.list(showArchived)
      .then((res) => {
        setLinks(res.links);
        setArchivedCount(res.archived_count);
        setLoadError(null);
      })
      .catch((e) => setLoadError(getApiErrorMessage(e, t, t('paylinks.loadError'))))
      .finally(() => setLoading(false));
  }, [t, showArchived]);
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
    if (!title.trim() || !accepted) return;
    setBusy(true);
    try {
      const link = await paylinkService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        amount: freeAmount ? undefined : Number(amount),
        reusable,
        fee_bearer: feeBearer,
        imageUri: imageUri ?? undefined,
      });
      setLinks((prev) => [link, ...prev]);
      closeForm();
      setTitle(''); setDescription(''); setImageUri(null);
      setAmount(''); setFreeAmount(false); setReusable(false); setFeeBearer('payer');
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

  /**
   * Range un lien. C'est la seule sortie possible pour un lien qui a encaissé :
   * ses paiements doivent rester rattachables a leur origine.
   */
  const archive = (link: PayLink) => {
    const goingToArchive = !link.archived;
    showAlert(
      goingToArchive ? t('paylinks.archiveTitle') : t('paylinks.unarchiveTitle'),
      goingToArchive ? t('paylinks.archiveMessage') : t('paylinks.unarchiveMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: goingToArchive ? t('paylinks.archive') : t('paylinks.unarchive'),
          onPress: async () => {
            try {
              await paylinkService.archive(link.id, goingToArchive);
              // Le lien change de liste : on le retire de celle affichee.
              setLinks((prev) => prev.filter((l) => l.id !== link.id));
              setArchivedCount((n) => (goingToArchive ? n + 1 : Math.max(0, n - 1)));
            } catch (e: any) {
              showAlert(t('common.error'), getApiErrorMessage(e, t, t('paylinks.updateError')));
            }
          },
        },
      ],
    );
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

        {/* Qui porte les frais : réglé à la création et invisible ensuite, alors
            qu'il décide de ce que le lien rapporte vraiment (frais à ma charge =
            retenus sur ce que je reçois). */}
        <View style={[styles.feeBadge, link.fee_bearer === 'owner' && styles.feeBadgeOwner]}>
          <FontAwesome6
            name={link.fee_bearer === 'owner' ? 'hand-holding-dollar' : 'user'}
            size={10}
            color={link.fee_bearer === 'owner' ? Colors.warning : Colors.textSecondary}
          />
          <Text style={[styles.feeBadgeText, link.fee_bearer === 'owner' && styles.feeBadgeTextOwner]}>
            {t('paylinks.feesLabel')} : {link.fee_bearer === 'owner' ? t('paylinks.feesOwner') : t('paylinks.feesPayer')}
          </Text>
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

        {/* Affiche : l'image RENDUE PAR LE SERVEUR (/pay/<code>/affiche.png),
            pas une recomposition locale. L'aperçu est alors exactement le fichier
            que le client va télécharger, partager, et que verra quiconque reçoit
            le lien — une seule maquette à maintenir, côté backend. */}
        {qrId === link.id && (
          <View style={styles.poster}>
            <Image
              source={{ uri: posterImageUrl(link.url, i18n.language?.slice(0, 2) || 'fr') }}
              style={styles.posterImage}
              resizeMode="contain"
              onLoad={() => setPosterState((s) => ({ ...s, [link.id]: 'ready' }))}
              onError={() => setPosterState((s) => ({ ...s, [link.id]: 'failed' }))}
            />
            {posterState[link.id] !== 'ready' && (
              <View style={styles.posterLoader}>
                {posterState[link.id] === 'failed'
                  ? <Text style={styles.posterError}>{t('paylinks.posterUnavailable')}</Text>
                  : <ActivityIndicator color={Colors.primary} />}
              </View>
            )}
          </View>
        )}

        {qrId === link.id && (
          <View style={styles.posterActions}>
            <TouchableOpacity
              style={styles.posterBtn}
              onPress={() => downloadPoster(
                link.url,
                link.code,
                i18n.language?.slice(0, 2) || 'fr',
                t('paylinks.posterDownload'),
              ).catch(() => showAlert(t('common.error'), t('paylinks.posterDownloadError'), undefined, 'error'))}
              activeOpacity={0.85}
            >
              <FontAwesome6 name="download" size={13} color="#0a1020" />
              <Text style={styles.posterBtnText}>{t('paylinks.posterDownload')}</Text>
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

          {link.can_delete ? (
            <TouchableOpacity
              style={styles.actionDanger}
              onPress={() => remove(link)}
              activeOpacity={0.8}
              accessibilityLabel={t('common.delete')}
            >
              <FontAwesome6 name="trash" size={12} color={Colors.error} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.action}
              onPress={() => archive(link)}
              activeOpacity={0.8}
              accessibilityLabel={link.archived ? t('paylinks.unarchive') : t('paylinks.archive')}
            >
              <FontAwesome6
                name={link.archived ? 'box-open' : 'box-archive'}
                size={12}
                color={Colors.textMuted}
              />
              <Text style={[styles.actionText, { color: Colors.textMuted }]}>
                {link.archived ? t('paylinks.unarchive') : t('paylinks.archive')}
              </Text>
            </TouchableOpacity>
          )}
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('paylinks.title')}</Text>
      </View>

      <Button
        title={t('paylinks.newLink')}
        onPress={() => {
          if (user?.validate !== 1) {
            showAlert(t('depositModal.kycRequired3'), t('depositModal.kycRequired2'));
            return;
          }
          setFormOpen(true);
        }}
        style={{ marginBottom: Spacing.md }}
      />

      {/* Bascule vers les liens rangés — proposée seulement s'il en existe. */}
      {(archivedCount > 0 || showArchived) && (
        <TouchableOpacity
          style={styles.archiveToggle}
          onPress={() => setShowArchived((v) => !v)}
          activeOpacity={0.7}
        >
          <FontAwesome6
            name={showArchived ? 'arrow-left' : 'box-archive'}
            size={13}
            color={Colors.primary}
          />
          <Text style={styles.archiveToggleText}>
            {showArchived ? t('paylinks.backToActive') : t('paylinks.seeArchived', { count: archivedCount })}
          </Text>
        </TouchableOpacity>
      )}

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
    <ResponsiveModal visible={formOpen} onClose={closeForm} disableBackdropClose>
      <View style={styles.formHead}>
        <Text style={styles.formTitle}>{t('paylinks.newLink')}</Text>
        <TouchableOpacity style={styles.formClose} onPress={closeForm} hitSlop={10}>
          <FontAwesome6 name="xmark" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView ref={formScrollRef} style={{ flex: 1 }} contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Input
          label={t('paylinks.reason')}
          value={title}
          onChangeText={setTitle}
          maxLength={190}
          placeholder={t('paylinks.reasonPlaceholder')}
          containerStyle={{ alignSelf: 'stretch', marginBottom: Spacing.md }}
        />

        <Input
          label={t('paylinks.description')}
          value={description}
          onChangeText={setDescription}
          maxLength={1000}
          multiline
          numberOfLines={3}
          placeholder={t('paylinks.descriptionPlaceholder')}
          style={{ minHeight: 88, textAlignVertical: 'top' }}
          containerStyle={{ alignSelf: 'stretch', marginBottom: Spacing.md }}
        />

        {/* Illustration : ce que le payeur verra en haut de la page de paiement.
            Distincte de l'affiche partageable, que le serveur compose seul. */}
        <Text style={styles.groupLabel}>{t('paylinks.image')}</Text>
        {imageUri ? (
          <View style={styles.imagePreview}>
            <Image source={{ uri: imageUri }} style={styles.imageThumb} resizeMode="cover" />
            <TouchableOpacity
              style={styles.imageRemove}
              onPress={() => setImageUri(null)}
              hitSlop={10}
              accessibilityLabel={t('paylinks.imageRemove')}
            >
              <FontAwesome6 name="xmark" size={14} color={Colors.text} iconStyle="solid" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.imagePick} onPress={pickImage} activeOpacity={0.8}>
            <FontAwesome6 name="image" size={16} color={Colors.textSecondary} />
            <Text style={styles.imagePickText}>{t('paylinks.imageAdd')}</Text>
          </TouchableOpacity>
        )}

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
        {/* Clause de responsabilité : acceptation explicite exigée à chaque création. */}
        <View
          style={styles.termsCard}
          onLayout={(e) => { termsCardY.current = e.nativeEvent.layout.y; }}
        >
          <View style={styles.termsHead}>
            <FontAwesome6 name="triangle-exclamation" size={15} color={Colors.warning} iconStyle="solid" />
            <Text style={styles.termsHeadText}>{t('paylinks.terms.heading')}</Text>
          </View>

          <Text style={styles.termsText}>{t('paylinks.terms.summary')}</Text>

          <TouchableOpacity onPress={() => setTermsOpen((v) => !v)} activeOpacity={0.7}>
            <Text style={styles.termsLink}>
              {termsOpen ? t('paylinks.terms.hide') : t('paylinks.terms.read')}
            </Text>
          </TouchableOpacity>

          {termsOpen && (
            <View
              style={styles.termsBody}
              onLayout={(e) => {
                formScrollRef.current?.scrollTo({
                  y: Math.max(0, termsCardY.current + e.nativeEvent.layout.y - Spacing.md),
                  animated: true,
                });
              }}
            >
              <Text style={styles.termsTitle}>{t('paylinks.terms.title')}</Text>
              <Text style={styles.termsFull}>{t('paylinks.terms.full')}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.termsRow, accepted && styles.termsRowOn]}
            onPress={() => setAccepted((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
              {accepted && <FontAwesome6 name="check" size={11} color={Colors.white} />}
            </View>
            <Text style={[styles.termsAccept, accepted && styles.termsAcceptOn]}>
              {t('paylinks.terms.accept')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.formFoot}>
        <Button
          title={t('paylinks.create')}
          onPress={create}
          loading={busy}
          disabled={!title.trim() || (!freeAmount && !amount) || !accepted}
        />
      </View>
    </ResponsiveModal>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <DesktopHeader />
        <ImageBackground
          source={isDark ? require('../assets/bg_page.jpg') : require('../assets/bg_page_light.jpg')}
          style={styles.background}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        </ImageBackground>
        <DesktopFooter />
        {form}
        <CustomAlert />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={isDark ? require('../assets/bg_page.jpg') : require('../assets/bg_page_light.jpg')}
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
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  archiveToggleText: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: Fonts.medium },
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

  feeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.border,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  feeBadgeOwner: { backgroundColor: Colors.warning + '1F' },
  feeBadgeText: { fontSize: FontSize.xs, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  feeBadgeTextOwner: { color: Colors.warning },

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

  // Affiche : l'image du backend, affichée telle quelle. Rien n'est recomposé
  // ici — le fond sombre ne sert qu'au temps de chargement et aux bords.
  poster: {
    aspectRatio: 1,
    justifyContent: 'center',
    backgroundColor: '#0b1120',
    borderRadius: 22,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  posterImage: { width: '100%', height: '100%' },
  posterLoader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  posterError: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
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

  imagePick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
  },
  imagePickText: { fontSize: FontSize.sm, fontFamily: Fonts.medium, color: Colors.textSecondary },
  imagePreview: { position: 'relative', alignSelf: 'stretch' },
  imageThumb: { width: '100%', height: 140, borderRadius: BorderRadius.md },
  imageRemove: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },

  termsCard: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.warning + '14',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.warning + '55',
  },
  termsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  termsHeadText: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.warning,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  termsRowOn: { borderColor: Colors.primary },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsAccept: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  termsAcceptOn: { color: Colors.text },
  termsText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 20,
  },
  termsLink: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  termsBody: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  termsTitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  termsFull: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
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
