import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { CategoryKind, useFinanceStore } from '../../store/useFinanceStore';

const iconOptions: Array<keyof typeof Ionicons.glyphMap> = [
  'fast-food-outline',
  'car-outline',
  'basket-outline',
  'game-controller-outline',
  'flash-outline',
  'cash-outline',
  'briefcase-outline',
  'trending-up-outline',
  'storefront-outline',
  'gift-outline',
  'wallet-outline',
  'home-outline',
  'medkit-outline',
  'shirt-outline',
  'fitness-outline',
  'school-outline',
  'pricetag-outline',
];

const protectedCategories = ['Otros', 'Salario', 'Otros ingresos'];

export function CategoriesScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [newCategory, setNewCategory] = useState('');
  const expenseCategories = useFinanceStore((state) => state.transactionCategories);
  const incomeCategories = useFinanceStore((state) => state.incomeCategories);
  const categoryIcons = useFinanceStore((state) => state.categoryIcons);
  const addCategory = useFinanceStore((state) => state.addTransactionCategory);
  const setCategoryIcon = useFinanceStore((state) => state.setCategoryIcon);
  const removeCategory = useFinanceStore((state) => state.removeTransactionCategory);

  const categories = kind === 'income' ? incomeCategories : expenseCategories;

  const onCreate = () => {
    const normalized = newCategory.trim();
    if (!normalized) return;
    addCategory(normalized, kind);
    setNewCategory('');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}>
        <SectionTitle title="Categorías" subtitle="Separa las categorías de gastos y de ingresos" />

        <View style={styles.segmentRow}>
          {(['expense', 'income'] as const).map((option) => {
            const active = kind === option;
            return (
              <Pressable
                key={option}
                onPress={() => setKind(option)}
                style={[
                  styles.segment,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                  active && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
              >
                <Text style={[styles.segmentLabel, { color: active ? '#fff' : theme.text }]}>
                  {option === 'expense' ? 'Gastos' : 'Ingresos'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.addRow}>
          <TextInput
            value={newCategory}
            onChangeText={setNewCategory}
            placeholder={kind === 'income' ? 'Nueva categoría de ingreso' : 'Nueva categoría de gasto'}
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          />
          <Pressable style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={onCreate}>
            <Text style={styles.addButtonText}>Agregar</Text>
          </Pressable>
        </View>

        {categories
          .slice()
          .sort((a, b) => a.localeCompare(b))
          .map((category) => {
            const isProtected = protectedCategories.includes(category);
            return (
              <PremiumCard key={`${kind}-${category}`}>
                <View style={styles.row}>
                  <View style={styles.categoryInfo}>
                    <View style={[styles.iconWrap, { backgroundColor: `${theme.textMuted}22` }]}>
                      <Ionicons
                        name={(categoryIcons[category] as keyof typeof Ionicons.glyphMap | undefined) ?? 'ellipse-outline'}
                        size={18}
                        color={theme.text}
                      />
                    </View>
                    <Text style={[styles.categoryName, { color: theme.text }]}>{category}</Text>
                  </View>
                  <Pressable
                    onPress={() => removeCategory(category, kind)}
                    disabled={isProtected}
                  >
                    <Text
                      style={[
                        styles.deleteText,
                        { color: isProtected ? theme.textMuted : theme.warning },
                      ]}
                    >
                      Eliminar
                    </Text>
                  </Pressable>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconsRow}>
                  {iconOptions.map((icon) => (
                    <Pressable
                      key={icon}
                      style={[
                        styles.iconChoice,
                        { borderColor: theme.border },
                        categoryIcons[category] === icon && {
                          borderColor: theme.primary,
                          backgroundColor: `${theme.primary}20`,
                        },
                      ]}
                      onPress={() => setCategoryIcon(category, icon)}
                    >
                      <Ionicons
                        name={icon}
                        size={18}
                        color={categoryIcons[category] === icon ? theme.primary : theme.textMuted}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </PremiumCard>
            );
          })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentLabel: { fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 14, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButton: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  addButtonText: { color: '#fff', fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: { fontWeight: '700', fontSize: 15 },
  deleteText: { fontWeight: '600', fontSize: 12 },
  iconsRow: { gap: 8 },
  iconChoice: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
