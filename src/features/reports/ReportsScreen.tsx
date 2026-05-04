import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, monthKey } from '../../core/utils/format';
import { useFinanceStore } from '../../store/useFinanceStore';

const weekBucket = (dateIso: string): string => {
  const date = new Date(dateIso);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const diffDays = Math.floor((date.getTime() - first.getTime()) / (24 * 3600 * 1000));
  return `Semana ${Math.floor(diffDays / 7) + 1}`;
};

export function ReportsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.settings.currency);
  const current = monthKey();
  const monthly = transactions.filter((tx) => tx.occurredAt.startsWith(current));

  const monthlyIncome = monthly.filter((tx) => tx.type === 'income').reduce((acc, tx) => acc + tx.amount, 0);
  const monthlyExpense = monthly.filter((tx) => tx.type === 'expense').reduce((acc, tx) => acc + tx.amount, 0);

  const weeklyTrend = monthly
    .filter((tx) => tx.type === 'expense')
    .reduce<Record<string, number>>((acc, tx) => {
      const key = weekBucket(tx.occurredAt);
      acc[key] = (acc[key] ?? 0) + tx.amount;
      return acc;
    }, {});

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}
      >
        <SectionTitle title="Reportes" subtitle="Ingresos vs gastos, categoría y tendencia" />

        <PremiumCard>
          <Text style={[styles.title, { color: theme.text }]}>Balance mensual</Text>
          <Text style={[styles.item, { color: theme.success }]}>
            Ingresos: {formatMoney(monthlyIncome, currency)}
          </Text>
          <Text style={[styles.item, { color: theme.danger }]}>
            Gastos: {formatMoney(monthlyExpense, currency)}
          </Text>
          <Text style={[styles.item, { color: theme.primary }]}>
            Neto: {formatMoney(monthlyIncome - monthlyExpense, currency)}
          </Text>
        </PremiumCard>

        <PremiumCard>
          <Text style={[styles.title, { color: theme.text }]}>Tendencia semanal de gastos</Text>
          {Object.entries(weeklyTrend).length === 0 ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>Sin datos aún</Text>
          ) : (
            Object.entries(weeklyTrend).map(([week, amount]) => (
              <View key={week} style={styles.row}>
                <Text style={[styles.week, { color: theme.text }]}>{week}</Text>
                <Text style={[styles.amount, { color: theme.textMuted }]}>{formatMoney(amount, currency)}</Text>
              </View>
            ))
          )}
        </PremiumCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontWeight: '700', fontSize: 16, marginBottom: 8 },
  item: { fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  week: { fontWeight: '600' },
  amount: { fontSize: 12 },
  empty: { fontSize: 13 },
});
