import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, monthKey, monthKeyFromIso } from '../../core/utils/format';
import { isBalanceAdjustment } from '../../domain/accounts';
import { useFinanceStore } from '../../store/useFinanceStore';

type EntryKind = 'expense' | 'income';
type PeriodMode = 'month' | 'year';

interface CategorySlice {
  category: string;
  amount: number;
  percent: number;
  color: string;
  icon: string;
}

const CHART_COLORS = [
  '#FBBF24',
  '#3B82F6',
  '#EC4899',
  '#14B8A6',
  '#22C55E',
  '#A855F7',
  '#F97316',
  '#EF4444',
  '#06B6D4',
  '#84CC16',
];

const formatCompactTotal = (value: number, currency: string): string => {
  if (currency === 'COP' || currency === 'CLP') {
    if (value >= 1_000_000) {
      const millions = value / 1_000_000;
      const rounded = millions >= 10 ? millions.toFixed(0) : millions.toFixed(1).replace('.', ',');
      return `$${rounded} millones`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)} mil`;
    }
  }
  return formatMoney(value, currency);
};

const DonutChart = ({
  slices,
  totalLabel,
  totalColor,
  emptyColor,
  trackColor,
}: {
  slices: CategorySlice[];
  totalLabel: string;
  totalColor: string;
  emptyColor: string;
  trackColor: string;
}) => {
  const size = 148;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.donutWrap}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {slices.length === 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={emptyColor}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${circumference} ${circumference}`}
            />
          ) : (
            slices.map((slice) => {
              const length = (slice.percent / 100) * circumference;
              const circle = (
                <Circle
                  key={slice.category}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += length;
              return circle;
            })
          )}
        </G>
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={[styles.donutTotal, { color: totalColor }]} numberOfLines={2}>
          {totalLabel}
        </Text>
      </View>
    </View>
  );
};

