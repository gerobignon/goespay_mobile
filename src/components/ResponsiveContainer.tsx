import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveContainerProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Skip max-width centering */
  fluid?: boolean;
}

/**
 * Centers content with a max-width on tablet/desktop.
 * On mobile, renders full-width.
 */
export function ResponsiveContainer({ children, style, fluid }: ResponsiveContainerProps) {
  const { contentMaxWidth, isMobile } = useResponsive();

  if (fluid || isMobile) {
    return <View style={[styles.container, style]}>{children}</View>;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.centered, { maxWidth: contentMaxWidth }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
  },
});
