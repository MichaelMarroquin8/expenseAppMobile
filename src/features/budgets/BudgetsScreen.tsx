import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, monthKey } from '../../core/utils/format';
import { useFinanceStore } from '../../store/useFinanceStore';

export function BudgetsScreen() {
  const { theme } = useAppTheme();
  const currency = useFinanceStore((state) => state.settings.currency);
  const budgets = useFinanceStore((state) => state.budgets);
  const tx = useFinanceStore((state) => state.transactions);
  const current = monthKey();

  const monthExpenses = tx.filter((item) => item.type === 'expense' && item.occurredAt.startsWith(current));
  const globalBudget = budgets.find((item) => item.category === 'GLOBAL' && item.monthKey === current);
  const globalSpent = monthExpenses.reduce((acc, item) => acc + item.amount, 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionTitle title="Presupuestos" subtitle="Límites globales y por categoría" />

        {globalBudget ? (
          <BudgetCard
            title="Presupuesto global"
            spent={globalSpent}
            limit={globalBudget.limit}
            currency={currency}
            color={theme.primary}
          />
        ) : null}

        {budgets
          .filter((item) => item.category !== 'GLOBAL' && item.monthKey === current)
          .map((budget) => {
            const spent = monthExpenses
              .filter((item) => item.category === budget.category)
              .reduce((acc, item) => acc + item.amount, 0);
            return (
              <BudgetCard
                key={budget.id}
                title={budget.category}
                spent={spent}
                limit={budget.limit}
                currency={currency}
                color={theme.success}
              />
            );
          })}
      </ScrollView>
    </Screen>
  );
}

function BudgetCard({
  title,
  spent,
  limit,
  currency,
  color,
}: {
  title: string;
  spent: number;
  limit: number;
  currency: string;
  color: string;
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
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontWeight: '700', fontSize: 16 },
  status: { fontWeight: '700', fontSize: 12 },
  value: { marginBottom: 10, fontSize: 13 },
  track: { borderRadius: 999, height: 10, overflow: 'hidden' },
  fill: { height: 10 },
});
