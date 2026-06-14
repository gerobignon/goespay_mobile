import React, { ReactNode, useEffect, useRef } from 'react';
import { Modal, View, StyleSheet, Pressable, Platform, KeyboardAvoidingView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
import { useResponsive } from '../hooks/useResponsive';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from './ThemeProvider';
import { Colors, type ColorPalette, BorderRadius, Spacing } from '../constants/theme';

interface ResponsiveModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  disableBackdropClose?: boolean;
}

/**
 * Full-screen modal on mobile, centered panel with backdrop on tablet/desktop.
 */
export function ResponsiveModal({ visible, onClose, children, width, disableBackdropClose }: ResponsiveModalProps) {
  const { isWide, modalWidth } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  // Pop d'ouverture (desktop/large) : scale + fondu du panneau à chaque ouverture.
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 7, tension: 65 }).start();
    }
  }, [visible]);

  if (!isWide) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {children}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
  }

  // Desktop/tablet: transparent Modal renders above everything natively
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={disableBackdropClose ? undefined : onClose}>
        <AnimatedPressable
          style={[
            styles.panel,
            { width: width ?? modalWidth },
            { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.scroll}>
            {children}
          </View>
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 80,
  } as any,
  panel: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    maxHeight: '80%',
    display: 'flex',
    flexDirection: 'column',
  } as any,
  scroll: {
    flex: 1,
    minHeight: 0,
  } as any,
});
