import React from 'react';
import { Image, StyleSheet, View, ImageStyle, ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

const PAYDUNYA = require('../../assets/operators/paydunya.png');
const AFRIBAPAY = require('../../assets/operators/afribapay.png');
const FINCRA = require('../../assets/operators/pay_fincra.png');
const KLASHA = require('../../assets/operators/pay_klasha.png');
const KKIAPAY = require('../../assets/operators/kkiapay.png');

interface OperatorLike {
  id: string;
  afribapay?: true;
  fincra?: true;
  klasha?: true;
  kkiapay?: true;
  // Chine traitée à la main (Manual China) : tuile Klasha servie par l'admin.
  cnyManual?: boolean;
}

interface Props {
  op: OperatorLike;
  visible: boolean;
  size?: number;
  style?: ViewStyle;
}

/**
 * Small badge showing the payment gateway that handles a given operator.
 * Only rendered for admin users so they can quickly identify which provider
 * (PayDunya / AfribaPay / Fincra / Klasha / KkiaPay) is wired behind each card.
 *
 * Note : le rail `card` (Carte bancaire) est routé via PayDunya Checkout
 * (cf. api_mobile.php). KkiaPay a ses propres corridors (kkiapay-mm-… et kkiapay-card).
 */
export function GatewayBadge({ op, visible, size = 16, style }: Props) {
  if (!visible) return null;
  if (op.cnyManual) {
    return (
      <View style={[styles.badge, style]} pointerEvents="none">
        <View style={[styles.manual, { width: size, height: size, borderRadius: size / 2 }]}>
          <FontAwesome6 name="hand-holding-dollar" size={Math.round(size * 0.55)} color="#FFFFFF" iconStyle="solid" />
        </View>
      </View>
    );
  }
  const source = op.klasha    ? KLASHA
               : op.fincra    ? FINCRA
               : op.kkiapay   ? KKIAPAY
               : op.afribapay ? AFRIBAPAY
               : PAYDUNYA;
  const imgStyle: ImageStyle = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.badge, style]} pointerEvents="none">
      <Image source={source} style={imgStyle} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  manual: {
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'white',
    borderRadius: 999,
    padding: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
