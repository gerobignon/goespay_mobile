import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, BorderRadius, FontSize, Spacing, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { TRANSACTION_STATUS, getTransactionStatus, OPERATORS } from '../constants/config';
import { useCatalogStore } from '../stores/catalogStore';
import { formatAmount, formatDate, useFormatXof } from '../utils/format';
import type { Transaction } from '../types';

interface TransactionItemProps {
  transaction: Transaction;
  onPress: (transaction: Transaction) => void;
  padded?: boolean;
}

const CRYPTO_LOGOS: Record<string, ImageSourcePropType> = {
  BTC:  require('../../assets/crypto/btc.png'),
  ETH:  require('../../assets/crypto/eth.png'),
  USDT: require('../../assets/crypto/usdt.png'),
  USDT_BEP20: require('../../assets/crypto/busdt.png'),
  TRX:  require('../../assets/crypto/trx.png'),
  LTC:  require('../../assets/crypto/ltc.png'),
  BNB:  require('../../assets/crypto/bnb.png'),
  BUSD: require('../../assets/crypto/busd.png'),
};

const PAYMENT_MODE_LOGOS: Record<string, ImageSourcePropType> = {
  // Dépôts mobiles (codes courts)
  paydunya: require('../../assets/operators/paydunya.png'),
  'pdy-mode': require('../../assets/operators/paydunya.png'),
  kkiabj: require('../../assets/operators/kkiapay.png'),
  kkiaci: require('../../assets/operators/kkiapay.png'),
  kkiang: require('../../assets/operators/kkiapay.png'),
  kkiapay: require('../../assets/operators/kkiapay.png'),
  'kia-mode': require('../../assets/operators/kkiapay.png'),
  payci: require('../../assets/operators/payci.png'),
  // Retraits mobiles (codes longs tels que stockés dans le mode)
  'mtn-benin': require('../../assets/operators/pay_mtn.png'),
  'moov-benin': require('../../assets/operators/pay_moov.png'),
  'moov-burkina-faso': require('../../assets/operators/pay_moov.png'),
  'moov-burkina': require('../../assets/operators/pay_moov.png'),
  'orange-money-burkina': require('../../assets/operators/pay_orange.jpg'),
  'moov-ci': require('../../assets/operators/pay_moov.png'),
  'mtn-ci': require('../../assets/operators/pay_mtn.png'),
  'orange-money-ci': require('../../assets/operators/pay_orange.jpg'),
  'wave-ci': require('../../assets/operators/pay_wave.jpg'),
  't-money-togo': require('../../assets/operators/pay_tmoney.jpg'),
  'moov-togo': require('../../assets/operators/pay_moov.png'),
  'orange-money-senegal': require('../../assets/operators/pay_orange.jpg'),
  'wave-senegal': require('../../assets/operators/pay_wave.jpg'),
  'expresso-senegal': require('../../assets/operators/pay_wave.jpg'),
  'free-money-senegal': require('../../assets/operators/pay_wave.jpg'),
  'orange-money-mali': require('../../assets/operators/pay_orange.jpg'),
  'moov-mali': require('../../assets/operators/pay_moov.png'),
  'mtn-cameroun': require('../../assets/operators/pay_mtn.png'),
  'card': require('../../assets/operators/pay_card.jpg'),
  'visa-mastercard': require('../../assets/operators/pay_card.jpg'),
  'visa-mastercard-2': require('../../assets/operators/pay_card.jpg'),
  // Rails Fincra (mode stocké par rail : fincra-bank_transfer / -mobile_money / -checkout)
  'fincra-bank_transfer': require('../../assets/operators/pay_bank.png'),
  'fincra-mobile_money': require('../../assets/operators/pay_fincra.png'),
  'fincra-checkout': require('../../assets/operators/pay_card.jpg'),
  // Types spéciaux
  'referal': require('../../assets/picto.png'),
  'commission': require('../../assets/picto.png'),
  'reward': require('../../assets/picto.png'),
  'manual': require('../../assets/picto.png'),
};

export function getTransactionLogo(transaction: Transaction): ImageSourcePropType | null {
  // Types spéciaux avec picto
  const specialType = (transaction.type as string)?.toLowerCase();
  if (specialType === 'referal' || specialType === 'commission' || specialType === 'reward' || specialType === 'manual') {
    return PAYMENT_MODE_LOGOS[specialType] ?? null;
  }
  
  if (transaction.type === 'crypto') {
    let key = (transaction.currency_src ?? '').toUpperCase();
    // Normaliser: remplacer les points et tirets par des underscores
    key = key.replace(/[.-]/g, '_');
    // Chercher d'abord la clé complète normalisée
    if (CRYPTO_LOGOS[key]) return CRYPTO_LOGOS[key];
    // Chercher la base (ex: USDT dans USDT_TRC20)
    const baseCrypto = key.split('_')[0];
    if (CRYPTO_LOGOS[baseCrypto]) return CRYPTO_LOGOS[baseCrypto];
    return null;
  }
  if (transaction.mode) {
    const mode = transaction.mode.toLowerCase();
    // Try OPERATORS first
    const op = OPERATORS.find((o) => o.id === mode);
    if (op) return op.logo as ImageSourcePropType;
    // Catalogue serveur (nouveaux moyens AfribaPay/Fincra : amanata-ne, fincra-mm-…)
    const catOp = useCatalogStore.getState().operators.find((o) => o.id.toLowerCase() === mode);
    if (catOp?.logo) return catOp.logo as ImageSourcePropType;
    // Fallback to payment mode logos (lookup normalisé en minuscule)
    return PAYMENT_MODE_LOGOS[mode] ?? null;
  }
  return null;
}

