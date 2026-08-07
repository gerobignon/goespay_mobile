import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  const [taskTab, setTaskTab] = useState<'details' | 'comments' | undefined>(undefined);
  const [backlogVisible, setBacklogVisible] = useState(false);
  const [boardH, setBoardH] = useState(0);
  // `?task=<id>` posé par le tap sur une notification de commentaire.
  const { task: taskParam } = useLocalSearchParams<{ task?: string }>();
  const openedFromParamRef = useRef<number | null>(null);

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

  // Arrivée depuis une notification (`?task=<id>`) : on ouvre la tâche annoncée
  // sur son fil de commentaires — venir d'une notif de commentaire pour
  // atterrir sur le board entier obligeait à retrouver la carte à la main.
  // Le board peut n'être pas encore chargé : on attend qu'il le soit.
  useEffect(() => {
    const wanted = Number(taskParam);
    if (!wanted || !board || openedFromParamRef.current === wanted) return;
    const found = [...Object.values(board.tasks_by_status || {}).flat(), ...(board.backlog || [])].find(
      (t) => t.id === wanted,
    );
    if (!found) return;
    openedFromParamRef.current = wanted;
    setEditingTask(found);
    setTaskTab('comments');
    setTaskModal(true);
  }, [taskParam, board]);

  if (!user || user.id !== 1) return null;

  const openNew = (status: DevStatus) => {
    setEditingTask(null);
    setNewStatus(status);
    setTaskTab('details');
    setTaskModal(true);
  };
  const openEdit = (task: DevTask, tab?: 'details' | 'comments') => {
    setEditingTask(task);
    setTaskTab(tab);
    setTaskModal(true);
  };

  const columnWidth = width >= 768 ? 320 : Math.min(width * 0.82, 340);

  // La tâche ouverte est relue depuis le board pour refléter les rafraîchissements
  // (compteur de commentaires, non-lus) sans rouvrir la modale.
  const openTask = editingTask
    ? [...Object.values(board?.tasks_by_status || {}).flat(), ...(board?.backlog || [])].find(
        (t) => t.id === editingTask.id,
      ) || editingTask
    : null;

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
                      <FontAwesome6 name={col.icon.replace('fa-', '') as any} size={13} color={styles.colLabel.color} />
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
                          onPressComments={() => openEdit(task, 'comments')}
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
            task={openTask}
            initialStatus={newStatus}
            initialTab={taskTab}
            board={board}
            onClose={() => setTaskModal(false)}
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
      backgroundColor: withAlpha(Colors.text, 0.04),
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: Colors.surfaceBorder,
      overflow: 'hidden',
    },
    colHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md - 2,
    },
    colLabel: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.bold },
    colCount: {
      minWidth: 24,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 7,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colCountTxt: { color: Colors.textMuted, fontSize: FontSize.xs, fontFamily: Fonts.bold },
    colBody: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.lg },
    muted: { color: Colors.textMuted },
    addCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: Colors.border,
    },
    addCardTxt: { color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.semiBold },
  });
