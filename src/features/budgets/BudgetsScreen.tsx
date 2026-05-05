import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatAmountInput, formatMoney, monthKey, parseAmountInput } from '../../core/utils/format';
import { useFinanceStore } from '../../store/useFinanceStore';

export function BudgetsScreen() {
  const { theme, activeMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const currency = useFinanceStore((state) => state.settings.currency);
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.transactionCategories);
  const setBudget = useFinanceStore((state) => state.setBudget);
  const deleteBudget = useFinanceStore((state) => state.deleteBudget);
  const tx = useFinanceStore((state) => state.transactions);
  const current = monthKey();
  const [selectedCategory, setSelectedCategory] = useState('GLOBAL');
  const [limitRaw, setLimitRaw] = useState('');

  const monthExpenses = tx.filter((item) => item.type === 'expense' && item.occurredAt.startsWith(current));
  const availableCategories = useMemo(
    () => ['GLOBAL', ...categories.filter((item) => item.toLowerCase() !== 'salario')],
    [categories],
  );
  const budgetsThisMonth = useMemo(
    () => budgets.filter((item) => item.monthKey === current),
    [budgets, current],
  );
  const selectedBudget = useMemo(
    () => budgetsThisMonth.find((item) => item.category === selectedCategory),
    [budgetsThisMonth, selectedCategory],
  );

  useEffect(() => {
    setLimitRaw(selectedBudget ? String(selectedBudget.limit) : '');
  }, [selectedCategory, selectedBudget?.id, selectedBudget?.limit]);

  const onSaveBudget = () => {
    const limit = Number(limitRaw);
    if (Number.isNaN(limit) || limit <= 0) return;
    const budgetId = `budget_${current}_${selectedCategory.toLowerCase().replace(/\s+/g, '_')}`;
    setBudget({
      id: budgetId,
      category: selectedCategory,
      limit,
      monthKey: current,
    });
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}
      >
        <SectionTitle title="Presupuestos" subtitle="Configura límites por categoría y controla tu consumo" />

        <PremiumCard>
          <Text style={[styles.formTitle, { color: theme.text }]}>Crear o actualizar presupuesto</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {availableCategories.map((category) => (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[
                  styles.categoryChip,
                  { borderColor: theme.border },
                  selectedCategory === category && {
                    borderColor: theme.primary,
                    backgroundColor: `${theme.primary}20`,
                  },
                ]}
              >
                <Text style={[styles.categoryChipText, { color: theme.text }]}>
                  {category === 'GLOBAL' ? 'Global' : category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            value={formatAmountInput(limitRaw, currency)}
            onChangeText={(value) => setLimitRaw(parseAmountInput(value, currency))}
            placeholder="Límite del presupuesto"
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            keyboardAppearance={activeMode === 'dark' ? 'dark' : 'light'}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <Pressable style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={onSaveBudget}>
            <Text style={styles.saveButtonText}>Guardar presupuesto</Text>
          </Pressable>
        </PremiumCard>

        {budgetsThisMonth.length === 0 ? (
          <PremiumCard>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Aún no tienes presupuestos para este mes. Crea uno arriba para empezar a controlar tus gastos.
            </Text>
          </PremiumCard>
        ) : (
          budgetsThisMonth
            .slice()
            .sort((a, b) => (a.category === 'GLOBAL' ? -1 : b.category === 'GLOBAL' ? 1 : a.category.localeCompare(b.category)))
            .map((budget) => {
              const spent =
                budget.category === 'GLOBAL'
                  ? monthExpenses.reduce((acc, item) => acc + item.amount, 0)
                  : monthExpenses
                      .filter((item) => item.category === budget.category)
                      .reduce((acc, item) => acc + item.amount, 0);
              return (
                <BudgetCard
                  key={budget.id}
                  budgetId={budget.id}
                  title={budget.category === 'GLOBAL' ? 'Presupuesto global' : budget.category}
                  spent={spent}
                  limit={budget.limit}
                  currency={currency}
                  color={budget.category === 'GLOBAL' ? theme.primary : theme.success}
                  onDelete={deleteBudget}
                />
              );
            })
        )}
      </ScrollView>
    </Screen>
  );
}

function BudgetCard({
  budgetId,
  title,
  spent,
  limit,
  currency,
  color,
  onDelete,
}: {
  budgetId: string;
  title: string;
  spent: number;
  limit: number;
  currency: string;
  color: string;
  onDelete: (id: string) => void;
}) {
  const { theme } = useAppTheme();
  const progress = Math.min(100, (spent / Math.max(1, limit)) * 100);
  const statusColor = progress >= 100 ? theme.danger : progress >= 80 ? theme.warning : color;
  return (
    <PremiumCard>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.status, { color: statusColor }]}>
          {progress >= 100 ? 'Excedido' : progress >= 80 ? 'Alerta' : 'En control'}
        </Text>
      </View>
      <Text style={[styles.value, { color: theme.textMuted }]}>
        {formatMoney(spent, currency)} / {formatMoney(limit, currency)}
      </Text>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: `${Math.max(2, progress)}%`, backgroundColor: statusColor }]} />
      </View>
      <Pressable onPress={() => onDelete(budgetId)}>
        <Text style={[styles.deleteText, { color: theme.warning }]}>Eliminar presupuesto</Text>
      </Pressable>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  formTitle: { fontWeight: '700', fontSize: 16, marginBottom: 10 },
  categoryRow: { gap: 8, marginBottom: 12 },
  categoryChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  categoryChipText: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  saveButton: {
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontWeight: '700', fontSize: 16 },
  status: { fontWeight: '700', fontSize: 12 },
  value: { marginBottom: 10, fontSize: 13 },
  track: { borderRadius: 999, height: 10, overflow: 'hidden' },
  fill: { height: 10 },
  deleteText: { marginTop: 10, fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 13 },
});
