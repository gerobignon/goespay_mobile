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
  TextInput,
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
  transaction:     { icon: 'receipt',        labelKey: 'messages.attachTx',       fallback: 'Reçu d’opération' },
  card:            { icon: 'credit-card',    labelKey: 'messages.attachCard',     fallback: 'Carte virtuelle' },
  virtual_account: { icon: 'building-columns', labelKey: 'messages.attachVaccount', fallback: 'Compte de réception' },
  statement:       { icon: 'file-lines',     labelKey: 'messages.attachStatement', fallback: 'Relevé' },
};

/** Les seuls types qui se cherchent : les opérations. */
const isTxType = (type: string) => type === 'transaction' || type === 'transfer';

/** Couleur d'un statut d'opération — la même sémantique que dans l'historique. */
function statusTone(status: string | undefined, colors: any): string | null {
  const s = (status || '').toLowerCase();
  if (!s) return null;
  if (['success', 'succes', 'active', 'approved', '1'].includes(s)) return colors.positive;
  if (['wait', 'pending', 'processing', '0'].includes(s)) return colors.pending;
  if (['fail', 'failed', 'cancel', 'canceled', 'declined', 'error'].includes(s)) return colors.error;
  return colors.textMuted;
}

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
  const [query, setQuery] = useState('');
  /** Recherche dans tout l'historique, hors du filtre par interlocuteur. */
  const [searchAll, setSearchAll] = useState(false);

  useEffect(() => {
    if (!visible) {
      setOpenType(null);
      setItems([]);
      setQuery('');
      setSearchAll(false);
      return;
    }
    messagingService
      .getAttachables(conversationId)
      .then((r) => setTypes(r.types))
      .catch(() => setTypes([]));
  }, [visible, conversationId]);

  const fetchItems = async (type: string, q: string, all: boolean) => {
    setLoading(true);
    try {
      const r = await messagingService.getAttachables(conversationId, type, {
        q,
        scope: all ? 'all' : undefined,
      });
      setItems(r.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const openList = (type: string, all = false) => {
    setOpenType(type);
    setQuery('');
    setSearchAll(all);
    fetchItems(type, '', all);
  };

  // La recherche part au serveur : l'app n'a en mémoire que les dernières
  // opérations, pas tout l'historique dans lequel on cherche.
  useEffect(() => {
    if (!openType || !isTxType(openType)) return;
    const timer = setTimeout(() => fetchItems(openType, query.trim(), searchAll), 350);
    return () => clearTimeout(timer);
  }, [query, searchAll]);

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
    if (item.mode) parts.push(item.mode);
    if (item.reference) parts.push(item.reference);
    if (item.date) parts.push(item.date.slice(0, 10));
    return parts.join(' · ');
  };

  /** Pastilles : nature, statut, sens, identifiant. C'est ce qui distingue
   *  deux lignes du même montant. */
  const itemBadges = (item: AttachableItem) => {
    const tone = statusTone(item.status, colors);
    return (
      <View style={styles.badges}>
        {!!item.kind && (
          <View style={[styles.badge, { backgroundColor: withAlpha(colors.secondary, 0.15) }]}>
            <Text style={[styles.badgeText, { color: colors.secondary }]}>
              {t(`messages.kind_${item.kind}`, item.kind)}
            </Text>
          </View>
        )}
        {!!item.status && !!tone && (
          <View style={[styles.badge, { backgroundColor: withAlpha(tone, 0.15) }]}>
            <Text style={[styles.badgeText, { color: tone }]}>
              {t(`messages.status_${item.status}`, item.status)}
            </Text>
          </View>
        )}
        {item.outgoing != null && (
          <View
            style={[
              styles.badge,
              { backgroundColor: withAlpha(item.outgoing ? colors.error : colors.positive, 0.15) },
            ]}
          >
            <Text style={[styles.badgeText, { color: item.outgoing ? colors.error : colors.positive }]}>
              {item.outgoing ? t('messages.txSent', 'Envoyé') : t('messages.txReceived', 'Reçu')}
            </Text>
          </View>
        )}
        {item.id != null && (
          <View style={[styles.badge, { backgroundColor: withAlpha(colors.textMuted, 0.14) }]}>
            <Text style={[styles.badgeText, { color: colors.textMuted }]}>#{item.id}</Text>
          </View>
        )}
      </View>
    );
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
          ) : (
            <>
              {isTxType(openType) && (
                <View style={[styles.search, { borderColor: colors.border }]}>
                  <FontAwesome6 name="magnifying-glass" size={13} color={colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t('messages.searchTx', 'Identifiant, référence ou montant')}
                    placeholderTextColor={colors.textMuted}
                    autoCorrect={false}
                  />
                  {!!query && (
                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                      <FontAwesome6 name="xmark" size={13} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {loading ? (
                <ActivityIndicator style={{ marginVertical: Spacing.xl }} color={colors.text} />
              ) : items.length === 0 ? (
                <Text style={styles.empty}>
                  {query
                    ? t('messages.attachNoResult', 'Aucune opération ne correspond.')
                    : t('messages.attachEmpty', 'Rien à joindre ici pour le moment.')}
                </Text>
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
                        {itemBadges(item)}
                        {!!itemSub(item) && <Text style={styles.rowSub} numberOfLines={1}>{itemSub(item)}</Text>}
                      </View>
                      <FontAwesome6 name="plus" size={13} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Les opérations listées sont celles qui concernent cette
                  personne ; ce bouton ouvre l'historique entier. */}
              {isTxType(openType) && !searchAll && (
                <TouchableOpacity
                  style={[styles.footerBtn, { borderColor: colors.primary }]}
                  onPress={() => {
                    setSearchAll(true);
                    fetchItems(openType, query.trim(), true);
                  }}
                >
                  <FontAwesome6 name="magnifying-glass-dollar" size={14} color={colors.primary} />
                  <Text style={[styles.footerBtnText, { color: colors.primary }]}>
                    {t('messages.searchAnyTx', 'Chercher une autre transaction')}
                  </Text>
                </TouchableOpacity>
              )}
              {isTxType(openType) && searchAll && (
                <Text style={styles.scopeNote}>
                  {t('messages.searchAllScope', 'Toutes vos opérations')}
                </Text>
              )}
            </>
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
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginTop: 4,
    },
    badge: {
      borderRadius: BorderRadius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
    },
    badgeText: { fontFamily: Fonts.semiBold, fontSize: FontSize.xs },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderRadius: BorderRadius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      minHeight: 34,
      color: Colors.text,
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
    },
    footerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.sm + 2,
      marginTop: Spacing.sm,
    },
    footerBtnText: { fontFamily: Fonts.semiBold, fontSize: FontSize.sm },
    scopeNote: {
      fontFamily: Fonts.medium,
      fontSize: FontSize.xs,
      color: Colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
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