export function InsightsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.settings.currency);
  const categoryIcons = useFinanceStore((state) => state.categoryIcons);

  const [kind, setKind] = useState<EntryKind>('expense');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);
  const [selectedYearOffset, setSelectedYearOffset] = useState(0);

  const periodOptions = useMemo(() => {
    const now = new Date();
    if (periodMode === 'month') {
      return Array.from({ length: 6 }, (_, index) => {
        const offset = 5 - index;
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        return {
          id: monthKey(date),
          label:
            offset === 0
              ? 'Este mes'
              : offset === 1
                ? 'Mes pasado'
                : new Intl.DateTimeFormat('es-CO', { month: 'short', year: '2-digit' }).format(date),
          offset,
        };
      });
    }
    return Array.from({ length: 4 }, (_, index) => {
      const offset = 3 - index;
      const year = now.getFullYear() - offset;
      return {
        id: String(year),
        label: offset === 0 ? 'Este año' : offset === 1 ? 'Año pasado' : String(year),
        offset,
      };
    });
  }, [periodMode]);

  const activePeriodId =
    periodMode === 'month'
      ? periodOptions.find((item) => item.offset === selectedMonthOffset)?.id ?? monthKey()
      : periodOptions.find((item) => item.offset === selectedYearOffset)?.id ?? String(new Date().getFullYear());

  const periodTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (isBalanceAdjustment(tx) || tx.type !== kind) return false;
      if (periodMode === 'month') {
        return monthKeyFromIso(tx.occurredAt) === activePeriodId;
      }
      return new Date(tx.occurredAt).getFullYear().toString() === activePeriodId;
    });
  }, [transactions, kind, periodMode, activePeriodId]);

  const categorySlices = useMemo<CategorySlice[]>(() => {
    const totals = periodTransactions.reduce<Record<string, number>>((acc, tx) => {
      acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
      return acc;
    }, {});
    const total = Object.values(totals).reduce((acc, value) => acc + value, 0);
    return Object.entries(totals)
      .map(([category, amount], index) => ({
        category,
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
        icon: categoryIcons[category] ?? 'pricetag-outline',
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, categoryIcons]);

  const totalAmount = categorySlices.reduce((acc, item) => acc + item.amount, 0);
  const topLegend = categorySlices.slice(0, 5);
  const otherPercent = categorySlices.slice(5).reduce((acc, item) => acc + item.percent, 0);
  const legendRows =
    otherPercent > 0.01
      ? [
          ...topLegend,
          {
            category: 'Otro',
            amount: categorySlices.slice(5).reduce((acc, item) => acc + item.amount, 0),
            percent: otherPercent,
            color: CHART_COLORS[5 % CHART_COLORS.length],
            icon: 'apps-outline',
          },
        ]
      : topLegend;

  const periodTitle =
    periodMode === 'month'
      ? selectedMonthOffset === 0
        ? 'Consolidado de este mes'
        : `Consolidado · ${activePeriodId}`
      : selectedYearOffset === 0
        ? 'Consolidado de este año'
        : `Consolidado · ${activePeriodId}`;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom + 170, 190) },
        ]}
      >
        <SectionTitle title="Gráficos" subtitle="Consolidado mensual y anual por categoría" />

        <View style={styles.kindRow}>
          {(['expense', 'income'] as const).map((option) => {
            const active = kind === option;
            return (
              <Pressable
                key={option}
                onPress={() => setKind(option)}
                android_ripple={null}
                style={[
                  styles.kindChip,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                  active && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
              >
                <Text style={[styles.kindText, { color: active ? '#fff' : theme.text }]}>
                  {option === 'expense' ? 'Gastos' : 'Ingresos'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.modeRow}>
          {(['month', 'year'] as const).map((mode) => {
            const active = periodMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setPeriodMode(mode)}
                android_ripple={null}
                style={[
                  styles.modeChip,
                  { borderColor: theme.border },
                  active && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                ]}
              >
                <Text style={[styles.modeText, { color: active ? theme.primary : theme.text }]}>
                  {mode === 'month' ? 'Mensual' : 'Anual'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodRow}
        >
          {periodOptions.map((option) => {
            const active =
              periodMode === 'month'
                ? option.offset === selectedMonthOffset
                : option.offset === selectedYearOffset;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  if (periodMode === 'month') setSelectedMonthOffset(option.offset);
                  else setSelectedYearOffset(option.offset);
                }}
                android_ripple={null}
                style={styles.periodItem}
              >
                <Text
                  style={[
                    styles.periodLabel,
                    { color: active ? theme.primary : theme.textMuted },
                    active && styles.periodLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
                {active ? <View style={[styles.periodUnderline, { backgroundColor: theme.primary }]} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <PremiumCard>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{periodTitle}</Text>
          <View style={styles.chartRow}>
            <DonutChart
              slices={categorySlices}
              totalLabel={totalAmount > 0 ? formatCompactTotal(totalAmount, currency) : formatMoney(0, currency)}
              totalColor={theme.text}
              emptyColor={`${theme.textMuted}55`}
              trackColor={theme.border}
            />
            <View style={styles.legendCol}>
              {legendRows.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Sin {kind === 'expense' ? 'gastos' : 'ingresos'} en este periodo
                </Text>
              ) : (
                legendRows.map((item) => (
                  <View key={item.category} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.legendName, { color: theme.text }]} numberOfLines={1}>
                      {item.category}
                    </Text>
                    <Text style={[styles.legendPercent, { color: theme.textMuted }]}>
                      {item.percent.toFixed(2)}%
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionTitle
            title={kind === 'expense' ? 'Gasto por categoría' : 'Ingreso por categoría'}
            subtitle="Acumulado del periodo seleccionado"
          />
          {categorySlices.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Aún no hay movimientos para mostrar.
            </Text>
          ) : (
            categorySlices.map((item) => (
              <View key={item.category} style={styles.categoryRow}>
                <View style={[styles.iconWrap, { backgroundColor: `${item.color}22` }]}>
                  <Ionicons
                    name={(item.icon as keyof typeof Ionicons.glyphMap) || 'pricetag-outline'}
                    size={18}
                    color={item.color}
                  />
                </View>
                <View style={styles.categoryContent}>
                  <View style={styles.categoryHeader}>
                    <Text style={[styles.categoryName, { color: theme.text }]}>{item.category}</Text>
                    <Text style={[styles.categoryAmount, { color: theme.text }]}>
                      {formatMoney(item.amount, currency)}
                    </Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: theme.border }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${Math.max(4, item.percent)}%`,
                          backgroundColor: item.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.categoryPercent, { color: theme.textMuted }]}>
                    {item.percent.toFixed(2)}% del total
                  </Text>
                </View>
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
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  kindChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  kindText: { fontWeight: '700' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  modeText: { fontWeight: '600', fontSize: 13 },
  periodRow: { gap: 16, paddingVertical: 6, marginBottom: 8, paddingRight: 8 },
  periodItem: { alignItems: 'center', minWidth: 64 },
  periodLabel: { fontSize: 13, fontWeight: '600' },
  periodLabelActive: { fontWeight: '800' },
  periodUnderline: { marginTop: 4, height: 2, width: '100%', borderRadius: 999 },
  cardTitle: { fontWeight: '700', fontSize: 16, marginBottom: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  donutWrap: {
    width: 148,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  donutTotal: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 14,
  },
  legendCol: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { flex: 1, fontSize: 13, fontWeight: '600' },
  legendPercent: { fontSize: 12, fontWeight: '600' },
  categoryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContent: { flex: 1 },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  categoryName: { fontWeight: '700', flex: 1 },
  categoryAmount: { fontWeight: '700', fontSize: 13 },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 999 },
  categoryPercent: { marginTop: 4, fontSize: 11 },
  emptyText: { fontSize: 13 },
});
