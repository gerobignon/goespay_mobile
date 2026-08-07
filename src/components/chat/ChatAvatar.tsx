import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Fonts, withAlpha, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useColors } from '../ThemeProvider';
import { initialsOf } from './chatFormat';

interface ChatAvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
  /** Pastille verte de présence (rien si l'autre a masqué son statut). */
  online?: boolean;
  /** Support : casque sur fond de marque plutôt que des initiales. */
  isSupport?: boolean;
}

/** Avatar rond : photo si elle existe, sinon initiales sur fond de marque. */
export function ChatAvatar({ name, uri, size = 48, online, isSupport }: ChatAvatarProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const dotSize = Math.max(9, Math.round(size * 0.26));

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: isSupport ? colors.primary : withAlpha(colors.secondary, 0.22),
            },
          ]}
        >
          {isSupport ? (
            <FontAwesome6 name="headset" size={size * 0.42} color={colors.white} />
          ) : (
            <Text style={[styles.initials, { fontSize: size * 0.36, color: colors.secondary }]}>
              {initialsOf(name)}
            </Text>
          )}
        </View>
      )}

      {online && (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderColor: colors.background,
              backgroundColor: colors.positive,
            },
          ]}
        />
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    image: {
      backgroundColor: Colors.surface,
    },
    fallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      fontFamily: Fonts.bold,
    },
    dot: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      borderWidth: 2,
    },
  });
