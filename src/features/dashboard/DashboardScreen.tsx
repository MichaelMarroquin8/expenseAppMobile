import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { formatMoney, formatShortDate, monthKey, monthKeyFromIso } from '../../core/utils/format';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { Transaction } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';
import { QuickAddTransactionModal } from '../transactions/QuickAddTransactionModal';

const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
};

export function DashboardScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.settings.currency);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const summary = useMemo(() => {
    const now = new Date();
    const thisMonth = monthKey(now);
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = monthKey(previous);
    const txThisMonth = transactions.filter((tx) => monthKeyFromIso(tx.occurredAt) === thisMonth);
    const txLastMonth = transactions.filter((tx) => monthKeyFromIso(tx.occurredAt) === lastMonth);
    const income = txThisMonth.filter((tx) => tx.type === 'income').reduce((acc, tx) => acc + tx.amount, 0);
    const expenses = txThisMonth.filter((tx) => tx.type === 'expense').reduce((acc, tx) => acc + tx.amount, 0);
    const prevExpenses = txLastMonth
      .filter((tx) => tx.type === 'expense')
      .reduce((acc, tx) => acc + tx.amount, 0);
    const savings = income - expenses;
    const balance = transactions.reduce(
      (acc, tx) => acc + (tx.type === 'income' ? tx.amount : tx.type === 'expense' ? -tx.amount : 0),
      0,
    );
    const categoryTotals = txThisMonth
      .filter((tx) => tx.type === 'expense')
      .reduce<Record<string, number>>((acc, tx) => {
        acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
        return acc;
      }, {});

    return {
      income,
      expenses,
      savings,
      balance,
      expenseVsLastMonth: prevExpenses === 0 ? 0 : ((expenses - prevExpenses) / prevExpenses) * 100,
      categoryTotals,
      latest: transactions.slice(0, 5),
    };
  }, [transactions]);

  const categoryEntries = Object.entries(summary.categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategory = categoryEntries[0]?.[1] ?? 1;
  const bottomOverlaySpacing = Math.max(insets.bottom + 170, 190);

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomOverlaySpacing }]}>
        <SectionTitle title="Dashboard financiero" subtitle="Vista de tu salud financiera en tiempo real" />

        <PremiumCard>
          <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>Saldo actual</Text>
          <Text style={[styles.balanceValue, { color: theme.text }]}>{formatMoney(summary.balance, currency)}</Text>
          <Text
            style={[
              styles.comparison,
              { color: summary.expenseVsLastMonth > 0 ? theme.warning : theme.success },
            ]}
          >
            {summary.expenseVsLastMonth > 0 ? '+' : ''}
            {summary.expenseVsLastMonth.toFixed(1)}% vs mes anterior
          </Text>
        </PremiumCard>

        <PremiumCard>
          <View style={styles.statsRow}>
            <Stat label="Ingresos mes" value={formatMoney(summary.income, currency)} color={theme.success} />
            <Stat label="Gastos mes" value={formatMoney(summary.expenses, currency)} color={theme.danger} />
          </View>
          <View style={styles.statsRow}>
            <Stat label="Ahorro mes" value={formatMoney(summary.savings, currency)} color={theme.primary} />
            <Stat
              label="Flujo neto"
              value={formatMoney(summary.income - summary.expenses, currency)}
              color={theme.text}
            />
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionTitle title="Gastos por categoría" subtitle="Top del mes" />
          {categoryEntries.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>Aún no hay gastos registrados</Text>
          ) : (
            categoryEntries.map(([category, amount]) => (
              <View key={category} style={styles.barItem}>
                <View style={styles.barHeader}>
                  <Text style={[styles.barLabel, { color: theme.text }]}>{category}</Text>
                  <Text style={[styles.barValue, { color: theme.textMuted }]}>{formatMoney(amount, currency)}</Text>
                </View>
                <View style={[styles.track, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${Math.max(8, (amount / maxCategory) * 100)}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </PremiumCard>

        <PremiumCard>
          <SectionTitle title="Últimos movimientos" subtitle="Toca un movimiento para editar su monto o detalle" />
          {summary.latest.map((tx) => (
            <Pressable key={tx.id} style={styles.movement} onPress={() => setEditingTx(tx)}>
              <View>
                <Text style={[styles.merchant, { color: theme.text }]}>{tx.merchant}</Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {tx.category} • {formatShortDate(tx.occurredAt)}
                </Text>
              </View>
              <View style={styles.movementRight}>
                <Text
                  style={[
                    styles.amount,
                    { color: tx.type === 'income' ? theme.success : tx.type === 'expense' ? theme.danger : theme.primary },
                  ]}
                >
                  {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                  {formatMoney(tx.amount, currency)}
                </Text>
                <Text style={[styles.editHint, { color: theme.primary }]}>Editar</Text>
              </View>
            </Pressable>
          ))}
        </PremiumCard>
      </ScrollView>

      <QuickAddTransactionModal
        open={Boolean(editingTx)}
        editingTransaction={editingTx}
        onClose={() => setEditingTx(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  balanceLabel: {
    fontSize: 14,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '800',
    marginTop: 6,
  },
  comparison: {
    marginTop: 8,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  barItem: {
    marginBottom: 12,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barLabel: {
    fontWeight: '600',
  },
  barValue: {
    fontSize: 12,
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 999,
  },
  movement: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#94a3b822',
  },
  merchant: {
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    fontWeight: '700',
  },
  movementRight: {
    alignItems: 'flex-end',
  },
  editHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
  },
});
