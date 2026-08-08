import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useColors } from '../ThemeProvider';
import { messagingService } from '../../services/messagingService';
import { formatAmount } from '../../utils/format';
import type { AttachableItem, MessageItemType } from '../../types';

/** Présentation de chaque type joignable : icône et libellé. */
const TYPE_META: Record<string, { icon: string; labelKey: string; fallback: string }> = {
  photo:           { icon: 'image',          labelKey: 'messages.attachPhoto',    fallback: 'Photo' },
  paylink:         { icon: 'link',           labelKey: 'messages.attachPaylink',  fallback: 'Lien de paiement' },
  transfer:        { icon: 'paper-plane',    labelKey: 'messages.attachTransfer', fallback: 'Envoi d’argent' },
  transaction:     { icon: 'receipt',        labelKey: 'messages.attachTx',       fallback: 'Une opération' },
  card:            { icon: 'credit-card',    labelKey: 'messages.attachCard',     fallback: 'Carte virtuelle' },
  virtual_account: { icon: 'building-columns', labelKey: 'messages.attachVaccount', fallback: 'Compte de réception' },
  statement:       { icon: 'file-lines',     labelKey: 'messages.attachStatement', fallback: 'Relevé' },
};

interface AttachSheetProps {
  visible: boolean;
  conversationId: number;
  onClose: () => void;
  onPickPhoto: () => void;
  onPick: (type: MessageItemType, ref: string) => void;
  /** « Envoyer de l'argent » n'est pas un objet à choisir mais une action. */
  onPickSendMoney?: () => void;
}

/**
 * Menu « joindre » en deux temps : les types d'abord, les objets ensuite.
 *
 * Les types viennent du serveur et non d'une liste locale : ce qu'on peut
 * joindre dépend de l'interlocuteur (une carte n'a rien à faire dans un fil
 * entre clients), et cette règle n'a pas à être répétée ici pour être
 * contredite plus tard.
 */
export function AttachSheet({
  visible,
  conversationId,
  onClose,
  onPickPhoto,
  onPick,
  onPickSendMoney,
}: AttachSheetProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [types, setTypes] = useState<string[]>([]);
  const [openType, setOpenType] = useState<string | null>(null);
  const [items, setItems] = useState<AttachableItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setOpenType(null);
      setItems([]);
      return;
    }
    messagingService
      .getAttachables(conversationId)
      .then((r) => setTypes(r.types))
      .catch(() => setTypes([]));
  }, [visible, conversationId]);

  const openList = async (type: string) => {
    setOpenType(type);
    setLoading(true);
    try {
      const r = await messagingService.getAttachables(conversationId, type);
      setItems(r.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const label = (type: string) => {
    const meta = TYPE_META[type];
    return meta ? t(meta.labelKey, meta.fallback) : type;
  };

  /** Une ligne d'objet : ce qu'il faut pour le reconnaître, pas plus. */
  const itemLine = (item: AttachableItem) => {
    if (item.title) return item.title;
    if (item.amount != null) {
      const sign = item.outgoing === false ? '+' : item.outgoing ? '−' : '';
      return `${sign}${formatAmount(item.amount)} ${item.currency || 'XOF'}`;
    }
    return item.ref;
  };

  const itemSub = (item: AttachableItem) => {
    const parts: string[] = [];
    if (item.kind) parts.push(t(`messages.kind_${item.kind}`, item.kind));
    if (item.status) parts.push(item.status);
    if (item.date) parts.push(item.date.slice(0, 10));
    return parts.join(' · ');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]} onPress={() => {}}>
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={1}>
              {openType ? label(openType) : t('messages.attachTitle', 'Joindre')}
            </Text>
            <TouchableOpacity
              onPress={() => (openType ? setOpenType(null) : onClose())}
              hitSlop={12}
            >
              <FontAwesome6 name={openType ? 'arrow-left' : 'xmark'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {!openType ? (
            <View>
              {/* La photo n'est pas un objet de l'app : elle vient du téléphone,
                  donc elle est toujours proposée, en tête. */}
              <TouchableOpacity style={styles.row} onPress={() => { onClose(); onPickPhoto(); }}>
                <View style={[styles.rowIcon, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
                  <FontAwesome6 name="image" size={15} color={colors.primary} />
                </View>
                <Text style={styles.rowLabel}>{t('messages.attachPhoto', 'Photo')}</Text>
              </TouchableOpacity>

              {types.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.row}
                  onPress={() => {
                    // Envoyer de l'argent se fait, ne se choisit pas : on ouvre
                    // le formulaire au lieu de lister des transferts passés.
                    if (type === 'transfer' && onPickSendMoney) {
                      onClose();
                      onPickSendMoney();
                      return;
                    }
                    openList(type);
                  }}
                >
                  <View style={[styles.rowIcon, { backgroundColor: withAlpha(colors.secondary, 0.15) }]}>
                    <FontAwesome6
                      name={(TYPE_META[type]?.icon ?? 'paperclip') as any}
                      size={15}
                      color={colors.secondary}
                    />
                  </View>
                  <Text style={styles.rowLabel}>{label(type)}</Text>
                  <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          ) : loading ? (
            <ActivityIndicator style={{ marginVertical: Spacing.xl }} color={colors.text} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>{t('messages.attachEmpty', 'Rien à joindre ici pour le moment.')}</Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.ref}
                  style={styles.row}
                  onPress={() => { onClose(); onPick(openType as MessageItemType, item.ref); }}
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{itemLine(item)}</Text>
                    {!!itemSub(item) && <Text style={styles.rowSub} numberOfLines={1}>{itemSub(item)}</Text>}
                  </View>
                  <FontAwesome6 name="plus" size={13} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: Colors.cardSolid,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      alignSelf: 'center',
      width: '100%',
      maxWidth: 520,
      maxHeight: '76%',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingHorizontal: Spacing.sm,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      marginBottom: Spacing.xs,
    },
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: FontSize.md, color: Colors.text },
    list: { maxHeight: 380 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md - 2,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSize.md, color: Colors.text },
    rowSub: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
      marginTop: 1,
    },
    empty: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      textAlign: 'center',
      paddingVertical: Spacing.xl,
    },
  });
