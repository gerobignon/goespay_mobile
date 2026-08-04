import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ColorPalette } from '../../constants/theme';
import { Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useDevBoardStore } from '../../stores/devBoardStore';
import type { DevComment, DevTask } from '../../types';
import { DevFormattedText } from './devFormat';

const SWIPE_TRIGGER = 56;

function timeOf(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return '';
  }
}

/**
 * Fil de commentaires d'une tâche : bulles (swipe gauche/droite pour citer),
 * barre de mise en forme (*gras* _italique_ =souligné=) et aperçu du rendu.
 */
export function DevCommentsPanel({ task }: { task: DevTask }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { comments, commentsTaskId, isLoadingComments, fetchComments, addComment, updateComment } = useDevBoardStore();

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [quote, setQuote] = useState<{ text: string; id: number } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setBody('');
    setQuote(null);
    setEditingId(null);
    fetchComments(task.id);
  }, [task.id]);

  const ordered = useMemo(
    () => (commentsTaskId === task.id ? [...comments].reverse() : []), // API desc → chronologique
    [comments, commentsTaskId, task.id],
  );

  const submit = async () => {
    if (!body.trim() || sending) return;
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
    inputRef.current?.focus();
  };
  const startEdit = (c: DevComment) => {
    setQuote(null);
    setEditingId(c.id);
    setBody(c.body);
    inputRef.current?.focus();
  };

  /** Entoure la sélection (ou insère) avec un marqueur de mise en forme. */
  const wrap = (marker: string) => {
    const { start, end } = selection;
    if (end > start) {
      setBody(body.slice(0, start) + marker + body.slice(start, end) + marker + body.slice(end));
    } else {
      setBody(body + marker + marker);
    }
    inputRef.current?.focus();
  };

  const hasFormat = /[*_=]/.test(body);

  return (
    <View style={{ flex: 1 }}>
      {isLoadingComments && ordered.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={styles.action.color} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {ordered.length === 0 && <Text style={styles.empty}>{t('dev.noComments')}</Text>}
          {ordered.map((c) => (
            <SwipeToQuote key={c.id} onQuote={() => startQuote(c)}>
              <View style={[styles.bubbleRow, c.is_mine && styles.bubbleRowMine]}>
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
                    <View style={{ flex: 1 }} />
                    {c.editable && (
                      <TouchableOpacity onPress={() => startEdit(c)} hitSlop={8}>
                        <Text style={styles.action}>{t('common.edit', 'Modifier')}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => startQuote(c)} hitSlop={8}>
                      <Text style={styles.action}>{t('dev.quote')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </SwipeToQuote>
          ))}
        </ScrollView>
      )}

      {(quote || editingId) && (
        <View style={styles.contextBar}>
          <FontAwesome6 name={editingId ? 'pen' : 'quote-left'} size={12} color={styles.contextTxt.color} />
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

      {hasFormat && (
        <View style={styles.preview}>
          <DevFormattedText body={body} style={styles.previewTxt} />
        </View>
      )}

      <View style={styles.composer}>
        <View style={styles.toolbar}>
          <FormatBtn styles={styles} icon="bold" onPress={() => wrap('*')} />
          <FormatBtn styles={styles} icon="italic" onPress={() => wrap('_')} />
          <FormatBtn styles={styles} icon="underline" onPress={() => wrap('=')} />
        </View>
        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={body}
            onChangeText={setBody}
            onSelectionChange={(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) =>
              setSelection(e.nativeEvent.selection)
            }
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
              <FontAwesome6 name={editingId ? 'check' : 'paper-plane'} size={15} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function FormatBtn({ styles, icon, onPress }: { styles: any; icon: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.toolBtn} onPress={onPress}>
      <FontAwesome6 name={icon as any} size={12} color={styles.action.color} />
    </TouchableOpacity>
  );
}

/** Glisser la bulle (gauche ou droite) au-delà du seuil → cite le commentaire. */
function SwipeToQuote({ children, onQuote }: { children: React.ReactNode; onQuote: () => void }) {
  const tx = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_, g) => {
        tx.setValue(Math.max(-96, Math.min(96, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const trigger = Math.abs(g.dx) >= SWIPE_TRIGGER;
        Animated.spring(tx, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
        if (trigger) onQuote();
      },
      onPanResponderTerminate: () => {
        Animated.spring(tx, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
      },
    }),
  ).current;

  return (
    <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
      {children}
    </Animated.View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
    list: { padding: Spacing.md, paddingBottom: Spacing.lg },
    empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg, fontFamily: Fonts.regular },
    bubbleRow: { flexDirection: 'row', marginBottom: Spacing.sm },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubble: {
      maxWidth: '88%',
      backgroundColor: Colors.cardSolid,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: Colors.surfaceBorder,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      gap: 4,
    },
    bubbleMine: {
      backgroundColor: withAlpha(Colors.primary, 0.16),
      borderColor: withAlpha(Colors.primary, 0.3),
    },
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
    body: { color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.regular, lineHeight: FontSize.md + 7 },
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
    preview: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      backgroundColor: withAlpha(Colors.primary, 0.06),
    },
    previewTxt: { color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.regular, lineHeight: FontSize.md + 7 },
    composer: { borderTopWidth: 1, borderTopColor: Colors.border, paddingBottom: Spacing.sm },
    toolbar: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
    toolBtn: {
      width: 30,
      height: 30,
      borderRadius: BorderRadius.sm,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 44,
      backgroundColor: Colors.inputBg,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
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
