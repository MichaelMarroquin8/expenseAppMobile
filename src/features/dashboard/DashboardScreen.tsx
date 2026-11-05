import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { convertToBase, getExchangeRates } from '../../backend/exchangeRates';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { formatMoney, monthKey, monthKeyFromIso } from '../../core/utils/format';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { isBalanceAdjustment } from '../../domain/accounts';
import { budgetSnapshots } from '../../domain/budgets';
import { summarizeNetWorth } from '../../domain/netWorth';
import { buildReminders } from '../../domain/reminders';
import { useFinanceStore } from '../../store/useFinanceStore';

const HIDDEN_AMOUNT = '••••••';

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
  const navigation = useNavigation<any>();
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const holdings = useFinanceStore((state) => state.holdings);
  const budgets = useFinanceStore((state) => state.budgets);
  const goals = useFinanceStore((state) => state.goals);
  const cards = useFinanceStore((state) => state.cards);
  const remindersEnabled = useFinanceStore((state) => state.settings.remindersEnabled);
  const balancesHidden = useFinanceStore((state) => state.settings.balancesHidden);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const currency = useFinanceStore((state) => state.settings.currency);
  const [rates, setRates] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExchangeRates(currency)
      .then((result) => {
        if (!cancelled) setRates(result);
      })
      .catch(() => {
        if (!cancelled) setRates({ [currency]: 1 });
      });
    return () => {
      cancelled = true;
    };
  }, [currency]);

  const toBase = useCallback(
    (amount: number, code: string): number => {
      if (code === currency) return amount;
      if (!rates) return 0;
      return convertToBase(amount, code, currency, rates) ?? 0;
    },
    [currency, rates],
  );

  const netWorth = useMemo(
    () => summarizeNetWorth(accounts, holdings, currency, toBase, Boolean(rates)),
    [accounts, currency, holdings, rates, toBase],
  );
  const currentMonth = monthKey();
  const monthBudgets = useMemo(
    () => budgetSnapshots(budgets, transactions, currentMonth),
    [budgets, currentMonth, transactions],
  );
  const reminders = useMemo(
    () =>
      remindersEnabled
        ? buildReminders({ cards, accounts, budgets, transactions, goals }, currency)
        : [],
    [accounts, budgets, cards, currency, goals, remindersEnabled, transactions],
  );
  const summary = useMemo(() => {
    const ledger = transactions.filter((tx) => !isBalanceAdjustment(tx));
    const now = new Date();
    const thisMonth = monthKey(now);
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = monthKey(previous);
    const txThisMonth = ledger.filter((tx) => monthKeyFromIso(tx.occurredAt) === thisMonth);
    const txLastMonth = ledger.filter((tx) => monthKeyFromIso(tx.occurredAt) === lastMonth);
    const income = txThisMonth.filter((tx) => tx.type === 'income').reduce((acc, tx) => acc + tx.amount, 0);
    const expenses = txThisMonth.filter((tx) => tx.type === 'expense').reduce((acc, tx) => acc + tx.amount, 0);
    const prevExpenses = txLastMonth
      .filter((tx) => tx.type === 'expense')
      .reduce((acc, tx) => acc + tx.amount, 0);
    return {
      income,
      expenses,
      expenseVsLastMonth: prevExpenses === 0 ? 0 : ((expenses - prevExpenses) / prevExpenses) * 100,
    };
  }, [transactions]);

  const money = (amount: number) => (balancesHidden ? HIDDEN_AMOUNT : formatMoney(amount, currency));
  const tightestBudget = monthBudgets[0];
  const bottomOverlaySpacing = Math.max(insets.bottom + 170, 190);

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomOverlaySpacing }]}>
        <SectionTitle title="Hoy" subtitle="Patrimonio y cómo va el mes" />

        <PremiumCard>
          <View style={styles.balanceHeader}>
            <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>Patrimonio neto</Text>
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={balancesHidden ? 'Mostrar patrimonio' : 'Ocultar patrimonio'}
              onPress={() => updateSettings({ balancesHidden: !balancesHidden })}
            >
              <Ionicons
                name={balancesHidden ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.textMuted}
              />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver cuentas"
            onPress={() => navigation.navigate('Accounts')}
          >
            <Text style={[styles.balanceValue, { color: theme.text }]}>{money(netWorth.net)}</Text>
            <View style={styles.statsRow}>
              <Stat label="Activos" value={money(netWorth.assets)} color={theme.text} />
              <Stat label="Pasivos" value={money(netWorth.liabilities)} color={theme.warning} />
            </View>
            <Text style={[styles.comparison, { color: theme.textMuted }]}>
              Disponible {money(netWorth.liquid)}
              {!balancesHidden && netWorth.partial ? ' · falta alguna tasa de cambio' : ''}
            </Text>
          </Pressable>
        </PremiumCard>

        <PremiumCard>
          <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>Este mes</Text>
          <View style={styles.statsRow}>
            <Stat label="Ingresos" value={formatMoney(summary.income, currency)} color={theme.success} />
            <Stat label="Gastos" value={formatMoney(summary.expenses, currency)} color={theme.danger} />
          </View>
          <Text
            style={[
              styles.comparison,
              { color: summary.expenseVsLastMonth > 0 ? theme.warning : theme.success },
            ]}
          >
            Gastos {summary.expenseVsLastMonth > 0 ? '+' : ''}
            {summary.expenseVsLastMonth.toFixed(1)}% vs mes anterior
          </Text>
        </PremiumCard>

        {tightestBudget ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver presupuestos"
            style={styles.cardPress}
            onPress={() => navigation.navigate('Budgets')}
          >
            <PremiumCard>
              <View style={styles.balanceHeader}>
                <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>Presupuesto</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
              <View style={[styles.barHeader, { marginTop: 10 }]}>
                <Text style={[styles.barLabel, { color: theme.text }]}>{tightestBudget.label}</Text>
                <Text
                  style={[
                    styles.barValue,
                    { color: tightestBudget.level === 'over' ? theme.danger : theme.textMuted },
                  ]}
                >
                  {formatMoney(tightestBudget.spent, currency)} / {formatMoney(tightestBudget.limit, currency)}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.max(8, Math.min(100, tightestBudget.ratio * 100))}%`,
                      backgroundColor:
                        tightestBudget.level === 'over'
                          ? theme.danger
                          : tightestBudget.level === 'warning'
                            ? theme.warning
                            : theme.primary,
                    },
                  ]}
                />
              </View>
              {monthBudgets.length > 1 ? (
                <Text style={[styles.comparison, { color: theme.textMuted }]}>
                  {monthBudgets.length - 1 === 1
                    ? '1 presupuesto más'
                    : `${monthBudgets.length - 1} presupuestos más`}
                </Text>
              ) : null}
            </PremiumCard>
          </Pressable>
        ) : null}

        {reminders.length > 0 ? (
          <PremiumCard>
            <SectionTitle title="Avisos" subtitle="Corte, pago, presupuesto y metas" />
            {reminders.map((reminder) => (
              <View key={reminder.id} style={styles.reminder}>
                <Text
                  style={[
                    styles.reminderTitle,
                    {
                      color:
                        reminder.tone === 'danger'
                          ? theme.danger
                          : reminder.tone === 'warning'
                            ? theme.warning
                            : theme.primary,
                    },
                  ]}
                >
                  {reminder.title}
                </Text>
                <Text style={[styles.reminderBody, { color: theme.textMuted }]}>
                  {reminder.body}
                </Text>
              </View>
            ))}
          </PremiumCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  cardPress: {
    width: '100%',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginTop: 4,
    fontWeight: '600',
  },
  reminder: {
    marginBottom: 10,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  reminderBody: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
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
});
