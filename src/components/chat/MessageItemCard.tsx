import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useColors } from '../ThemeProvider';
import { formatAmount } from '../../utils/format';
import { downloadPdf } from '../../utils/pdfDownload';
import { messagingService } from '../../services/messagingService';
import { showAlert } from '../../stores/alertStore';
import { PromoCard } from './PromoCard';
import { openLink } from '../../utils/openLink';
import type { MessageItem } from '../../types';

/**
 * Objet de l'application affiché dans une bulle : lien de paiement, envoi,
 * opération, carte, compte de réception, relevé.
 *
 * Le bloc n'affiche que ce que le serveur a jugé partageable — il ne va rien
 * rechercher de lui-même. Un champ absent est un champ que l'autre n'a pas le
 * droit de voir, pas une donnée à retrouver.
 */
export function MessageItemCard({
  item,
  mine,
  conversationId,
  messageId,
}: {
  item: MessageItem;
  mine: boolean;
  /** Nécessaires au reçu PDF : le droit de le lire vient du fil, pas de l'opération. */
  conversationId?: number;
  messageId?: number;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);

  const meta = item.meta || {};
  const tint = mine ? colors.white : colors.secondary;

  const open = (url?: string) => {
    // Lien de paiement partagé : même résolveur que les annonces — navigation
    // interne si l'adresse mène à l'app, repli si la PWA refuse la fenêtre.
    if (url) openLink(url, (path) => router.push(path as any));
  };

  const shell = (
    icon: string,
    title: string,
    lines: string[],
    onPress?: () => void,
    trailing?: React.ReactNode,
  ) => {
    const Wrapper: any = onPress ? TouchableOpacity : View;
    return (
      <Wrapper
        style={[
          styles.card,
          { backgroundColor: mine ? withAlpha(colors.black, 0.18) : withAlpha(colors.text, 0.06) },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={[styles.icon, { backgroundColor: withAlpha(tint, 0.18) }]}>
          <FontAwesome6 name={icon as any} size={15} color={tint} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: mine ? colors.white : colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {lines.filter(Boolean).map((line, i) => (
            <Text
              key={i}
              style={[styles.line, { color: mine ? withAlpha(colors.white, 0.8) : colors.textMuted }]}
              numberOfLines={1}
            >
              {line}
            </Text>
          ))}
        </View>
        {trailing ?? (!!onPress && <FontAwesome6 name="arrow-up-right-from-square" size={12} color={tint} />)}
      </Wrapper>
    );
  };

  const amount = (value: any, currency?: string) =>
    value != null ? `${formatAmount(Number(value))} ${currency || 'XOF'}` : '';

  switch (item.type) {
    // La promo a sa propre carte : elle ne rentre pas dans la coquille commune
    // (visuel pleine largeur, dégradé, bouton).
    case 'promo':
      return <PromoCard meta={meta} />;

    case 'paylink':
      return shell(
        'link',
        String(meta.title || t('messages.attachPaylink', 'Lien de paiement')),
        [
          meta.amount != null
            ? amount(meta.amount, meta.currency)
            : String(t('messages.freeAmount', 'Montant libre')),
          meta.active === false ? String(t('messages.linkClosed', 'Lien fermé')) : '',
        ],
        meta.url ? () => open(meta.url) : undefined,
      );

    case 'transfer':
    case 'transaction': {
      const outgoing = meta.outgoing !== false;
      const kindLabel = String(t(`messages.kind_${meta.kind || 'transfer'}`, meta.kind || ''));
      const canDownload = conversationId != null && messageId != null;

      const download = async () => {
        if (!canDownload || downloading) return;
        setDownloading(true);
        try {
          await downloadPdf(
            messagingService.receiptPath(conversationId, messageId),
            `goespay_${meta.kind || 'transfer'}_${meta.id ?? messageId}.pdf`,
            String(t('messages.receipt', 'Reçu')),
          );
        } catch {
          showAlert(
            String(t('common.error', 'Erreur')),
            String(t('messages.receiptFailed', 'Reçu indisponible.')),
          );
        } finally {
          setDownloading(false);
        }
      };

      // La carte EST le reçu : la toucher le télécharge. Un bouton encadré en
      // dessous doublait l'objet et écrasait la bulle.
      return shell(
        'receipt',
        amount(meta.amount, meta.currency),
        [
          [
            kindLabel,
            meta.kind === 'transfer'
              ? String(outgoing ? t('messages.txSent', 'Envoyé') : t('messages.txReceived', 'Reçu'))
              : '',
            meta.status ? String(t(`messages.status_${meta.status}`, meta.status)) : '',
          ]
            .filter(Boolean)
            .join(' · '),
          [
            meta.id != null ? `#${meta.id}` : '',
            meta.date ? String(meta.date).slice(0, 16).replace('T', ' ') : '',
          ]
            .filter(Boolean)
            .join(' · '),
        ],
        canDownload ? download : undefined,
        canDownload ? (
          downloading ? (
            <ActivityIndicator size="small" color={tint} />
          ) : (
            <View style={[styles.pdfTag, { backgroundColor: withAlpha(tint, 0.16) }]}>
              <FontAwesome6 name="file-pdf" size={11} color={tint} />
              <Text style={[styles.pdfTagText, { color: tint }]}>PDF</Text>
            </View>
          )
        ) : undefined,
      );
    }

    case 'card':
      return shell(
        'credit-card',
        `${String(meta.brand || '').toUpperCase()} •••• ${meta.last4 || ''}`.trim(),
        [meta.status ? String(t(`messages.status_${meta.status}`, meta.status)) : ''],
      );

    case 'virtual_account':
      return shell(
        'building-columns',
        String(
          [meta.currency, meta.bank].filter(Boolean).join(' · ') ||
            t('messages.attachVaccount', 'Compte de réception'),
        ),
        [meta.account_number || '', meta.status || ''],
      );

    case 'statement':
      return shell(
        'file-lines',
        String(t('messages.attachStatement', 'Relevé')),
        [[meta.from, meta.to].filter(Boolean).join(' → ')],
      );
  }

  return null;
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
      minWidth: 210,
    },
    icon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, minWidth: 0 },
    title: { fontFamily: Fonts.bold, fontSize: FontSize.sm },
    line: { fontFamily: Fonts.regular, fontSize: FontSize.xs, marginTop: 1 },
    pdfTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: BorderRadius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
    },
    pdfTagText: { fontFamily: Fonts.bold, fontSize: FontSize.xs, letterSpacing: 0.4 },
  });
