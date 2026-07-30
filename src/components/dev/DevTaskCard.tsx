import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import type { ColorPalette } from '../../constants/theme';
import { Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { DevRefItem, DevTask } from '../../types';

interface Props {
  task: DevTask;
  priorities: Record<string, DevRefItem>;
  categories: Record<string, DevRefItem>;
  platforms: Record<string, DevRefItem>;
  onPress: () => void;
}

export function DevTaskCard({ task, priorities, categories, platforms, onPress }: Props) {
  const styles = useThemedStyles(createStyles);
  const prio = priorities[task.priority];
  const cat = task.category ? categories[task.category] : null;
  const plat = task.platform ? platforms[task.platform] : null;
  const frozen = task.priority === 'frozen';
  const sub = task.subtask_stats;

  return (
    <TouchableOpacity
      style={[styles.card, frozen && styles.frozen, task.unread_count > 0 && styles.unread]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        {prio && <View style={[styles.dot, { backgroundColor: prio.color || '#888' }]} />}
        {cat && (
          <View style={[styles.chip, { backgroundColor: withAlpha(cat.color || '#888', 0.18) }]}>
            <Text style={[styles.chipTxt, { color: cat.color || undefined }]} numberOfLines={1}>
              {cat.label}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {plat?.icon && <FontAwesome6 name={plat.icon.replace('fa-', '')} size={11} color={styles.meta.color} />}
        {task.unread_count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{task.unread_count}</Text>
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={3}>
        {task.title}
      </Text>

      <View style={styles.footer}>
        {sub.total > 0 && (
          <View style={styles.metaItem}>
            <FontAwesome6 name="list-check" size={10} color={styles.meta.color} />
            <Text style={styles.meta}>
              {sub.done}/{sub.total}
            </Text>
          </View>
        )}
        {task.comments_count > 0 && (
          <View style={styles.metaItem}>
            <FontAwesome6 name="comment" size={10} color={styles.meta.color} />
            <Text style={styles.meta}>{task.comments_count}</Text>
          </View>
        )}
        {task.due_date && (
          <View style={styles.metaItem}>
            <FontAwesome6 name="calendar" size={10} color={styles.meta.color} />
            <Text style={styles.meta}>{task.due_date.slice(5)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {task.assignee && (
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{initials(task.assignee.label)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/);
  const a = parts[0]?.[0] || '';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase() || '?';
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.cardSolid,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.surfaceBorder,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    frozen: { opacity: 0.6 },
    unread: { borderColor: Colors.primary, backgroundColor: withAlpha(Colors.primary, 0.08) },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm, maxWidth: 120 },
    chipTxt: { fontSize: FontSize.xs, fontFamily: Fonts.semiBold },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeTxt: { color: Colors.white, fontSize: FontSize.xs, fontFamily: Fonts.bold },
    title: { color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.semiBold, lineHeight: FontSize.md + 6 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    meta: { color: Colors.textMuted, fontSize: FontSize.xs, fontFamily: Fonts.medium },
    avatar: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: withAlpha(Colors.secondary, 0.25),
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: Colors.secondary, fontSize: 9, fontFamily: Fonts.bold },
  });
