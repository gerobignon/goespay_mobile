import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Clipboard,
  Animated,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface Props {
  label: string;
  value: string;
  /** Affiche un badge coloré à la place du texte simple */
  badge?: boolean;
  badgeColor?: string;
  badgeIcon?: string;
  /** Affiche le bouton copier */
  copyable?: boolean;
  /** Affiche en valeur monétaire (fond légèrement coloré) */
  mono?: boolean;
  color?: string;
  /** Noeud personnalisé affiché à la place de la valeur (ex: logo opérateur + drapeau). */
  valueNode?: React.ReactNode;
}

export function TransactionDetailRow({
  label,
  value,
  badge,
  badgeColor,
  badgeIcon,
  copyable,
  mono,
  color,
  valueNode,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderValue = () => {
    if (valueNode) return valueNode;
    if (value === '—') {
      return <Text style={styles.muted}>—</Text>;
    }
    if (badge && badgeColor) {
      return (
        <View style={[styles.badge, { backgroundColor: badgeColor + '25' }]}>
          {badgeIcon && (
            <FontAwesome6
              name={badgeIcon as any}
              size={11}
              color={badgeColor}
              style={{ marginRight: 5 }}
            />
          )}
          <Text style={[styles.badgeText, { color: badgeColor }]}>{value}</Text>
        </View>
      );
    }
    if (mono) {
      return (
        <View style={styles.monoContainer}>
          <Text style={[styles.monoText, color ? { color } : undefined]}>{value}</Text>
        </View>
      );
    }
    return (
      <Text style={[styles.rowValue, color ? { color } : undefined]}>{value}</Text>
    );
  };

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={copyable && value !== '—' ? handleCopy : undefined}
      activeOpacity={copyable && value !== '—' ? 0.6 : 1}
      disabled={!copyable || value === '—'}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.valueCol}>
        {renderValue()}
        {copyable && value !== '—' && (
          <FontAwesome6
            name={copied ? 'circle-check' : 'clipboard'}
            size={13}
            color={copied ? Colors.positive : Colors.textMuted}
          />
        )}
        {copied && (
          <Text style={styles.copiedLabel}>{t('common.copied')} !</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    flex: 1,
    paddingRight: Spacing.sm,
  },
  rowValue: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    maxWidth: 180,
    textAlign: 'right',
  },
  muted: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },
  monoContainer: {
    backgroundColor: Colors.inputBg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    maxWidth: 180,
  },
  monoText: {
    color: Colors.text,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    textAlign: 'right',
  },
  valueCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 2,
  },
  copiedLabel: {
    color: Colors.positive,
    fontSize: 10,
    fontFamily: Fonts.semiBold,
  },
});