const MODE_LABELS: Record<string, string> = {
  paydunya: 'PayDunya', 'pdy-mode': 'PayDunya',
  kkiabj: 'KkiaPay', kkiaci: 'KkiaPay', kkiang: 'KkiaPay', kkiapay: 'KkiaPay', 'kia-mode': 'KkiaPay',
  payci: 'PayCI',
  'mtn-benin': 'MTN Momo', 'moov-benin': 'Moov Money',
  'moov-burkina-faso': 'Moov Money', 'moov-burkina': 'Moov Money',
  'orange-money-burkina': 'Orange Money',
  'moov-ci': 'Moov Money', 'mtn-ci': 'MTN Momo',
  'orange-money-ci': 'Orange Money', 'wave-ci': 'Wave',
  't-money-togo': 'T-Money', 'moov-togo': 'Moov Money',
  'orange-money-senegal': 'Orange Money', 'wave-senegal': 'Wave',
  'expresso-senegal': 'Expresso', 'free-money-senegal': 'Free Money',
  'orange-money-mali': 'Orange Money', 'moov-mali': 'Moov Money',
  'mtn-cameroun': 'MTN Momo',
  'card': 'Carte Bancaire', 'visa-mastercard': 'Visa/Mastercard', 'visa-mastercard-2': 'Visa/Mastercard',
  'fincra-bank_transfer': 'Virement bancaire', 'fincra-mobile_money': 'Mobile Money', 'fincra-checkout': 'Carte bancaire',
  'referal': 'Parrainage', 'commission': 'Commission', 'reward': 'Récompense', 'manual': 'Manuel',
};

const PROVIDER_I18N_KEYS: Record<string, string> = {
  'card': 'transaction.card',
  'referal': 'transaction.referral',
  'commission': 'transaction.commission',
  'reward': 'transaction.reward',
  'manual': 'transaction.manual',
};

export function getModeName(transaction: Transaction, t?: (key: string) => string): string {
  if (!transaction.mode) return '';
  const key = transaction.mode.toLowerCase();
  if (t && PROVIDER_I18N_KEYS[key]) return t(PROVIDER_I18N_KEYS[key]);
  if (MODE_LABELS[key]) return MODE_LABELS[key];
  const op = OPERATORS.find((o) => o.id === key);
  if (op) return op.name;
  const catOp = useCatalogStore.getState().operators.find((o) => o.id.toLowerCase() === key);
  if (catOp) return catOp.name;
  return transaction.mode;
}

const TYPE_ICONS: Record<string, string> = {
  deposit: 'arrow-down',
  withdraw: 'arrow-up',
  transfer: 'right-left',
  crypto: 'bitcoin-sign',
};

const getTypeLabel = (t: any) => ({
  deposit: t('transaction.deposit'),
  withdraw: t('transaction.withdraw'),
  transfer: t('transaction.transfer'),
  crypto: t('transaction.crypto'),
});

const STATUS_ICONS: Record<string, string> = {
  success: 'circle-check',
  wait: 'clock',
  failed: 'circle-xmark',
  fail: 'circle-xmark',
};

export function TransactionItem({ transaction, onPress, padded = false }: TransactionItemProps) {
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const normalizedStatut =
    transaction.type === 'crypto'
      ? transaction.statut == 1 ? 'success' : transaction.statut == 0 ? 'failed' : 'wait'
      : transaction.statut;
  const styles = useThemedStyles(createStyles);
  const status = getTransactionStatus(t)[normalizedStatut] || { label: String(transaction.statut), color: '#888' };
  const icon = TYPE_ICONS[transaction.type] || 'circle-question';
  const statusIcon = STATUS_ICONS[normalizedStatut] || 'circle-question';
  const logo = getTransactionLogo(transaction);

  return (
    <TouchableOpacity
      style={[styles.container, padded && styles.containerPadded]}
      onPress={() => onPress(transaction)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: status.color + '20' }]}>
        {logo ? (
          <Image source={logo} style={styles.logoImage} resizeMode="contain" />
        ) : (
          <FontAwesome6 name={icon} size={16} color={status.color} />
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.typeRow}>
          <FontAwesome6 name={statusIcon} size={12} color={status.color} style={{ marginRight: 6 }} />
          <Text style={styles.type}>
            {transaction.type === 'crypto'
              ? `${transaction.mode === 'Buy' ? t('history.buy') : t('history.sell')} ${transaction.currency_src ?? 'Crypto'}`
              : getTypeLabel(t)[transaction.type]}
          </Text>
        </View>
        <Text style={styles.date}>{formatDate(transaction.created_at)}</Text>
      </View>
      <View style={styles.amountContainer}>
        <Text
          style={[
            styles.amount,
            { color: status.color },
          ]}
        >
          {transaction.type === 'deposit' ? '+' : '-'}
          {fmtXof(Number(transaction.amount))}
        </Text>
        <View style={[styles.badge, { backgroundColor: status.color + '30' }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  containerPadded: {
    paddingHorizontal: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xl,
  },
  info: {
    flex: 1,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  type: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  date: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.pill,
    marginTop: 4,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
});
