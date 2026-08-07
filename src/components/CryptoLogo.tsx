import React, { useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { isSvgUrl, localCryptoSource } from '../utils/cryptoLogos';

interface CryptoLogoProps {
  rate?: { code?: string; img?: string | null } | null;
  size?: number;
  /** Fond du cercle quand aucun logo n'est disponible. */
  fallbackBackground?: string;
  fallbackColor?: string;
}

/**
 * Logo d'une crypto, par ordre de préférence :
 *  1. URL fournie par l'API (logo uploadé en admin, sinon celui du catalogue
 *     NOWPayments — souvent un SVG, que <Image> ne rend PAS sur iOS/Android) ;
 *  2. asset local bundlé (les quelques cryptos historiques) ;
 *  3. initiale du code dans une pastille.
 *
 * Toute erreur de chargement retombe sur l'étape suivante : une URL cassée ne
 * doit jamais laisser un trou dans la liste.
 */
export function CryptoLogo({ rate, size = 32, fallbackBackground, fallbackColor }: CryptoLogoProps) {
  const [failed, setFailed] = useState(false);

  const url = typeof rate?.img === 'string' && rate.img.length > 0 ? rate.img : null;
  const local = localCryptoSource(rate?.code);
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  if (url && !failed) {
    // Sur le web, <img> gère nativement le SVG : SvgUri n'y est utile qu'en natif.
    if (isSvgUrl(url) && Platform.OS !== 'web') {
      return (
        <View style={[styles.wrap, dimensions, { backgroundColor: fallbackBackground }]}>
          <SvgUri uri={url} width={size} height={size} onError={() => setFailed(true)} />
        </View>
      );
    }
    return (
      <Image
        source={{ uri: url }}
        style={[dimensions, { backgroundColor: fallbackBackground }]}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }

  if (local) {
    return <Image source={local} style={dimensions} resizeMode="contain" />;
  }

  const initial = (rate?.code || '?').replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?';
  return (
    <View style={[styles.wrap, dimensions, { backgroundColor: fallbackBackground }]}>
      <Text style={{ fontSize: size * 0.45, fontWeight: '700', color: fallbackColor }}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
