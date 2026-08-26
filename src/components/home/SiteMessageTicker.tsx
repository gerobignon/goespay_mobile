import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useConfigStore } from '../../stores/configStore';

const SPEED = 45; // px/s

/**
 * Message défilant piloté depuis /admin/settings (Goes.message → /config.site_message).
 * Masqué quand le message est vide. Le texte défile en boucle de droite à gauche.
 */
export function SiteMessageTicker() {
  const message = useConfigStore((s) => s.site_message);
  const styles = useThemedStyles(createStyles);
  const translateX = useRef(new Animated.Value(0)).current;
  const [containerW, setContainerW] = useState(0);
  const [textW, setTextW] = useState(0);

  useEffect(() => {
    if (!message || containerW <= 0 || textW <= 0) return;
    const distance = containerW + textW;
    translateX.setValue(containerW);
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: -textW,
        duration: (distance / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [message, containerW, textW, translateX]);

  if (!message) return null;

  return (
    <View style={styles.banner}>
      <FontAwesome6 name="bullhorn" size={12} color="#fff" style={styles.icon} />
      <View
        style={styles.track}
        onLayout={(e) => setContainerW(Math.round(e.nativeEvent.layout.width))}
      >
        {/* Position absolue : largeur intrinsèque du texte (non contrainte par le conteneur). */}
        <Animated.Text
          style={[styles.text, { transform: [{ translateX }] }]}
          onLayout={(e) => setTextW(Math.round(e.nativeEvent.layout.width))}
        >
          {message}
        </Animated.Text>
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  icon: {
    marginRight: 8,
  },
  track: {
    flex: 1,
    height: 18,
    overflow: 'hidden',
  },
  text: {
    position: 'absolute',
    left: 0,
    top: 0,
    color: '#fff',
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    lineHeight: 18,
  },
});
