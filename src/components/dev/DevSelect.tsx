import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ColorPalette } from '../../constants/theme';
import { Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';

export interface DevOption {
  value: string | null;
  label: string;
  color?: string | null;
  icon?: string | null;
}

interface SelectProps {
  label: string;
  value: string | null;
  options: DevOption[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Masque la bordure basse (dernière ligne d'un groupe). */
  last?: boolean;
}

/** Ligne « label → valeur » qui ouvre une liste de choix (dropdown). */
export function DevSelect({ label, value, options, onChange, placeholder, last }: SelectProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) || null;

  return (
    <>
      <TouchableOpacity
        style={[styles.row, last && styles.rowLast]}
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowValue}>
          {selected?.color ? <View style={[styles.dot, { backgroundColor: selected.color }]} /> : null}
          {selected?.icon ? (
            <FontAwesome6 name={selected.icon.replace('fa-', '') as any} size={12} color={styles.valueTxt.color} />
          ) : null}
          <Text style={[styles.valueTxt, !selected && styles.placeholder]} numberOfLines={1}>
            {selected?.label || placeholder || t('dev.none')}
          </Text>
          <FontAwesome6 name="chevron-down" size={11} color={styles.chevron.color} />
        </View>
      </TouchableOpacity>

      <OptionsSheet
        visible={open}
        title={label}
        options={options}
        value={value}
        onClose={() => setOpen(false)}
        onPick={(v) => {
          onChange(v);
          setOpen(false);
        }}
      />
    </>
  );
}

function OptionsSheet({
  visible,
  title,
  options,
  value,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  options: DevOption[];
  value: string | null;
  onClose: () => void;
  onPick: (v: string | null) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.popover} onPress={() => {}}>
          <Text style={styles.popTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingBottom: Spacing.xs }}>
            {options.map((o) => {
              const active = o.value === value;
              return (
                <TouchableOpacity
                  key={String(o.value)}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => onPick(o.value)}
                  activeOpacity={0.7}
                >
                  {o.color ? <View style={[styles.dot, { backgroundColor: o.color }]} /> : null}
                  {o.icon ? (
                    <FontAwesome6 name={o.icon.replace('fa-', '') as any} size={13} color={styles.optionTxt.color} />
                  ) : null}
                  <Text style={[styles.optionTxt, active && styles.optionTxtActive]} numberOfLines={1}>
                    {o.label}
                  </Text>
                  {active && <FontAwesome6 name="check" size={13} color={styles.optionTxtActive.color} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Échéance : même ligne, mais avec un mini calendrier ──────────────────────

interface DateProps {
  label: string;
  value: string; // AAAA-MM-JJ ou ''
  onChange: (value: string) => void;
  last?: boolean;
}

const DAY_MS = 86400000;

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function DevDateSelect({ label, value, onChange, last }: DateProps) {
  const styles = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const valid = parsed && !isNaN(parsed.getTime()) ? parsed : null;
  const [cursor, setCursor] = useState(() => valid || new Date());

  const openPicker = () => {
    setCursor(valid || new Date());
    setOpen(true);
  };

  const locale = i18n.language || 'fr';
  const monthLabel = cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    // 2024-01-01 est un lundi → semaine commençant lundi.
    new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: 'narrow', timeZone: 'UTC' }),
  );

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ];
  const todayIso = iso(new Date());

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <>
      <TouchableOpacity style={[styles.row, last && styles.rowLast]} activeOpacity={0.7} onPress={openPicker}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowValue}>
          <Text style={[styles.valueTxt, !valid && styles.placeholder]} numberOfLines={1}>
            {valid ? valid.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : t('dev.none')}
          </Text>
          <FontAwesome6 name="chevron-down" size={11} color={styles.chevron.color} />
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.popover} onPress={() => {}}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.calNav}>
                <FontAwesome6 name="chevron-left" size={13} color={styles.optionTxt.color} />
              </TouchableOpacity>
              <Text style={styles.popTitle}>{monthLabel}</Text>
              <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={10} style={styles.calNav}>
                <FontAwesome6 name="chevron-right" size={13} color={styles.optionTxt.color} />
              </TouchableOpacity>
            </View>

            <View style={styles.calGrid}>
              {weekDays.map((d, i) => (
                <Text key={'w' + i} style={styles.calWeekDay}>
                  {d}
                </Text>
              ))}
              {cells.map((d, i) => {
                if (!d) return <View key={'e' + i} style={styles.calCell} />;
                const dIso = iso(d);
                const selected = dIso === value;
                const isToday = dIso === todayIso;
                return (
                  <TouchableOpacity
                    key={dIso}
                    style={[styles.calCell, selected && styles.calCellOn, !selected && isToday && styles.calCellToday]}
                    onPress={() => {
                      onChange(dIso);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.calDay, selected && styles.calDayOn]}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.calActions}>
              <TouchableOpacity
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Text style={styles.calAction}>{t('dev.none')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  onChange(todayIso);
                  setOpen(false);
                }}
              >
                <Text style={styles.calAction}>{t('dev.today')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  onChange(iso(new Date(Date.now() + 7 * DAY_MS)));
                  setOpen(false);
                }}
              >
                <Text style={styles.calAction}>{t('dev.inAWeek')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md - 2,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { color: Colors.textMuted, fontSize: FontSize.md, fontFamily: Fonts.medium },
    rowValue: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
    valueTxt: { color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.semiBold, flexShrink: 1 },
    placeholder: { color: Colors.textMuted, fontFamily: Fonts.regular },
    chevron: { color: Colors.textMuted },
    dot: { width: 9, height: 9, borderRadius: 5 },

    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    popover: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: Colors.cardSolid,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: Colors.surfaceBorder,
      padding: Spacing.sm,
    },
    popTitle: {
      color: Colors.text,
      fontSize: FontSize.md,
      fontFamily: Fonts.bold,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm,
      textTransform: 'capitalize',
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm + 4,
      borderRadius: BorderRadius.md,
    },
    optionActive: { backgroundColor: withAlpha(Colors.primary, 0.15) },
    optionTxt: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.medium },
    optionTxtActive: { color: Colors.primary, fontFamily: Fonts.bold },

    calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    calNav: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.surface,
    },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm },
    calWeekDay: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      color: Colors.textMuted,
      fontSize: FontSize.xs,
      fontFamily: Fonts.semiBold,
      paddingBottom: Spacing.xs,
      textTransform: 'uppercase',
    },
    calCell: {
      width: `${100 / 7}%`,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calCellOn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
    calCellToday: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md },
    calDay: { color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.medium },
    calDayOn: { color: '#fff', fontFamily: Fonts.bold },
    calActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.sm,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
      marginTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    calAction: { color: Colors.primary, fontSize: FontSize.sm, fontFamily: Fonts.semiBold },
  });
