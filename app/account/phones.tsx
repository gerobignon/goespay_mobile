import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ImageBackground,
  Modal,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { RefreshableScrollView } from '../../src/components/Refreshable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { walletService } from '../../src/services/walletService';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { OPERATORS, operatorServesCountry } from '../../src/constants/config';
import { showAlert } from '../../src/stores/alertStore';
import { CustomAlert } from '../../src/components/CustomAlert';
import { OperatorLogo } from '../../src/components/OperatorLogo';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useCatalogStore } from '../../src/stores/catalogStore';
import { useAuthStore } from '../../src/stores/authStore';
import type { SavedPhone } from '../../src/types';

export default function PhonesScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const [savedPhones, setSavedPhones] = useState<SavedPhone[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneForm, setPhoneForm] = useState<{
    id: number;
    name: string;
    tel: string;
    type: 'transfer' | 'deposit';
    operator: string;
  }>({ id: 0, name: '', tel: '', type: 'transfer', operator: '' });

  const catalogOps = useCatalogStore((s) => s.operators);
  const user = useAuthStore((s) => s.user);
  const userCountry = (user?.country || '').toUpperCase();
  const opsSource: any[] = catalogOps.length ? catalogOps : (OPERATORS as any);
  // Mêmes moyens que dans le modal dépôt/retrait : filtrés par le pays de
  // l'utilisateur (au lieu de TOUS les opérateurs, liste interminable).
  const modalOperators = opsSource.filter((op: any) => {
    const typeOk = phoneForm.type === 'deposit'
      ? (op.payin ?? true) && op.id !== 'card'
      : !!op.withdraw;
    return typeOk && operatorServesCountry(op, userCountry);
  });

  // Libellé opérateur (drapeau + nom) résolu via catalogue ∪ config (nouveaux moyens inclus).
  const opLabel = (id?: string) => {
    if (!id) return '';
    const op = opsSource.find((o: any) => o.id === id) || (OPERATORS as unknown as any[]).find((o) => o.id === id);
    return op ? `${op.flag ? op.flag + ' ' : ''}${op.name}` : id;
  };

  // Pré-sélection : on respecte un opérateur déjà actif (édition / contexte) ;
  // sinon, si un seul moyen est disponible pour le pays, on le sélectionne.
  useEffect(() => {
    if (!phoneModalOpen) return;
    if (phoneForm.operator && modalOperators.some((op: any) => op.id === phoneForm.operator)) return;
    if (modalOperators.length === 1) {
      setPhoneForm((prev) => ({ ...prev, operator: modalOperators[0].id }));
    }
  }, [phoneModalOpen, phoneForm.type, modalOperators.length]);

  const loadPhones = useCallback(
    () => walletService.getSavedPhones()
      .then((data) => { setSavedPhones(data); setLoadError(null); })
      .catch(() => setLoadError(t('account.phonesLoadError'))),
    [t]
  );
  useEffect(() => { loadPhones(); }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadPhones(); } finally { setRefreshing(false); }
  }, [loadPhones]);

  const resetPhoneForm = () => {
    setPhoneForm({ id: 0, name: '', tel: '', type: 'transfer', operator: '' });
    setPhoneModalOpen(false);
  };

  const handleSavePhoneEntry = async () => {
    const tel = phoneForm.tel.replace(/\s+/g, '').trim();
    if (!tel) {
      showAlert(t('common.error'), t('account.enterPhoneNumber'));
      return;
    }
    setPhoneSaving(true);
    try {
      if (phoneForm.id) {
        const updated = await walletService.updateSavedPhone(phoneForm.id, {
          name: phoneForm.name.trim(),
          tel,
          type: phoneForm.type,
          operator: phoneForm.operator || undefined,
        });
        const merged: SavedPhone = { ...updated, type: phoneForm.type, operator: phoneForm.operator || undefined };
        setSavedPhones((prev) => prev.map((item) => (item.id === phoneForm.id ? merged : item)));
        showAlert(t('common.success'), t('account.phoneUpdated'));
      } else {
        const created = await walletService.createSavedPhone({
          name: phoneForm.name.trim(),
          tel,
          type: phoneForm.type,
          operator: phoneForm.operator || undefined,
        });
        const merged: SavedPhone = { ...created, type: phoneForm.type, operator: phoneForm.operator || undefined };
        setSavedPhones((prev) => [merged, ...prev]);
        showAlert(t('common.success'), t('account.phoneAdded'));
      }
      resetPhoneForm();
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('account.phoneSaveError'));
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleDeletePhoneEntry = (id: number) => {
    showAlert(
      t('account.deletePhoneConfirm', 'Supprimer ce numéro ?'),
      t('account.deleteConfirmMessage', 'Cette action est définitive.'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await walletService.deleteSavedPhone(id);
              setSavedPhones((prev) => prev.filter((item) => item.id !== id));
              if (phoneForm.id === id) resetPhoneForm();
            } catch (error: any) {
              showAlert(t('common.error'), error?.response?.data?.error || t('account.phoneDeleteError'));
            }
          },
        },
      ]
    );
  };

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('account.savedPhones')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('account.savedPhones')}</Text>}

      <View style={styles.formCard}>
        {savedPhones.length > 0 ? savedPhones.map((item) => (
          <View key={item.id} style={styles.savedEntryRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.savedEntryTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedEntryTitle}>{item.name?.trim() || t('common.noLabel')}</Text>
                  <Text style={styles.savedEntrySub}>{item.tel}</Text>
                </View>
                <TouchableOpacity
                  style={styles.inlineIconBtn}
                  onPress={() => {
                    setPhoneForm({ id: item.id, name: item.name || '', tel: item.tel, type: item.type ?? 'transfer', operator: item.operator ?? '' });
                    setPhoneModalOpen(true);
                  }}
                >
                  <FontAwesome6 name="pen" size={14} color={Colors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.inlineIconBtn} onPress={() => handleDeletePhoneEntry(item.id)}>
                  <FontAwesome6 name="trash" size={14} color={Colors.error} />
                </TouchableOpacity>
              </View>
              <View style={styles.savedEntryBadgesRow}>
                <View style={[styles.savedEntryBadgeWrap, item.type === 'deposit' ? styles.savedEntryBadgeDeposit : styles.savedEntryBadgeTransfer]}>
                  <Text style={[styles.savedEntryBadgeText, item.type === 'deposit' ? { color: Colors.success } : { color: Colors.primary }]}>
                    {item.type === 'deposit' ? t('account.typeDeposit') : t('account.typeTransfer')}
                  </Text>
                </View>
                {item.operator ? (
                  <View style={[styles.savedEntryBadgeWrap, styles.savedEntryBadgeOpWrap]}>
                    <Text style={styles.savedEntryBadgeOpText}>
                      {opLabel(item.operator)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        )) : (
          <Text style={styles.emptyText}>{t('account.noPhones')}</Text>
        )}

        {loadError ? <Text style={styles.emptyText}>{loadError}</Text> : null}

        <TouchableOpacity style={styles.addEntryBtn} onPress={() => { resetPhoneForm(); setPhoneModalOpen(true); }}>
          <FontAwesome6 name="plus" size={12} color={Colors.primary} />
          <Text style={styles.addEntryBtnText}>{t('account.addPhone')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const phoneModal = (
    <Modal visible={phoneModalOpen} transparent animationType="fade" onRequestClose={resetPhoneForm}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.formModalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={resetPhoneForm} />
        <View style={styles.formModalContainer}>
          <View style={styles.formModalHeader}>
            <Text style={styles.formModalTitle}>{phoneForm.id ? t('account.editPhone') : t('account.addPhone')}</Text>
            <TouchableOpacity onPress={resetPhoneForm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome6 name="xmark" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Input
              label={t('account.label')}
              value={phoneForm.name}
              onChangeText={(value) => setPhoneForm((prev) => ({ ...prev, name: value }))}
              placeholder={t('account.labelPlaceholder')}
            />
            <Input
              label={t('account.number')}
              value={phoneForm.tel}
              onChangeText={(value) => setPhoneForm((prev) => ({ ...prev, tel: value }))}
              keyboardType="phone-pad"
              placeholder={t('account.numberPlaceholder')}
            />
            <Text style={styles.managementFieldLabel}>{`${t('account.type')} *`}</Text>
            <View style={styles.typeRow}>
              {(['transfer', 'deposit'] as const).map((typ) => (
                <TouchableOpacity
                  key={typ}
                  style={[styles.typeChip, phoneForm.type === typ && styles.typeChipSelected]}
                  onPress={() => setPhoneForm((prev) => ({ ...prev, type: typ, operator: '' }))}
                >
                  <Text style={[styles.typeChipText, phoneForm.type === typ && styles.typeChipTextSelected]}>
                    {typ === 'transfer' ? t('account.typeTransfer') : t('account.typeDeposit')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.managementFieldLabel}>{t('account.operator')}</Text>
            <View style={{ gap: Spacing.xs, marginBottom: Spacing.sm }}>
              {modalOperators.length === 0 ? (
                <Text style={styles.emptyText}>{t('account.noOperatorForCountry', 'Aucun moyen disponible pour votre pays.')}</Text>
              ) : modalOperators.map((op: any) => {
                const sel = phoneForm.operator === op.id;
                return (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.opRow, sel && styles.opRowSelected]}
                    onPress={() => setPhoneForm((prev) => ({ ...prev, operator: op.id }))}
                  >
                    <OperatorLogo op={op} size={26} />
                    <Text style={[styles.opRowText, sel && styles.opRowTextSelected]} numberOfLines={1}>
                      {op.flag ? `${op.flag} ` : ''}{op.name}
                    </Text>
                    {sel && <FontAwesome6 name="circle-check" size={16} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.managementActions}>
              <Button title={phoneForm.id ? t('account.update') : t('common.add')} onPress={handleSavePhoneEntry} loading={phoneSaving} style={{ flex: 1 }} />
              <Button title={t('common.cancel')} variant="outline" onPress={resetPhoneForm} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <RefreshableScrollView contentContainerStyle={[styles.scroll, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled"
            refreshing={refreshing}
            onRefresh={onRefresh}
          >
          {content}
        </RefreshableScrollView>
        {phoneModal}
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
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <RefreshableScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"
            refreshing={refreshing}
            onRefresh={onRefresh}
          >
            {content}
          </RefreshableScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
        {phoneModal}
        <CustomAlert />
      </ImageBackground>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  background: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.xxl + Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
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
  savedEntryRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  savedEntryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  savedEntryBadgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  savedEntryTitle: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  savedEntrySub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  savedEntryBadgeWrap: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savedEntryBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: Fonts.semiBold,
  },
  savedEntryBadgeTransfer: {
    backgroundColor: Colors.primary + '22',
  },
  savedEntryBadgeDeposit: {
    backgroundColor: Colors.success + '22',
  },
  savedEntryBadgeOpWrap: {
    backgroundColor: Colors.inputBg,
  },
  savedEntryBadgeOpText: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  inlineIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBg,
  },
  addEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
  },
  addEntryBtnText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  formModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  formModalContainer: {
    backgroundColor: Colors.cardSolid,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  formModalTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  managementFieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  typeChip: {
    flex: 1,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  typeChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '18',
  },
  typeChipText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  typeChipTextSelected: {
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  opRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
  },
  opRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
  },
  opRowText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  opRowTextSelected: {
    color: Colors.primary,
  },
  opChipSm: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    width: 72,
  },
  opChipSmSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '18',
  },
  opChipSmLogo: {
    width: 32,
    height: 32,
    marginBottom: 2,
  },
  opChipSmText: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  opChipSmTextSelected: {
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  managementActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
