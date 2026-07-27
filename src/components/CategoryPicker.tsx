import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, type ExpenseCategory } from '@/lib/categories';

interface CategoryPickerProps {
  selected: ExpenseCategory | null;
  onSelect: (category: ExpenseCategory) => void;
}

export function CategoryPicker({ selected, onSelect }: CategoryPickerProps) {
  const theme = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {EXPENSE_CATEGORIES.map((cat) => {
        const isSelected = cat === selected;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(cat)}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceVariant,
                borderColor: isSelected ? theme.colors.primary : theme.custom.cardBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={CATEGORY_ICONS[cat] as any}
              size={16}
              color={isSelected ? '#fff' : theme.colors.onSurface + '99'}
            />
            <Text
              style={[
                styles.chipText,
                { color: isSelected ? '#fff' : theme.colors.onSurface + '99' },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// Full grid version for forms
export function CategoryGrid({ selected, onSelect }: CategoryPickerProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.grid}>
      {EXPENSE_CATEGORIES.map((cat) => {
        const isSelected = cat === selected;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(cat)}
            style={[
              styles.gridItem,
              {
                backgroundColor: isSelected ? theme.colors.primary + '22' : theme.colors.surfaceVariant,
                borderColor: isSelected ? theme.colors.primary : theme.custom.cardBorder,
                borderWidth: 1,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={CATEGORY_ICONS[cat] as any}
              size={20}
              color={isSelected ? theme.colors.primary : theme.colors.onSurface + '77'}
            />
            <Text
              style={[
                styles.gridText,
                { color: isSelected ? theme.colors.primary : theme.colors.onSurface + '99' },
              ]}
              numberOfLines={2}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '30%',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 4,
  },
  gridText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
