import React from 'react';
import { Image, StyleSheet, View, ImageStyle, ViewStyle } from 'react-native';

const PAYDUNYA = require('../../assets/operators/paydunya.png');
const AFRIBAPAY = require('../../assets/operators/afribapay.png');

interface OperatorLike {
  id: string;
  afribapay?: true;
  fincra?: true;
}

interface Props {
  op: OperatorLike;
  visible: boolean;
  size?: number;
  style?: ViewStyle;
}

/**
 * Small badge showing the payment gateway that handles a given mobile money
 * operator. Only rendered for admin users so they can quickly identify which
 * provider (PayDunya Softpay / AfribaPay) is wired behind each operator card.
 * Card payments are routed via a different checkout flow → no badge.
 */
export function GatewayBadge({ op, visible, size = 16, style }: Props) {
  if (!visible) return null;
  if (op.id === 'card' || op.fincra) return null;
  const source = op.afribapay ? AFRIBAPAY : PAYDUNYA;
  const imgStyle: ImageStyle = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.badge, style]} pointerEvents="none">
      <Image source={source} style={imgStyle} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
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
