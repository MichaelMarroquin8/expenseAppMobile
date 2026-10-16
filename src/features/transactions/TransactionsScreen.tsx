import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PremiumCard, Screen, SectionTitle } from "../../components/ui";
import { useAppTheme } from "../../core/theme/ThemeProvider";
import { formatMoney, formatShortDate, monthKey, monthKeyFromIso } from "../../core/utils/format";
import { Transaction } from "../../domain/models";
import { useFinanceStore } from "../../store/useFinanceStore";
import { QuickAddTransactionModal } from "./QuickAddTransactionModal";

type MovementFilter = "all" | "expense" | "income" | "transfer";

const formatDayHeader = (isoDate: string) =>
  new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(isoDate));

const formatMonthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
};

const shiftMonthKey = (key: string, delta: number) => {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(year, month - 1 + delta, 1));
};

export function TransactionsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const currency = useFinanceStore((state) => state.settings.currency);
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction);

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => monthKey());

  const currentMonthKey = monthKey();

  const monthOptions = useMemo(() => {
    const now = new Date();
    const oldestKey = transactions.reduce((oldest, tx) => {
      const key = monthKeyFromIso(tx.occurredAt);
      return key < oldest ? key : oldest;
    }, currentMonthKey);

    const [oldestYear, oldestMonth] = oldestKey.split("-").map(Number);
    const oldestDate = new Date(oldestYear, oldestMonth - 1, 1);
    const months: { id: string; label: string }[] = [];
    let cursor = new Date(now.getFullYear(), now.getMonth(), 1);

    while (cursor >= oldestDate) {
      const id = monthKey(cursor);
      const offsetMonths =
        (now.getFullYear() - cursor.getFullYear()) * 12 +
        (now.getMonth() - cursor.getMonth());
      months.push({
        id,
        label:
          offsetMonths === 0
            ? "Este mes"
            : offsetMonths === 1
              ? "Mes pasado"
              : new Intl.DateTimeFormat("es-CO", {
                  month: "short",
                  year: "2-digit",
                }).format(cursor),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    }

    return months;
  }, [transactions, currentMonthKey]);

  const oldestMonthKey =
    monthOptions[monthOptions.length - 1]?.id ?? currentMonthKey;
  const canGoNext = selectedMonthKey < currentMonthKey;
  const canGoPrev = selectedMonthKey > oldestMonthKey;

  const filtered = useMemo<Transaction[]>(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchesMonth = monthKeyFromIso(tx.occurredAt) === selectedMonthKey;
      const matchesSearch =
        !q ||
        tx.merchant.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q);
      const matchesType =
        movementFilter === "all" || tx.type === movementFilter;
      return matchesMonth && matchesSearch && matchesType;
    });
  }, [search, transactions, movementFilter, selectedMonthKey]);

  const monthSummary = useMemo(() => {
    const monthlyTx = transactions.filter(
      (tx) => monthKeyFromIso(tx.occurredAt) === selectedMonthKey,
    );
    const totalIncome = monthlyTx
      .filter((tx) => tx.type === "income")
      .reduce((acc, tx) => acc + tx.amount, 0);
    const totalExpense = monthlyTx
      .filter((tx) => tx.type === "expense")
      .reduce((acc, tx) => acc + tx.amount, 0);
    return {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      monthLabel: formatMonthLabel(selectedMonthKey),
    };
  }, [transactions, selectedMonthKey]);

  const groupedByDay = useMemo(() => {
    const groups = filtered.reduce<Record<string, Transaction[]>>((acc, tx) => {
      const key = new Date(tx.occurredAt).toDateString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(tx);
      return acc;
    }, {});

    return Object.entries(groups)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([dayKey, items]) => {
        const dayExpense = items
          .filter((tx) => tx.type === "expense")
          .reduce((acc, tx) => acc + tx.amount, 0);
        const dayIncome = items
          .filter((tx) => tx.type === "income")
          .reduce((acc, tx) => acc + tx.amount, 0);
        return {
          dayKey,
          label: formatDayHeader(items[0].occurredAt),
          dayExpense,
          dayIncome,
          items: items.sort(
            (a, b) =>
              new Date(b.occurredAt).getTime() -
              new Date(a.occurredAt).getTime(),
          ),
        };
      });
  }, [filtered]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom + 170, 190) },
        ]}
      >
        <SectionTitle
          title="Mis movimientos"
          subtitle="Libro diario de gastos e ingresos"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodRow}
        >
          {monthOptions.map((option) => {
            const active = option.id === selectedMonthKey;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSelectedMonthKey(option.id)}
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
                {active ? (
                  <View
                    style={[
                      styles.periodUnderline,
                      { backgroundColor: theme.primary },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <PremiumCard>
          <View style={styles.monthNav}>
            <Pressable
              onPress={() =>
                canGoPrev &&
                setSelectedMonthKey(shiftMonthKey(selectedMonthKey, -1))
              }
              disabled={!canGoPrev}
              hitSlop={10}
              style={[styles.monthNavButton, !canGoPrev && styles.monthNavDisabled]}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={canGoPrev ? theme.text : theme.textMuted}
              />
            </Pressable>
            <Text style={[styles.monthLabel, { color: theme.text }]}>
              {monthSummary.monthLabel}
            </Text>
            <Pressable
              onPress={() =>
                canGoNext &&
                setSelectedMonthKey(shiftMonthKey(selectedMonthKey, 1))
              }
              disabled={!canGoNext}
              hitSlop={10}
              style={[styles.monthNavButton, !canGoNext && styles.monthNavDisabled]}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={canGoNext ? theme.text : theme.textMuted}
              />
            </Pressable>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryCaption, { color: theme.textMuted }]}>
                Gastos
              </Text>
              <Text style={[styles.summaryValue, { color: theme.danger }]}>
                {formatMoney(monthSummary.totalExpense, currency)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryCaption, { color: theme.textMuted }]}>
                Ingresos
              </Text>
              <Text style={[styles.summaryValue, { color: theme.success }]}>
                {formatMoney(monthSummary.totalIncome, currency)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryCaption, { color: theme.textMuted }]}>
                Saldo
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {formatMoney(monthSummary.net, currency)}
              </Text>
            </View>
          </View>

          <View style={styles.segmentGroup}>
            <View style={styles.segmentRow}>
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "expense", label: "Gastos" },
                  { id: "income", label: "Ingresos" },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setMovementFilter(item.id)}
                  style={[
                    styles.segmentChip,
                    { borderColor: theme.border },
                    movementFilter === item.id && {
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: movementFilter === item.id ? "#fff" : theme.text },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setMovementFilter("transfer")}
              style={[
                styles.segmentChipFull,
                { borderColor: theme.border },
                movementFilter === "transfer" && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: movementFilter === "transfer" ? "#fff" : theme.text },
                ]}
              >
                Transferencias
              </Text>
            </Pressable>
          </View>

          <TextInput
            placeholder="Buscar por comercio o categoría"
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border },
            ]}
          />
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setEditingTx(null);
              setModalOpen(true);
            }}
          >
            <Text style={styles.primaryButtonText}>Nueva transacción</Text>
          </Pressable>
        </PremiumCard>

        {groupedByDay.map((group) => (
          <PremiumCard key={group.dayKey}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayTitle, { color: theme.text }]}>
                {group.label}
              </Text>
              <Text style={[styles.dayMeta, { color: theme.textMuted }]}>
                Gastos: {formatMoney(group.dayExpense, currency)} • Ingresos:{" "}
                {formatMoney(group.dayIncome, currency)}
              </Text>
            </View>

            {group.items.map((tx) => {
              const sourceAccount = tx.accountId
                ? accounts.find((item) => item.id === tx.accountId)
                : undefined;
              return (
                <View key={tx.id} style={styles.movementRow}>
                  <Pressable
                    style={styles.movementInfo}
                    onPress={() => {
                      setEditingTx(tx);
                      setModalOpen(true);
                    }}
                  >
                    <Text style={[styles.title, { color: theme.text }]}>
                      {tx.merchant}
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                      {tx.category} • {formatShortDate(tx.occurredAt)} •{" "}
                      {sourceAccount?.name ?? tx.source}
                      {tx.originalCurrency &&
                      tx.originalAmount != null &&
                      tx.originalCurrency !== tx.currency
                        ? ` • ${formatMoney(tx.originalAmount, tx.originalCurrency)}`
                        : ""}
                    </Text>
                  </Pressable>
                  <View style={styles.amountCol}>
                    <Pressable
                      onPress={() => {
                        setEditingTx(tx);
                        setModalOpen(true);
                      }}
                    >
                      <Text
                        style={[
                          styles.value,
                          {
                            color:
                              tx.type === "income"
                                ? theme.success
                                : tx.type === "expense"
                                  ? theme.danger
                                  : theme.primary,
                          },
                        ]}
                      >
                        {tx.type === "income"
                          ? "+"
                          : tx.type === "expense"
                            ? "-"
                            : ""}
                        {formatMoney(tx.amount, currency)}
                      </Text>
                    </Pressable>
                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={() => {
                          setEditingTx(tx);
                          setModalOpen(true);
                        }}
                      >
                        <Text style={[styles.editAction, { color: theme.primary }]}>
                          Editar
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => deleteTransaction(tx.id)}>
                        <Text style={[styles.delete, { color: theme.warning }]}>
                          Eliminar
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </PremiumCard>
        ))}

        {groupedByDay.length === 0 ? (
          <PremiumCard>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No hay movimientos en {monthSummary.monthLabel}
              {search.trim() || movementFilter !== "all"
                ? " con los filtros actuales"
                : ""}
              .
            </Text>
          </PremiumCard>
        ) : null}
      </ScrollView>

      <QuickAddTransactionModal
        open={modalOpen}
        editingTransaction={editingTx}
        onClose={() => {
          setModalOpen(false);
          setEditingTx(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  periodRow: {
    gap: 18,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  periodItem: {
    alignItems: "center",
    paddingBottom: 6,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  periodLabelActive: {
    fontWeight: "700",
  },
  periodUnderline: {
    marginTop: 6,
    height: 2,
    width: "100%",
    borderRadius: 2,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  monthNavButton: {
    padding: 4,
  },
  monthNavDisabled: {
    opacity: 0.35,
  },
  monthLabel: {
    textTransform: "capitalize",
    fontWeight: "700",
    fontSize: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryItem: { flex: 1 },
  summaryCaption: { fontSize: 12 },
  summaryValue: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  segmentGroup: { gap: 8, marginBottom: 10 },
  segmentRow: { flexDirection: "row", gap: 8 },
  segmentChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  segmentChipFull: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  segmentText: { fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  dayHeader: {
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#94a3b822",
    paddingBottom: 8,
  },
  dayTitle: {
    fontWeight: "700",
    fontSize: 16,
    textTransform: "capitalize",
  },
  dayMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  movementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#94a3b822",
  },
  title: { fontWeight: "700", fontSize: 16 },
  movementInfo: { flex: 1, paddingRight: 8 },
  subtitle: { fontSize: 12, marginTop: 3, maxWidth: 220 },
  amountCol: { alignItems: "flex-end" },
  value: { fontWeight: "700" },
  rowActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  editAction: { fontWeight: "600", fontSize: 12 },
  delete: { fontWeight: "600", fontSize: 12 },
  emptyText: { fontSize: 13 },
});
