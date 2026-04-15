import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { Colors, BorderRadius, FontSize, Spacing, Fonts } from '../constants/theme';

interface PickerItem {
  label: string;
  value: string;
}

interface PickerProps {
  label?: string;
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: PickerItem[];
  containerStyle?: ViewStyle;
}

export function Picker({
  label,
  selectedValue,
  onValueChange,
  items,
  containerStyle,
}: PickerProps) {
  const [open, setOpen] = React.useState(false);
  const selectedItem = items.find((i) => i.value === selectedValue);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={styles.selectorText}>
          {selectedItem?.label || 'Sélectionner...'}
        </Text>
        <Text style={styles.arrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <ScrollView style={styles.dropdown} nestedScrollEnabled>
          {items.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.option,
                item.value === selectedValue && styles.optionSelected,
              ]}
              onPress={() => {
                onValueChange(item.value);
                setOpen(false);
              }}
            >
              <Text
                style={[
                  styles.optionText,
                  item.value === selectedValue && styles.optionTextSelected,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
    fontFamily: Fonts.semiBold,
  },
  selector: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    color: Colors.text,
    fontSize: FontSize.md,
  },
  arrow: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  dropdown: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  option: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  optionSelected: {
    backgroundColor: Colors.primary + '30',
  },
  optionText: {
    color: Colors.text,
    fontSize: FontSize.md,
  },
  optionTextSelected: {
    color: Colors.secondary,
    fontFamily: Fonts.semiBold,
  },
});
