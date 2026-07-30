import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ColorPalette } from '../../constants/theme';
import { Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useDevBoardStore } from '../../stores/devBoardStore';
import type { DevComment, DevTask } from '../../types';
import { DevFormattedText } from './devFormat';

interface Props {
  visible: boolean;
  task: DevTask | null;
  onClose: () => void;
}

function timeOf(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function DevCommentsModal({ visible, task, onClose }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { comments, isLoadingComments, fetchComments, addComment, updateComment } = useDevBoardStore();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [quote, setQuote] = useState<{ text: string; id: number } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && task) {
      setBody('');
      setQuote(null);
      setEditingId(null);
      fetchComments(task.id);
    }
  }, [visible, task?.id]);

  const ordered = [...comments].reverse(); // API desc → chronologique

  const submit = async () => {
    if (!task || !body.trim() || sending) return;
    setSending(true);
    try {
      if (editingId) {
        await updateComment(editingId, body.trim());
      } else {
        await addComment(task.id, body.trim(), quote?.text, quote?.id);
      }
      setBody('');
      setQuote(null);
      setEditingId(null);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  };

  const startQuote = (c: DevComment) => {
    setEditingId(null);
    setQuote({ text: c.body.replace(/\n+/g, ' '), id: c.id });
  };
  const startEdit = (c: DevComment) => {
    setQuote(null);
    setEditingId(c.id);
    setBody(c.body);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.header}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {task?.title}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <FontAwesome6 name="xmark" size={20} color={styles.headerTitle.color} />
              </TouchableOpacity>
            </View>

            {isLoadingComments ? (
              <View style={styles.center}>
                <ActivityIndicator color={styles.headerTitle.color} />
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={styles.list}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
              >
                {ordered.length === 0 && (
                  <Text style={styles.empty}>{t('dev.noComments')}</Text>
                )}
                {ordered.map((c) => (
                  <View key={c.id} style={[styles.bubbleRow, c.is_mine && styles.bubbleRowMine]}>
                    <View style={[styles.bubble, c.is_mine && styles.bubbleMine]}>
                      {!c.is_mine && <Text style={styles.author}>{c.author_name}</Text>}
                      {c.quote && (
                        <View style={styles.quoteBox}>
                          <Text style={styles.quoteTxt} numberOfLines={3}>
                            {c.quote.text}
                          </Text>
                        </View>
                      )}
                      <DevFormattedText body={c.body} style={styles.body} />
                      <View style={styles.bubbleFooter}>
                        <Text style={styles.time}>{timeOf(c.created_at)}</Text>
                        <TouchableOpacity onPress={() => startQuote(c)} hitSlop={8}>
                          <Text style={styles.action}>{t('dev.quote')}</Text>
                        </TouchableOpacity>
                        {c.editable && (
                          <TouchableOpacity onPress={() => startEdit(c)} hitSlop={8}>
                            <Text style={styles.action}>{t('common.edit', 'Modifier')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {(quote || editingId) && (
              <View style={styles.contextBar}>
                <FontAwesome6
                  name={editingId ? 'pen' : 'quote-left'}
                  size={12}
                  color={styles.contextTxt.color}
                />
                <Text style={styles.contextTxt} numberOfLines={1}>
                  {editingId ? t('common.edit', 'Modifier') : quote?.text}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setQuote(null);
                    setEditingId(null);
                    setBody('');
                  }}
                  hitSlop={8}
                >
                  <FontAwesome6 name="xmark" size={14} color={styles.contextTxt.color} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputBar}>
              <TextInput
                style={styles.input}
                value={body}
                onChangeText={setBody}
                placeholder={t('dev.commentPlaceholder')}
                placeholderTextColor={styles.time.color}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!body.trim() || sending) && { opacity: 0.5 }]}
                onPress={submit}
                disabled={!body.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <FontAwesome6 name="paper-plane" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: Colors.background,
      borderTopLeftRadius: BorderRadius.lg,
      borderTopRightRadius: BorderRadius.lg,
      height: '88%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    headerTitle: { flex: 1, color: Colors.text, fontSize: FontSize.lg, fontFamily: Fonts.bold },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.md, gap: Spacing.sm },
    empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg, fontFamily: Fonts.regular },
    bubbleRow: { flexDirection: 'row', marginBottom: Spacing.sm },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubble: {
      maxWidth: '86%',
      backgroundColor: Colors.cardSolid,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.surfaceBorder,
      padding: Spacing.sm + 2,
      gap: 4,
    },
    bubbleMine: { backgroundColor: withAlpha(Colors.primary, 0.15), borderColor: withAlpha(Colors.primary, 0.3) },
    author: { color: Colors.secondary, fontSize: FontSize.xs, fontFamily: Fonts.bold },
    quoteBox: {
      borderLeftWidth: 3,
      borderLeftColor: Colors.secondary,
      paddingLeft: Spacing.sm,
      paddingVertical: 2,
      backgroundColor: withAlpha(Colors.secondary, 0.08),
      borderRadius: 4,
    },
    quoteTxt: { color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.regular, fontStyle: 'italic' },
    body: { color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.regular, lineHeight: FontSize.md + 6 },
    bubbleFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 2 },
    time: { color: Colors.textMuted, fontSize: FontSize.xs, fontFamily: Fonts.regular },
    action: { color: Colors.primary, fontSize: FontSize.xs, fontFamily: Fonts.semiBold },
    contextBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    contextTxt: { flex: 1, color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.medium },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      backgroundColor: Colors.inputBg,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      color: Colors.text,
      fontSize: FontSize.md,
      fontFamily: Fonts.regular,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
