import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '../../utils/imageCompress';
import { useTranslation } from 'react-i18next';
import type { ColorPalette } from '../../constants/theme';
import { Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { showAlert } from '../../stores/alertStore';
import { CustomAlert } from '../CustomAlert';
import { useDevBoardStore } from '../../stores/devBoardStore';
import type { DevBoard, DevPriority, DevStatus, DevSubtask, DevTask } from '../../types';
import { DevSelect, DevDateSelect, type DevOption } from './DevSelect';
import { DevCommentsPanel } from './DevCommentsPanel';
import { ImageLightbox } from '../ImageLightbox';
import { useSheetViewport, sheetHeight } from './devSheet';

type Tab = 'details' | 'comments';

interface Props {
  visible: boolean;
  task: DevTask | null; // null = création
  initialStatus?: DevStatus;
  /** Onglet forcé ; sinon une tâche déjà commentée s'ouvre sur son fil. */
  initialTab?: Tab;
  board: DevBoard;
  onClose: () => void;
}

export function DevTaskModal({ visible, task, initialStatus, initialTab, board, onClose }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const viewportH = useSheetViewport();
  const { saveTask, deleteTask, archiveTask } = useDevBoardStore();

  const [tab, setTab] = useState<Tab>('details');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<DevStatus>('todo');
  const [priority, setPriority] = useState<DevPriority>('medium');
  const [category, setCategory] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [subtasks, setSubtasks] = useState<DevSubtask[]>([]);
  const [newSub, setNewSub] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setCategory(task.category);
      setPlatform(task.platform);
      setAssignedTo(task.assigned_to);
      setDueDate(task.due_date || '');
      setSubtasks(task.subtasks.map((s) => ({ ...s })));
    } else {
      setTitle('');
      setDescription('');
      setStatus(initialStatus || 'todo');
      setPriority('medium');
      setCategory(null);
      setPlatform(null);
      setAssignedTo(null);
      setDueDate('');
      setSubtasks([]);
    }
    setTab(task ? initialTab || (task.comments_count > 0 ? 'comments' : 'details') : 'details');
    setNewSub('');
    setImageUri(null);
    setRemoveImage(false);
    setZoomUri(null);
  }, [visible, task?.id, initialTab]);

  const pickImage = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      setImageUri(await compressImage(asset.uri, { width: asset.width, height: asset.height }));
      setRemoveImage(false);
    }
  };

  // ── Options des dropdowns ──
  const statusOptions: DevOption[] = [
    ...board.columns.map((c) => ({ value: c.key as string, label: c.label, icon: c.icon })),
    { value: 'later', label: t('dev.backlog'), icon: 'lightbulb' },
  ];
  const priorityOptions: DevOption[] = Object.entries(board.priorities).map(([key, p]) => ({
    value: key,
    label: p.label,
    color: p.color,
  }));
  const categoryOptions: DevOption[] = [
    { value: null, label: t('dev.none') },
    ...Object.entries(board.categories).map(([key, c]) => ({ value: key, label: c.label, color: c.color })),
  ];
  const platformOptions: DevOption[] = [
    { value: null, label: t('dev.none') },
    ...Object.entries(board.platforms).map(([key, p]) => ({ value: key, label: p.label, icon: p.icon })),
  ];
  const assigneeOptions: DevOption[] = [
    { value: null, label: t('dev.none') },
    ...board.assignees.map((a) => ({ value: String(a.id), label: a.label })),
  ];

  const save = async () => {
    if (!title.trim()) {
      showAlert(t('common.error'), t('dev.titleRequired'));
      return;
    }
    setSaving(true);
    try {
      await saveTask({
        id: task?.id,
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        category,
        platform,
        assigned_to: assignedTo,
        due_date: dueDate.trim() || null,
        subtasks: subtasks.filter((s) => s.label.trim() !== ''),
        imageUri: imageUri || undefined,
        removeImage: removeImage || undefined,
      });
      onClose();
    } catch (e: any) {
      showAlert(t('common.error'), e?.response?.data?.error || t('dev.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!task) return;
    showAlert(t('dev.deleteTitle'), t('dev.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete', 'Supprimer'),
        style: 'destructive',
        onPress: async () => {
          await deleteTask(task.id);
          onClose();
        },
      },
    ]);
  };

  const confirmArchive = () => {
    if (!task) return;
    showAlert(t('dev.archiveTitle'), t('dev.archiveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('dev.archive'),
        onPress: async () => {
          await archiveTask(task.id);
          onClose();
        },
      },
    ]);
  };

  const existingImage = task?.image_url && !removeImage && !imageUri ? task.image_url : null;
  const shownImage = imageUri || existingImage;
  const doneSubs = subtasks.filter((s) => s.done).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, viewportH ? { height: viewportH } : null]}>
        <SafeAreaView style={[styles.sheet, { height: sheetHeight('94%') }]} edges={['bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {task ? task.title || t('dev.editTask') : t('dev.newTask')}
              </Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
                <FontAwesome6 name="xmark" size={16} color={styles.headerTitle.color} />
              </TouchableOpacity>
            </View>

            {task && (
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, tab === 'details' && styles.tabOn]}
                  onPress={() => setTab('details')}
                >
                  <Text style={[styles.tabTxt, tab === 'details' && styles.tabTxtOn]}>{t('dev.tabDetails')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, tab === 'comments' && styles.tabOn]}
                  onPress={() => setTab('comments')}
                >
                  <Text style={[styles.tabTxt, tab === 'comments' && styles.tabTxtOn]}>
                    {t('dev.comments')}
                    {task.comments_count > 0 ? ` (${task.comments_count})` : ''}
                  </Text>
                  {task.unread_count > 0 && <View style={styles.tabDot} />}
                </TouchableOpacity>
              </View>
            )}

            {task && tab === 'comments' ? (
              <DevCommentsPanel task={task} />
            ) : (
              <>
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.body}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Titre + description */}
                  <TextInput
                    style={[styles.input, styles.titleInput]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t('dev.fieldTitle')}
                    placeholderTextColor={styles.muted.color}
                    multiline
                  />
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('dev.fieldDescription')}
                    placeholderTextColor={styles.muted.color}
                    multiline
                  />

                  {/* Attributs (dropdowns) */}
                  <View style={styles.group}>
                    <DevSelect
                      label={t('dev.fieldStatus')}
                      value={status}
                      options={statusOptions}
                      onChange={(v) => setStatus((v as DevStatus) || 'todo')}
                    />
                    <DevSelect
                      label={t('dev.fieldPriority')}
                      value={priority}
                      options={priorityOptions}
                      onChange={(v) => setPriority((v as DevPriority) || 'medium')}
                    />
                    <DevSelect
                      label={t('dev.fieldCategory')}
                      value={category}
                      options={categoryOptions}
                      onChange={setCategory}
                    />
                    <DevSelect
                      label={t('dev.fieldPlatform')}
                      value={platform}
                      options={platformOptions}
                      onChange={setPlatform}
                    />
                    <DevSelect
                      label={t('dev.fieldAssignee')}
                      value={assignedTo === null ? null : String(assignedTo)}
                      options={assigneeOptions}
                      onChange={(v) => setAssignedTo(v ? Number(v) : null)}
                    />
                    <DevDateSelect label={t('dev.fieldDueDate')} value={dueDate} onChange={setDueDate} last />
                  </View>

                  {/* Sous-tâches */}
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>{t('dev.fieldSubtasks')}</Text>
                    {subtasks.length > 0 && (
                      <Text style={styles.sectionMeta}>
                        {doneSubs}/{subtasks.length}
                      </Text>
                    )}
                  </View>
                  <View style={styles.group}>
                    {subtasks.map((s, i) => (
                      <View key={i} style={styles.subRow}>
                        <TouchableOpacity
                          onPress={() =>
                            setSubtasks((arr) => arr.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))
                          }
                          hitSlop={8}
                        >
                          <FontAwesome6
                            name={s.done ? 'square-check' : 'square'}
                            size={18}
                            color={s.done ? styles.accent.color : styles.muted.color}
                          />
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.subInput, s.done && styles.subDone]}
                          value={s.label}
                          multiline
                          onChangeText={(v) =>
                            setSubtasks((arr) => arr.map((x, j) => (j === i ? { ...x, label: v } : x)))
                          }
                        />
                        <TouchableOpacity onPress={() => setSubtasks((arr) => arr.filter((_, j) => j !== i))} hitSlop={8}>
                          <FontAwesome6 name="trash" size={13} color={styles.muted.color} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <View style={[styles.subRow, styles.subRowLast]}>
                      <FontAwesome6 name="plus" size={14} color={styles.accent.color} />
                      <TextInput
                        style={styles.subInput}
                        value={newSub}
                        onChangeText={setNewSub}
                        placeholder={t('dev.addSubtask')}
                        placeholderTextColor={styles.muted.color}
                        onSubmitEditing={() => {
                          if (newSub.trim()) {
                            setSubtasks((arr) => [...arr, { label: newSub.trim(), done: false }]);
                            setNewSub('');
                          }
                        }}
                      />
                    </View>
                  </View>

                  {/* Pièce jointe */}
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>{t('dev.fieldImage')}</Text>
                  </View>
                  {shownImage && (
                    <View style={styles.imageWrap}>
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setZoomUri(shownImage)}>
                        <Image source={{ uri: shownImage }} style={styles.image} resizeMode="cover" />
                      </TouchableOpacity>
                      <View style={styles.imageBadge}>
                        <FontAwesome6 name="magnifying-glass-plus" size={11} color="#fff" />
                      </View>
                      <TouchableOpacity
                        style={styles.imageRemove}
                        onPress={() => {
                          setImageUri(null);
                          setRemoveImage(true);
                        }}
                      >
                        <FontAwesome6 name="xmark" size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <TouchableOpacity style={styles.ghostBtn} onPress={pickImage}>
                    <FontAwesome6 name="image" size={14} color={styles.accent.color} />
                    <Text style={styles.ghostTxt}>{shownImage ? t('dev.replaceImage') : t('dev.pickImage')}</Text>
                  </TouchableOpacity>

                  {/* Actions sur tâche existante */}
                  {task && (
                    <View style={styles.actionsRow}>
                      <TouchableOpacity style={styles.actionBtn} onPress={confirmArchive}>
                        <FontAwesome6 name="box-archive" size={13} color={styles.muted.color} />
                        <Text style={[styles.actionTxt, { color: styles.muted.color }]}>{t('dev.archive')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={confirmDelete}>
                        <FontAwesome6 name="trash" size={13} color={styles.danger.color} />
                        <Text style={[styles.actionTxt, { color: styles.danger.color }]}>
                          {t('common.delete', 'Supprimer')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.saveBar}>
                  <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                    <Text style={styles.saveTxt}>{saving ? t('common.loading', '...') : t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>

        <ImageLightbox uri={zoomUri} onClose={() => setZoomUri(null)} />
        {/* Rendu dans la modale pour s'afficher au-dessus (modals frères masqués sur iOS). */}
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
      overflow: 'hidden',
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
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    headerTitle: { flex: 1, color: Colors.text, fontSize: FontSize.lg, fontFamily: Fonts.bold },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabs: {
      flexDirection: 'row',
      gap: Spacing.xs,
      margin: Spacing.md,
      marginTop: Spacing.xs,
      padding: 4,
      borderRadius: BorderRadius.pill,
      backgroundColor: Colors.surface,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.pill,
    },
    tabOn: { backgroundColor: Colors.cardSolid },
    tabTxt: { color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.semiBold },
    tabTxtOn: { color: Colors.text, fontFamily: Fonts.bold },
    tabDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },

    body: { padding: Spacing.md, paddingTop: Spacing.xs, paddingBottom: Spacing.xl, gap: Spacing.sm },
    input: {
      backgroundColor: Colors.inputBg,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 4,
      color: Colors.text,
      fontSize: FontSize.md,
      fontFamily: Fonts.regular,
    },
    titleInput: { fontSize: FontSize.lg, fontFamily: Fonts.semiBold, minHeight: 52 },
    textarea: { minHeight: 96, textAlignVertical: 'top', lineHeight: FontSize.md + 7 },
    muted: { color: Colors.textMuted },
    accent: { color: Colors.primary },
    danger: { color: Colors.error },

    group: {
      backgroundColor: Colors.cardSolid,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: Colors.surfaceBorder,
      overflow: 'hidden',
      marginTop: Spacing.xs,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.lg,
    },
    sectionTitle: { color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.bold },
    sectionMeta: { color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.semiBold },

    subRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    subRowLast: { borderBottomWidth: 0 },
    subInput: {
      flex: 1,
      color: Colors.text,
      fontSize: FontSize.md,
      fontFamily: Fonts.regular,
      lineHeight: FontSize.md + 6,
      paddingVertical: 2,
    },
    subDone: { textDecorationLine: 'line-through', color: Colors.textMuted },

    imageWrap: { marginTop: Spacing.sm, borderRadius: BorderRadius.lg, overflow: 'hidden' },
    image: { width: '100%', height: 200 },
    imageBadge: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageRemove: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingVertical: Spacing.md - 2,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: Colors.border,
    },
    ghostTxt: { color: Colors.primary, fontSize: FontSize.sm, fontFamily: Fonts.semiBold },

    actionsRow: {
      flexDirection: 'row',
      gap: Spacing.lg,
      marginTop: Spacing.xl,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionTxt: { fontSize: FontSize.sm, fontFamily: Fonts.semiBold },

    saveBar: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    saveBtn: {
      backgroundColor: Colors.primary,
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    saveTxt: { color: '#fff', fontSize: FontSize.lg, fontFamily: Fonts.bold },
  });
