import React, { ReactNode } from 'react';
import { ImageBackground, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';

interface ScreenBackgroundProps {
  children: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
}

export function ScreenBackground({ children, edges = ['top', 'bottom'], style }: ScreenBackgroundProps) {
  return (
    <ImageBackground
      source={require('../../assets/bg_page.jpg')}
      style={styles.background}
    >
      <SafeAreaView style={[styles.overlay, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23,30,43,0.25)',
  },
});
