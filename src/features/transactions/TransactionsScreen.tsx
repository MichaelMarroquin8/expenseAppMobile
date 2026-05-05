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
import { formatMoney, formatShortDate } from "../../core/utils/format";
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

export function TransactionsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const currency = useFinanceStore((state) => state.settings.currency);
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction);

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");

  const filtered = useMemo<Transaction[]>(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchesSearch =
        !q ||
        tx.merchant.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q);
      const matchesType =
        movementFilter === "all" || tx.type === movementFilter;
      return matchesSearch && matchesType;
    });
  }, [search, transactions, movementFilter]);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthlyTx = transactions.filter((tx) =>
      tx.occurredAt.startsWith(currentMonthKey),
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
      monthLabel: new Intl.DateTimeFormat("es-CO", {
        month: "long",
        year: "numeric",
      }).format(now),
    };
  }, [transactions]);

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

        <PremiumCard>
          <Text style={[styles.monthLabel, { color: theme.textMuted }]}>
            {monthSummary.monthLabel}
          </Text>
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

          <View style={styles.segmentRow}>
            {(
              [
                { id: "all", label: "Todos" },
                { id: "expense", label: "Gastos" },
                { id: "income", label: "Ingresos" },
                { id: "transfer", label: "Transferencias" },
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
            onPress={() => setModalOpen(true)}
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
                  <View>
                    <Text style={[styles.title, { color: theme.text }]}>
                      {tx.merchant}
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                      {tx.category} • {formatShortDate(tx.occurredAt)} •{" "}
                      {sourceAccount?.name ?? tx.source}
                    </Text>
                  </View>
                  <View style={styles.amountCol}>
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
                    <Pressable onPress={() => deleteTransaction(tx.id)}>
                      <Text style={[styles.delete, { color: theme.warning }]}>
                        Eliminar
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </PremiumCard>
        ))}

        {groupedByDay.length === 0 ? (
          <PremiumCard>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No hay movimientos con los filtros actuales.
            </Text>
          </PremiumCard>
        ) : null}
      </ScrollView>

      <QuickAddTransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  monthLabel: {
    textTransform: "capitalize",
    marginBottom: 8,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryItem: { flex: 1 },
  summaryCaption: { fontSize: 12 },
  summaryValue: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  segmentRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  segmentChip: {
    flex: 1,
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
  subtitle: { fontSize: 12, marginTop: 3, maxWidth: 220 },
  amountCol: { alignItems: "flex-end" },
  value: { fontWeight: "700" },
  delete: { marginTop: 4, fontWeight: "600", fontSize: 12 },
  emptyText: { fontSize: 13 },
});
