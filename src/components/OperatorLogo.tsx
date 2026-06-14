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
  /** Rend le logo dans une pastille ronde (comme l'historique / les autres écrans). */
  rounded?: boolean;
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
export function OperatorLogo({ op, size = 26, style, rounded }: Props) {
  // Image dans une pastille ronde (fond clair) — uniforme avec l'historique.
  const renderImage = (src: any) => {
    if (!rounded) {
      return <Image source={src} style={[{ width: size, height: size }, style as ImageStyle]} resizeMode="contain" />;
    }
    return (
      <View style={[styles.round, { width: size, height: size, borderRadius: size / 2 }, style as ViewStyle]}>
        <Image source={src} style={{ width: size * 0.66, height: size * 0.66 }} resizeMode="contain" />
      </View>
    );
  };

  // Fincra : on affiche le visuel résolu (logo de marque MM, carte, virement) dès
  // qu'il existe ; icône générique en dernier recours.
  if (op.fincra && op.logo) {
    return renderImage(op.logo);
  }
  if (op.fincra) {
    const iconName: any = op.rail === 'bank_transfer' ? 'building-columns'
                       : op.rail === 'checkout'      ? 'credit-card'
                       : 'mobile-screen';
    return (
      <View style={[styles.iconWrap, { width: size, height: size, borderRadius: size / 2 }, style as ViewStyle]}>
        <FontAwesome6 name={iconName} size={size * 0.55} color={DefaultColors.primary} iconStyle="solid" />
      </View>
    );
  }
  if (!op.logo) return null;
  return renderImage(op.logo);
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DefaultColors.primary + '15',
  },
  round: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#EEF2F7',
  },
});
