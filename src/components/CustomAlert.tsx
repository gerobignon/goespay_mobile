import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useAlertStore, AlertType } from '../stores/alertStore';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

const ICON_MAP: Record<AlertType, { name: string; color: string; bg: string }> = {
  error: { name: 'circle-xmark', color: Colors.error, bg: Colors.error + '20' },
  success: { name: 'circle-check', color: Colors.primary, bg: Colors.primary + '20' },
  warning: { name: 'triangle-exclamation', color: Colors.secondary, bg: Colors.secondary + '20' },
  info: { name: 'circle-info', color: Colors.primary, bg: Colors.primary + '20' },
};

export function CustomAlert() {
  const styles = useThemedStyles(createStyles);
  const visible = useAlertStore((s) => s.visible);
  const title = useAlertStore((s) => s.title);
  const message = useAlertStore((s) => s.message);
  const type = useAlertStore((s) => s.type);
  const buttons = useAlertStore((s) => s.buttons);
  const hide = useAlertStore((s) => s.hide);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const icon = ICON_MAP[type] || ICON_MAP.info;

  const handlePress = (onPress?: () => void) => {
    hide();
    setTimeout(() => onPress?.(), 100);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => handlePress()}>
      <TouchableWithoutFeedback onPress={() => handlePress()}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.container,
                {
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Icon */}
              <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
                <FontAwesome6 name={icon.name} size={24} color={icon.color} />
              </View>

              {/* Title */}
              <Text style={styles.title}>{title}</Text>

              {/* Message */}
              {message ? <Text style={styles.message}>{message}</Text> : null}

              {/* Buttons */}
              <View style={styles.buttonRow}>
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';
                  const isPrimary = !isCancel && !isDestructive && buttons.length <= 2;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        isPrimary && { backgroundColor: icon.color },
                        isCancel && styles.cancelButton,
                        isDestructive && { backgroundColor: Colors.error },
                        buttons.length === 1 && { flex: 0, minWidth: 140 },
                      ]}
                      onPress={() => handlePress(btn.onPress)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isPrimary && { color: Colors.white },
                          isCancel && styles.cancelButtonText,
                          isDestructive && { color: Colors.white },
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  message: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    width: '100%',
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  buttonText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  cancelButton: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
  },
});
