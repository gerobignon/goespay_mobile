import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useColors } from './ThemeProvider';

export interface SheetAction {
  label: string;
  icon?: string;
  /** Rouge : suppression, blocage, signalement. */
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
}

/**
 * Feuille d'options qui monte du bas.
 *
 * Le CustomAlert du projet range ses boutons en ligne : passé deux entrées aux
 * libellés un peu longs, ils se chevauchent et deviennent illisibles. Un menu
 * contextuel a besoin d'une liste verticale — c'est ce que fait ce composant,
 * et c'est aussi ce que l'utilisateur attend d'un appui long.
 */
export function ActionSheet({ visible, title, subtitle, actions, onClose }: ActionSheetProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const run = (action: SheetAction) => {
    onClose();
    // Laisse la feuille se fermer avant de naviguer ou d'ouvrir une alerte.
    setTimeout(action.onPress, 120);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Le panneau ne doit pas fermer la feuille : on stoppe le toucher ici. */}
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]} onPress={() => {}}>
          <View style={styles.handle} />

          {!!title && (
            <View style={styles.head}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
            </View>
          )}

          {actions.map((action, i) => (
            <TouchableOpacity
              key={`${action.label}-${i}`}
              style={styles.action}
              onPress={() => run(action)}
              activeOpacity={0.65}
            >
              {!!action.icon && (
                <View
                  style={[
                    styles.actionIcon,
                    {
                      backgroundColor: action.destructive
                        ? withAlpha(colors.error, 0.15)
                        : withAlpha(colors.primary, 0.15),
                    },
                  ]}
                >
                  <FontAwesome6
                    name={action.icon as any}
                    size={15}
                    color={action.destructive ? colors.error : colors.primary}
                  />
                </View>
              )}
              <Text style={[styles.actionLabel, action.destructive && { color: colors.error }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelLabel}>{t('common.cancel', 'Annuler')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: Colors.cardSolid,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      // Confort sur grand écran web : la feuille reste centrée et bornée.
      alignSelf: 'center',
      width: '100%',
      maxWidth: 520,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      marginBottom: Spacing.sm,
    },
    head: {
      paddingHorizontal: Spacing.sm,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      marginBottom: Spacing.xs,
    },
    title: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.md,
      color: Colors.text,
    },
    subtitle: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      marginTop: 1,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md - 2,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    actionIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      flex: 1,
      fontFamily: Fonts.medium,
      fontSize: FontSize.md,
      color: Colors.text,
    },
    cancel: {
      marginTop: Spacing.xs,
      paddingVertical: Spacing.md - 2,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      backgroundColor: Colors.surface,
    },
    cancelLabel: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.md,
      color: Colors.textMuted,
    },
  });
