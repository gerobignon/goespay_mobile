import React from 'react';
import { Image, View, StyleSheet, type ImageStyle, type ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors as DefaultColors } from '../constants/theme';

interface OperatorLike {
  id: string;
  fincra?: true;
  rail?: string;
  logo?: any;
}

interface Props {
  op: OperatorLike;
  size?: number;
  style?: ImageStyle & ViewStyle;
}

/**
 * Rendu de l'icône principal d'un opérateur.
 *
 * - Pour PayDunya / AfribaPay / card classique : `<Image source={op.logo}>` (MTN, Moov, Orange, Wave…)
 * - Pour Fincra Mobile Money : logo de marque de l'opérateur (mtn/moov/orange…) si dispo.
 * - Pour Fincra virement/carte : icône généraliste FontAwesome (building-columns, credit-card).
 *
 * Le logo du provider Fincra est exposé séparément via `<GatewayBadge>` en mode admin.
 */
export function OperatorLogo({ op, size = 26, style }: Props) {
  // Fincra Mobile Money : le corridor porte un opérateur réel (mtn/moov/orange…)
  // dont le logo de marque est déjà résolu dans `op.logo` → on l'affiche comme
  // pour PayDunya/AfribaPay. Les rails virement/carte restent en icône générique.
  // Mobile money → logo de marque ; carte (checkout) → visuel carte (VISA/MC, pay_card).
  if (op.fincra && (op.rail === 'mobile_money' || op.rail === 'checkout' || !op.rail) && op.logo) {
    return <Image source={op.logo} style={[{ width: size, height: size }, style as ImageStyle]} resizeMode="contain" />;
  }
  // Fincra virement : icône généraliste.
  if (op.fincra) {
    const iconName: any = op.rail === 'bank_transfer' ? 'building-columns'
                       : op.rail === 'checkout'      ? 'credit-card'
                       : 'mobile-screen';
    return (
      <View style={[styles.iconWrap, { width: size + 6, height: size + 6 }, style as ViewStyle]}>
        <FontAwesome6 name={iconName} size={size * 0.6} color={DefaultColors.primary} iconStyle="solid" />
      </View>
    );
  }
  if (!op.logo) return null;
  return <Image source={op.logo} style={[{ width: size, height: size }, style as ImageStyle]} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: DefaultColors.primary + '15',
  },
});
