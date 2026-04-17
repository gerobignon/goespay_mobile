import React, { ReactNode } from 'react';
import { Modal, View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Colors, type ColorPalette, BorderRadius, Spacing } from '../constants/theme';

interface ResponsiveModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Full-screen modal on mobile, centered panel with backdrop on tablet/desktop.
 */
export function ResponsiveModal({ visible, onClose, children }: ResponsiveModalProps) {
  const { isWide, modalWidth } = useResponsive();
  const styles = useThemedStyles(createStyles);

  if (!isWide) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        {children}
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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.panel, { width: modalWidth }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ flexGrow: 0 }}
            showsVerticalScrollIndicator
            bounces={false}
          >
            {children}
          </ScrollView>
        </Pressable>
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
  },
  scroll: {
    maxHeight: '100%',
  },
});
