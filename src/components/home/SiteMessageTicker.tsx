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
    // Relance manuelle à chaque fin de passage : Animated.loop ne reboucle pas
    // de façon fiable sur react-native-web.
    let stopped = false;
    const distance = containerW + textW;
    const run = () => {
      if (stopped) return;
      translateX.setValue(containerW);
      Animated.timing(translateX, {
        toValue: -textW,
        duration: (distance / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) run();
      });
    };
    run();
    return () => {
      stopped = true;
      translateX.stopAnimation();
    };
  }, [message, containerW, textW, translateX]);

  if (!message) return null;

  return (
    <View style={styles.banner}>
      <FontAwesome6 name="bullhorn" size={12} color="#fff" style={styles.icon} />
      <View
        style={styles.track}
        onLayout={(e) => setContainerW(Math.round(e.nativeEvent.layout.width))}
      >
        {/* Rail très large : le texte garde sa largeur intrinsèque sur une seule ligne
            (un élément absolu seul serait borné à la largeur du conteneur et se replierait, surtout sur web). */}
        <Animated.View style={[styles.slider, { transform: [{ translateX }] }]}>
          <Text
            style={styles.text}
            numberOfLines={1}
            onLayout={(e) => setTextW(Math.round(e.nativeEvent.layout.width))}
          >
            {message}
          </Text>
        </Animated.View>
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
  slider: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 10000,
    flexDirection: 'row',
  },
  text: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    lineHeight: 18,
  },
});
