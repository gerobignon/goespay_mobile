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
import { useTranslation } from 'react-i18next';
import type { ColorPalette } from '../../constants/theme';
import { Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { showAlert } from '../../stores/alertStore';
import { CustomAlert } from '../CustomAlert';
import { useDevBoardStore } from '../../stores/devBoardStore';
import type { DevBoard, DevPriority, DevStatus, DevSubtask, DevTask } from '../../types';

interface Props {
  visible: boolean;
  task: DevTask | null; // null = création
  initialStatus?: DevStatus;
  board: DevBoard;
  onClose: () => void;
  onOpenComments: (task: DevTask) => void;
}

export function DevTaskModal({ visible, task, initialStatus, board, onClose, onOpenComments }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { saveTask, deleteTask, archiveTask } = useDevBoardStore();

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
    setNewSub('');
    setImageUri(null);
    setRemoveImage(false);
  }, [visible, task?.id]);

  const pickImage = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setRemoveImage(false);
    }
  };

  const statusOptions: { key: DevStatus; label: string }[] = [
    ...board.columns.map((c) => ({ key: c.key, label: c.label })),
    { key: 'later' as DevStatus, label: t('dev.backlog') },
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {task ? t('dev.editTask') : t('dev.newTask')}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <FontAwesome6 name="xmark" size={20} color={styles.headerTitle.color} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {/* Titre */}
              <Text style={styles.label}>{t('dev.fieldTitle')}</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('dev.fieldTitle')} placeholderTextColor={styles.muted.color} />

              {/* Description */}
              <Text style={styles.label}>{t('dev.fieldDescription')}</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('dev.fieldDescription')}
                placeholderTextColor={styles.muted.color}
                multiline
              />

              {/* Statut */}
              <Text style={styles.label}>{t('dev.fieldStatus')}</Text>
              <View style={styles.chipsRow}>
                {statusOptions.map((o) => (
                  <Chip key={o.key} label={o.label} active={status === o.key} onPress={() => setStatus(o.key)} styles={styles} />
                ))}
              </View>

              {/* Priorité */}
              <Text style={styles.label}>{t('dev.fieldPriority')}</Text>
              <View style={styles.chipsRow}>
                {Object.entries(board.priorities).map(([key, p]) => (
                  <Chip
                    key={key}
                    label={p.label}
                    active={priority === key}
                    color={p.color}
                    onPress={() => setPriority(key as DevPriority)}
                    styles={styles}
                  />
                ))}
              </View>

              {/* Catégorie */}
              <Text style={styles.label}>{t('dev.fieldCategory')}</Text>
              <View style={styles.chipsRow}>
                <Chip label={t('dev.none')} active={!category} onPress={() => setCategory(null)} styles={styles} />
                {Object.entries(board.categories).map(([key, c]) => (
                  <Chip key={key} label={c.label} active={category === key} color={c.color} onPress={() => setCategory(key)} styles={styles} />
                ))}
              </View>

              {/* Plateforme */}
              <Text style={styles.label}>{t('dev.fieldPlatform')}</Text>
              <View style={styles.chipsRow}>
                <Chip label={t('dev.none')} active={!platform} onPress={() => setPlatform(null)} styles={styles} />
                {Object.entries(board.platforms).map(([key, p]) => (
                  <Chip key={key} label={p.label} active={platform === key} onPress={() => setPlatform(key)} styles={styles} />
                ))}
              </View>

              {/* Assigné */}
              <Text style={styles.label}>{t('dev.fieldAssignee')}</Text>
              <View style={styles.chipsRow}>
                <Chip label={t('dev.none')} active={!assignedTo} onPress={() => setAssignedTo(null)} styles={styles} />
                {board.assignees.map((a) => (
                  <Chip key={a.id} label={a.label} active={assignedTo === a.id} onPress={() => setAssignedTo(a.id)} styles={styles} />
                ))}
              </View>

              {/* Échéance */}
              <Text style={styles.label}>{t('dev.fieldDueDate')}</Text>
              <TextInput
                style={styles.input}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={styles.muted.color}
                autoCapitalize="none"
              />

              {/* Sous-tâches */}
              <Text style={styles.label}>{t('dev.fieldSubtasks')}</Text>
              {subtasks.map((s, i) => (
                <View key={i} style={styles.subRow}>
                  <TouchableOpacity
                    onPress={() => setSubtasks((arr) => arr.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
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
                    onChangeText={(v) => setSubtasks((arr) => arr.map((x, j) => (j === i ? { ...x, label: v } : x)))}
                  />
                  <TouchableOpacity onPress={() => setSubtasks((arr) => arr.filter((_, j) => j !== i))} hitSlop={8}>
                    <FontAwesome6 name="trash" size={14} color={styles.muted.color} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.subRow}>
                <FontAwesome6 name="plus" size={14} color={styles.muted.color} />
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

              {/* Pièce jointe */}
              <Text style={styles.label}>{t('dev.fieldImage')}</Text>
              {(existingImage || imageUri) && (
                <View style={styles.imageWrap}>
                  <Image source={{ uri: imageUri || existingImage! }} style={styles.image} resizeMode="cover" />
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
              <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                <FontAwesome6 name="image" size={14} color={styles.accent.color} />
                <Text style={styles.imageBtnTxt}>{t('dev.pickImage')}</Text>
              </TouchableOpacity>

              {/* Actions sur tâche existante */}
              {task && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => onOpenComments(task)}>
                    <FontAwesome6 name="comments" size={14} color={styles.accent.color} />
                    <Text style={styles.actionTxt}>
                      {t('dev.comments')} {task.comments_count > 0 ? `(${task.comments_count})` : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={confirmArchive}>
                    <FontAwesome6 name="box-archive" size={14} color={styles.muted.color} />
                    <Text style={[styles.actionTxt, { color: styles.muted.color }]}>{t('dev.archive')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={confirmDelete}>
                    <FontAwesome6 name="trash" size={14} color={styles.danger.color} />
                    <Text style={[styles.actionTxt, { color: styles.danger.color }]}>{t('common.delete', 'Supprimer')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View style={styles.saveBar}>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                <Text style={styles.saveTxt}>{saving ? t('common.loading', '...') : t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
        {/* Rendu dans la modale pour s'afficher au-dessus (modals frères masqués sur iOS). */}
        <CustomAlert />
      </View>
    </Modal>
  );
}

function Chip({
  label,
  active,
  color,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
  styles: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, active && color ? { backgroundColor: withAlpha(color, 0.25), borderColor: color } : null]}
      onPress={onPress}
    >
      {color && <View style={[styles.chipDot, { backgroundColor: color }]} />}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: Colors.background,
      borderTopLeftRadius: BorderRadius.lg,
      borderTopRightRadius: BorderRadius.lg,
      height: '94%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    headerTitle: { color: Colors.text, fontSize: FontSize.lg, fontFamily: Fonts.bold },
    body: { padding: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.xs },
    label: { color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.semiBold, marginTop: Spacing.md, marginBottom: 4 },
    input: {
      backgroundColor: Colors.inputBg,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      color: Colors.text,
      fontSize: FontSize.md,
      fontFamily: Fonts.regular,
    },
    textarea: { minHeight: 80, textAlignVertical: 'top' },
    muted: { color: Colors.textMuted },
    accent: { color: Colors.primary },
    danger: { color: Colors.error },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.pill,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    chipActive: { backgroundColor: withAlpha(Colors.primary, 0.2), borderColor: Colors.primary },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipLabel: { color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.medium },
    chipLabelActive: { color: Colors.text, fontFamily: Fonts.semiBold },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
    subInput: {
      flex: 1,
      color: Colors.text,
      fontSize: FontSize.md,
      fontFamily: Fonts.regular,
      paddingVertical: Spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    subDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
    imageWrap: { marginTop: 4, borderRadius: BorderRadius.md, overflow: 'hidden' },
    image: { width: '100%', height: 160, borderRadius: BorderRadius.md },
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
    imageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      alignSelf: 'flex-start',
      paddingVertical: Spacing.sm,
      marginTop: 4,
    },
    imageBtnTxt: { color: Colors.primary, fontSize: FontSize.sm, fontFamily: Fonts.semiBold },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
      marginTop: Spacing.lg,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionTxt: { color: Colors.primary, fontSize: FontSize.sm, fontFamily: Fonts.semiBold },
    saveBar: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    saveBtn: {
      backgroundColor: Colors.primary,
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    saveTxt: { color: '#fff', fontSize: FontSize.lg, fontFamily: Fonts.bold },
  });
