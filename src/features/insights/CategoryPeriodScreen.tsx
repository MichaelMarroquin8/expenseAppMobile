import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, formatShortDate, monthKeyFromIso } from '../../core/utils/format';
import { Transaction } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';
import { EntryKind, PeriodMode, formatPeriodLabel, transactionMatchesPeriod } from './period';

export type CategoryPeriodParams = {
  category: string;
  kind: EntryKind;
  periodMode: PeriodMode;
  periodId: string;
  color: string;
};

type CategoryPeriodRoute = RouteProp<{ CategoryPeriod: CategoryPeriodParams }, 'CategoryPeriod'>;

const SOURCE_LABEL: Record<Transaction['source'], string> = {
  manual: 'Manual',
  sms: 'SMS',
  notification: 'Notificación',
};

const formatMonthLabel = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  const label = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatDayLabel = (isoDate: string): string => {
  const label = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(new Date(isoDate));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatMonthTick = (year: number, monthIndex: number): string =>
  new Intl.DateTimeFormat('es-CO', { month: 'short' })
    .format(new Date(year, monthIndex, 1))
    .replace('.', '');

export function CategoryPeriodScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { category, kind, periodMode, periodId, color } = useRoute<CategoryPeriodRoute>().params;

  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.settings.currency);
  const categoryIcons = useFinanceStore((state) => state.categoryIcons);
  const icon = categoryIcons[category] ?? 'pricetag-outline';

  const periodTransactions = useMemo(
    () => transactions.filter((tx) => transactionMatchesPeriod(tx, kind, periodMode, periodId)),
    [transactions, kind, periodMode, periodId],
  );

  const categoryTransactions = useMemo(
    () =>
      periodTransactions
        .filter((tx) => tx.category === category)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [periodTransactions, category],
  );

  const total = categoryTransactions.reduce((acc, tx) => acc + tx.amount, 0);
  const periodTotal = periodTransactions.reduce((acc, tx) => acc + tx.amount, 0);
  const count = categoryTransactions.length;
  const average = count > 0 ? total / count : 0;
  const share = periodTotal > 0 ? (total / periodTotal) * 100 : 0;
  const periodLabel = formatPeriodLabel(periodMode, periodId);
  const periodScope = periodMode === 'year' ? `el año ${periodId}` : periodLabel.toLowerCase();
  const kindLabel = kind === 'expense' ? 'Gastos' : 'Ingresos';
  const amountColor = kind === 'expense' ? theme.danger : theme.success;

  const monthBreakdown = useMemo(() => {
    if (periodMode !== 'year') return [];
    const year = Number(periodId);
    const now = new Date();
    const lastMonth = year === now.getFullYear() ? now.getMonth() : 11;
    const totals = categoryTransactions.reduce<Record<string, number>>((acc, tx) => {
      const key = monthKeyFromIso(tx.occurredAt);
      acc[key] = (acc[key] ?? 0) + tx.amount;
      return acc;
    }, {});
    return Array.from({ length: lastMonth + 1 }, (_, monthIndex) => {
      const key = `${periodId}-${String(monthIndex + 1).padStart(2, '0')}`;
      return {
        key,
        label: formatMonthTick(year, monthIndex),
        amount: totals[key] ?? 0,
      };
    });
  }, [periodMode, periodId, categoryTransactions]);

  const maxMonth = monthBreakdown.reduce((acc, item) => Math.max(acc, item.amount), 0);

  const groups = useMemo(() => {
    const grouped = categoryTransactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
      const key = periodMode === 'year' ? monthKeyFromIso(tx.occurredAt) : new Date(tx.occurredAt).toDateString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(tx);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort((a, b) => {
        const aTime = new Date(a[1][0].occurredAt).getTime();
        const bTime = new Date(b[1][0].occurredAt).getTime();
        return bTime - aTime;
      })
      .map(([key, items]) => ({
        key,
        label: periodMode === 'year' ? formatMonthLabel(key) : formatDayLabel(items[0].occurredAt),
        total: items.reduce((acc, tx) => acc + tx.amount, 0),
        items,
      }));
  }, [categoryTransactions, periodMode]);

  const stats = [
    { label: 'Movimientos', value: String(count) },
    { label: 'Promedio', value: formatMoney(average, currency) },
    { label: 'Del periodo', value: `${share.toFixed(1)}%` },
  ];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 28, 36) }]}
      >
        <PremiumCard>
          <View style={styles.heroRow}>
            <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
              <Ionicons
                name={(icon as keyof typeof Ionicons.glyphMap) || 'pricetag-outline'}
                size={22}
                color={color}
              />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.kindLabel, { color: theme.textMuted }]}>{kindLabel}</Text>
              <Text style={[styles.periodLabel, { color: theme.text }]}>{periodLabel}</Text>
            </View>
          </View>
          <Text
            style={[styles.total, { color: amountColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatMoney(total, currency)}
          </Text>
          <View style={[styles.statsRow, { borderTopColor: theme.border }]}>
            {stats.map((stat, index) => (
              <View
                key={stat.label}
                style={[
                  styles.stat,
                  index > 0 && { borderLeftColor: theme.border, borderLeftWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </PremiumCard>

        {periodMode === 'year' ? (
          <PremiumCard>
            <SectionTitle title="Por mes" subtitle={`Cómo se repartió ${category} en ${periodId}`} />
            {monthBreakdown.map((month) => (
              <View key={month.key} style={styles.monthRow}>
                <Text style={[styles.monthLabel, { color: theme.text }]}>{month.label}</Text>
                <View style={[styles.track, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: maxMonth > 0 ? `${(month.amount / maxMonth) * 100}%` : '0%',
                        backgroundColor: month.amount > 0 ? color : 'transparent',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.monthAmount, { color: theme.textMuted }]} numberOfLines={1}>
                  {formatMoney(month.amount, currency)}
                </Text>
              </View>
            ))}
          </PremiumCard>
        ) : null}

        <SectionTitle
          title="Movimientos"
          subtitle={
            count === 0
              ? `Sin ${kind === 'expense' ? 'gastos' : 'ingresos'} de ${category}`
              : `${count === 1 ? '1 movimiento' : `${count} movimientos`} en ${periodScope}`
          }
        />

        {groups.length === 0 ? (
          <PremiumCard>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No hay {kind === 'expense' ? 'gastos' : 'ingresos'} de {category} en {periodScope}.
            </Text>
          </PremiumCard>
        ) : (
          groups.map((group) => (
            <PremiumCard key={group.key}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupTitle, { color: theme.text }]}>{group.label}</Text>
                <Text style={[styles.groupTotal, { color: amountColor }]}>
                  {formatMoney(group.total, currency)}
                </Text>
              </View>
              {group.items.map((tx, index) => {
                const accountName = tx.accountId
                  ? accounts.find((account) => account.id === tx.accountId)?.name
                  : undefined;
                const meta = [formatShortDate(tx.occurredAt), accountName ?? SOURCE_LABEL[tx.source], tx.subcategory]
                  .filter(Boolean)
                  .join(' • ');
                return (
                  <Pressable
                    key={tx.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${tx.merchant}`}
                    android_ripple={null}
                    onPress={() => navigation.navigate('TransactionDetail', { transactionId: tx.id })}
                    style={[
                      styles.txRow,
                      index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    <View style={styles.txCopy}>
                      <Text style={[styles.txTitle, { color: theme.text }]} numberOfLines={1}>
                        {tx.merchant}
                      </Text>
                      <Text style={[styles.txMeta, { color: theme.textMuted }]} numberOfLines={1}>
                        {meta}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: amountColor }]}>
                      {formatMoney(tx.amount, currency)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                  </Pressable>
                );
              })}
            </PremiumCard>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1 },
  kindLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  periodLabel: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  total: { marginTop: 14, fontSize: 28, fontWeight: '800' },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  statValue: { fontWeight: '800', fontSize: 14 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  monthLabel: { width: 36, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  track: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
  monthAmount: { flexShrink: 0, textAlign: 'right', fontSize: 12, fontWeight: '600' },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  groupTitle: { fontWeight: '800', fontSize: 15, flex: 1 },
  groupTotal: { fontWeight: '700', fontSize: 13 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  txCopy: { flex: 1 },
  txTitle: { fontWeight: '700', fontSize: 15 },
  txMeta: { marginTop: 2, fontSize: 12 },
  txAmount: { fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 14, lineHeight: 20 },
});
