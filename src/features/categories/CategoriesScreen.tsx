import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { useFinanceStore } from '../../store/useFinanceStore';

const iconOptions: Array<keyof typeof Ionicons.glyphMap> = [
  'fast-food-outline',
  'car-outline',
  'basket-outline',
  'game-controller-outline',
  'flash-outline',
  'cash-outline',
  'home-outline',
  'medkit-outline',
  'shirt-outline',
  'fitness-outline',
  'school-outline',
  'pricetag-outline',
];

export function CategoriesScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const categories = useFinanceStore((state) => state.transactionCategories);
  const categoryIcons = useFinanceStore((state) => state.categoryIcons);
  const setCategoryIcon = useFinanceStore((state) => state.setCategoryIcon);
  const removeCategory = useFinanceStore((state) => state.removeTransactionCategory);

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}>
        <SectionTitle title="Categorías" subtitle="Configura íconos y elimina categorías personalizadas" />

        {categories
          .slice()
          .sort((a, b) => a.localeCompare(b))
          .map((category) => (
            <PremiumCard key={category}>
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
                  onPress={() => removeCategory(category)}
                  disabled={category === 'Otros' || category === 'Salario'}
                >
                  <Text
                    style={[
                      styles.deleteText,
                      { color: category === 'Otros' || category === 'Salario' ? theme.textMuted : theme.warning },
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
          ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
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
