import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useDevBoardStore } from '../../stores/devBoardStore';
import type { ColorPalette } from '../../constants/theme';
import { Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { DevTaskCard } from './DevTaskCard';
import { DevTaskModal } from './DevTaskModal';
import { DevCommentsModal } from './DevCommentsModal';
import { DevBacklogModal } from './DevBacklogModal';
import type { DevStatus, DevTask } from '../../types';

/** Écran du board Kanban Dev. `showBack` = affiche la flèche retour (route stack) ;
 *  sans elle, l'écran est une racine d'onglet. Réservé au user id 1. */
export function DevKanbanScreen({ showBack = false }: { showBack?: boolean }) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { board, isLoading, isRefreshing, error, fetchBoard, markSeen } = useDevBoardStore();

  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<DevTask | null>(null);
  const [newStatus, setNewStatus] = useState<DevStatus>('todo');
  const [commentsTask, setCommentsTask] = useState<DevTask | null>(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [backlogVisible, setBacklogVisible] = useState(false);
  const [boardH, setBoardH] = useState(0);

  // Réservé au super-admin (user id 1) — miroir de la garde backend (groupe admin).
  useEffect(() => {
    if (user && user.id !== 1) router.replace('/(tabs)');
  }, [user?.id]);

  // À chaque focus (ouverture de l'onglet/écran) : rafraîchit puis marque le board
  // « vu » → efface la part « nouvelles tâches » du badge (comme la sidebar /admin).
  useFocusEffect(
    useCallback(() => {
      if (!user || user.id !== 1) return;
      const hasData = !!useDevBoardStore.getState().board;
      fetchBoard(hasData).then(() => markSeen());
    }, [user?.id]),
  );

  if (!user || user.id !== 1) return null;

  const openNew = (status: DevStatus) => {
    setEditingTask(null);
    setNewStatus(status);
    setTaskModal(true);
  };
  const openEdit = (task: DevTask) => {
    setEditingTask(task);
    setTaskModal(true);
  };
  const openComments = (task: DevTask) => {
    setCommentsTask(task);
    setCommentsVisible(true);
  };

  const columnWidth = width >= 768 ? 320 : Math.min(width * 0.82, 340);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          {showBack && (
            <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
              <FontAwesome6 name="arrow-left" size={20} color={styles.title.color} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('dev.boardTitle')}</Text>
            {board && (
              <Text style={styles.subtitle}>
                {t('dev.taskCount', { count: board.counts.total })}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setBacklogVisible(true)} hitSlop={8}>
            <FontAwesome6 name="lightbulb" size={16} color={styles.title.color} />
            {board && board.counts.backlog > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeTxt}>{board.counts.backlog}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => fetchBoard(true)} hitSlop={8}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color={styles.title.color} />
            ) : (
              <FontAwesome6 name="rotate" size={16} color={styles.title.color} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => openNew('todo')} hitSlop={8}>
            <FontAwesome6 name="plus" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Board */}
        <View style={{ flex: 1 }} onLayout={(e) => setBoardH(e.nativeEvent.layout.height)}>
          {isLoading && !board ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={styles.title.color} />
            </View>
          ) : error && !board ? (
            <View style={styles.center}>
              <Text style={styles.errorTxt}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchBoard()}>
                <Text style={styles.retryTxt}>{t('common.retry', 'Réessayer')}</Text>
              </TouchableOpacity>
            </View>
          ) : board ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.boardScroll}
            >
              {board.columns.map((col) => {
                const tasks = board.tasks_by_status[col.key] || [];
                return (
                  <View
                    key={col.key}
                    style={[styles.column, { width: columnWidth, height: boardH ? boardH - Spacing.md : undefined }]}
                  >
                    <View style={styles.colHeader}>
                      <FontAwesome6 name={col.icon.replace('fa-', '')} size={13} color={styles.colLabel.color} />
                      <Text style={styles.colLabel}>{col.label}</Text>
                      <View style={styles.colCount}>
                        <Text style={styles.colCountTxt}>{tasks.length}</Text>
                      </View>
                    </View>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.colBody} showsVerticalScrollIndicator={false}>
                      {tasks.map((task) => (
                        <DevTaskCard
                          key={task.id}
                          task={task}
                          priorities={board.priorities}
                          categories={board.categories}
                          platforms={board.platforms}
                          onPress={() => openEdit(task)}
                        />
                      ))}
                      <TouchableOpacity style={styles.addCard} onPress={() => openNew(col.key)}>
                        <FontAwesome6 name="plus" size={12} color={styles.muted.color} />
                        <Text style={styles.addCardTxt}>{t('dev.addTask')}</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      </SafeAreaView>

      {board && (
        <>
          <DevTaskModal
            visible={taskModal}
            task={editingTask}
            initialStatus={newStatus}
            board={board}
            onClose={() => setTaskModal(false)}
            onOpenComments={openComments}
          />
          <DevCommentsModal
            visible={commentsVisible}
            task={commentsTask}
            onClose={() => setCommentsVisible(false)}
          />
          <DevBacklogModal
            visible={backlogVisible}
            board={board}
            onClose={() => setBacklogVisible(false)}
            onEditTask={(task) => {
              setBacklogVisible(false);
              openEdit(task);
            }}
            onNew={() => {
              setBacklogVisible(false);
              openNew('later');
            }}
          />
        </>
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
    },
    title: { color: Colors.text, fontSize: FontSize.xl, fontFamily: Fonts.bold },
    subtitle: { color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.regular },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: Colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBadgeTxt: { color: Colors.black, fontSize: FontSize.xs, fontFamily: Fonts.bold },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
    errorTxt: { color: Colors.textMuted, fontSize: FontSize.md, fontFamily: Fonts.medium, textAlign: 'center' },
    retryBtn: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.pill,
      backgroundColor: Colors.primary,
    },
    retryTxt: { color: '#fff', fontFamily: Fonts.semiBold },
    boardScroll: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.md },
    column: {
      backgroundColor: withAlpha(Colors.text, 0.03),
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.surfaceBorder,
    },
    colHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    colLabel: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.bold },
    colCount: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colCountTxt: { color: Colors.textMuted, fontSize: FontSize.xs, fontFamily: Fonts.bold },
    colBody: { padding: Spacing.sm, paddingBottom: Spacing.lg },
    muted: { color: Colors.textMuted },
    addCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: Colors.border,
    },
    addCardTxt: { color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.semiBold },
  });
