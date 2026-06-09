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
 * - Pour Fincra : icône généraliste FontAwesome selon le rail (mobile-screen, building-columns, credit-card).
 *
 * Le logo du provider Fincra est exposé séparément via `<GatewayBadge>` en mode admin.
 */
export function OperatorLogo({ op, size = 26, style }: Props) {
  // Fincra : pas d'image, on utilise une icône généraliste basée sur le rail.
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
