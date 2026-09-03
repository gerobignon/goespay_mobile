import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { RefreshableScrollView } from '../../src/components/Refreshable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { walletService, type SavedBank } from '../../src/services/walletService';
import { Input } from '../../src/components/Input';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { showAlert } from '../../src/stores/alertStore';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../../src/hooks/useResponsive';

export default function BankAccountsScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const [banks, setBanks] = useState<SavedBank[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SavedBank | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => walletService.getSavedBanks()
    .then((list) => { setBanks(list); setLoadError(null); })
    .catch(() => setLoadError(t('account.banksLoadError')));
  useEffect(() => { load(); }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const handleSaveName = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await walletService.updateSavedBank(editing.id, { name: editName.trim() });
      setBanks((prev) => prev.map((b) => (b.id === editing.id ? { ...b, ...updated } : b)));
      setEditing(null);
    } catch (e: any) {
      showAlert(t('common.error'), e?.response?.data?.error || t('account.bankSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (b: SavedBank) => {
    showAlert(t('account.deleteBankConfirm'), t('account.deleteBankMsg'), [
      { text: t('common.cancel') },
      {
        text: t('common.delete'),
        onPress: async () => {
          try {
            await walletService.deleteSavedBank(b.id);
            setBanks((prev) => prev.filter((x) => x.id !== b.id));
          } catch (e: any) {
            showAlert(t('common.error'), e?.response?.data?.error || t('account.bankDeleteError'));
          }
        },
      },
    ]);
  };

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('account.savedBanks')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('account.savedBanks')}</Text>}

      <View style={styles.formCard}>
        {banks.length > 0 ? banks.map((b) => {
          const sub = [b.bank_name, b.account_number || b.iban].filter(Boolean).join(' · ');
          return (
            <View key={b.id} style={styles.row}>
              <View style={styles.rowIcon}>
                <FontAwesome6 name="building-columns" size={15} color={Colors.secondary} iconStyle="solid" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{b.name?.trim() || b.account_holder?.trim() || t('common.noLabel')}</Text>
                {!!sub && <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>}
                <View style={styles.badges}>
                  {!!b.currency && <View style={styles.badge}><Text style={styles.badgeText}>{b.currency}</Text></View>}
                  {!!b.rail && <View style={styles.badge}><Text style={styles.badgeText}>{b.rail === 'bank_transfer' ? 'Virement' : b.rail}</Text></View>}
                </View>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => { setEditing(b); setEditName(b.name || ''); }}>
                <FontAwesome6 name="pen" size={14} color={Colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(b)}>
                <FontAwesome6 name="trash" size={14} color={Colors.error} />
              </TouchableOpacity>
            </View>
          );
        }) : (
          <Text style={styles.emptyText}>{t('account.noBanks')}</Text>
        )}
        {loadError ? <Text style={styles.emptyText}>{loadError}</Text> : null}
        <Text style={styles.hint}>{t('account.bankAddHint')}</Text>
      </View>
    </>
  );

  const editModal = (
    <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setEditing(null)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{t('account.editBankName')}</Text>
          <Input
            label={t('transferModal.nameLabel')}
            placeholder={t('transferModal.labelPlaceholder')}
            value={editName}
            onChangeText={setEditName}
            containerStyle={{ alignSelf: 'stretch' }}
          />
          <View style={styles.sheetBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? t('common.saving') : t('common.save')}</Text>
            </TouchableOpacity>
          </View>
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
        {editModal}
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
          <RefreshableScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"
            refreshing={refreshing}
            onRefresh={onRefresh}
          >
            {content}
          </RefreshableScrollView>
        </SafeAreaView>
        {editModal}
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
  formCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.secondary + '18' },
  rowTitle: { fontSize: FontSize.md, fontFamily: Fonts.semiBold, color: Colors.text },
  rowSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { backgroundColor: Colors.primary + '15', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, color: Colors.primary, fontFamily: Fonts.semiBold },
  iconBtn: { padding: Spacing.sm },
  emptyText: { color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
  hint: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: Spacing.xs },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.md },
  sheetTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text },
  sheetBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', backgroundColor: Colors.border },
  cancelBtnText: { color: Colors.text, fontFamily: Fonts.semiBold },
  saveBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', backgroundColor: Colors.primary },
  saveBtnText: { color: Colors.white, fontFamily: Fonts.semiBold },
});
