import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ColorPalette } from '../../constants/theme';
import { Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { showAlert } from '../../stores/alertStore';
import { CustomAlert } from '../CustomAlert';
import { useDevBoardStore } from '../../stores/devBoardStore';
import type { DevBoard, DevTask } from '../../types';
import { useSheetViewport } from './devSheet';

interface Props {
  visible: boolean;
  board: DevBoard;
  onClose: () => void;
  onEditTask: (task: DevTask) => void;
  onNew: () => void;
}

export function DevBacklogModal({ visible, board, onClose, onEditTask, onNew }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { sendToTodo, deleteTask } = useDevBoardStore();
  const viewportH = useSheetViewport();

  const confirmDelete = (task: DevTask) => {
    showAlert(t('dev.deleteTitle'), t('dev.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete', 'Supprimer'), style: 'destructive', onPress: () => deleteTask(task.id) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, viewportH ? { height: viewportH } : null]}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {t('dev.backlog')} ({board.backlog.length})
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <FontAwesome6 name="xmark" size={20} color={styles.headerTitle.color} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {board.backlog.length === 0 && <Text style={styles.empty}>{t('dev.backlogEmpty')}</Text>}
            {board.backlog.map((task) => {
              const prio = board.priorities[task.priority];
              return (
                <View key={task.id} style={styles.row}>
                  {prio && <View style={[styles.dot, { backgroundColor: prio.color || '#888' }]} />}
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => onEditTask(task)}>
                    <Text style={styles.title} numberOfLines={2}>
                      {task.title}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => sendToTodo(task.id)} hitSlop={6}>
                    <FontAwesome6 name="arrow-right-to-bracket" size={14} color={styles.accent.color} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => confirmDelete(task)} hitSlop={6}>
                    <FontAwesome6 name="trash" size={13} color={styles.muted.color} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.newBtn} onPress={onNew}>
              <FontAwesome6 name="plus" size={14} color="#fff" />
              <Text style={styles.newTxt}>{t('dev.newIdea')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <CustomAlert />
      </View>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: Colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '82%',
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      marginTop: Spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    headerTitle: { color: Colors.text, fontSize: FontSize.lg, fontFamily: Fonts.bold },
    list: { padding: Spacing.md, gap: Spacing.sm },
    empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg, fontFamily: Fonts.regular },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: Colors.cardSolid,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: Colors.surfaceBorder,
      padding: Spacing.md,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    title: { color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.medium },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accent: { color: Colors.primary },
    muted: { color: Colors.textMuted },
    footer: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: withAlpha(Colors.primary, 0.9),
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.md,
    },
    newTxt: { color: '#fff', fontSize: FontSize.md, fontFamily: Fonts.bold },
  });
