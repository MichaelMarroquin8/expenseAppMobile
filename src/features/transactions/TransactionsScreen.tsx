import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, formatShortDate } from '../../core/utils/format';
import { useFinanceStore } from '../../store/useFinanceStore';
import { QuickAddTransactionModal } from './QuickAddTransactionModal';

export function TransactionsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const currency = useFinanceStore((state) => state.settings.currency);
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (tx) => tx.merchant.toLowerCase().includes(q) || tx.category.toLowerCase().includes(q),
    );
  }, [search, transactions]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}
      >
        <SectionTitle title="Transacciones" subtitle="Control total de ingresos y gastos" />

        <PremiumCard>
          <TextInput
            placeholder="Buscar por comercio o categoría"
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <Pressable style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={() => setModalOpen(true)}>
            <Text style={styles.primaryButtonText}>Nueva transacción</Text>
          </Pressable>
        </PremiumCard>

        {filtered.map((tx) => {
          const sourceAccount = tx.accountId ? accounts.find((item) => item.id === tx.accountId) : undefined;
          return (
          <PremiumCard key={tx.id}>
            <View style={styles.row}>
              <View>
                <Text style={[styles.title, { color: theme.text }]}>{tx.merchant}</Text>
                <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                  {tx.category} • {formatShortDate(tx.occurredAt)} • {sourceAccount?.name ?? tx.source}
                </Text>
              </View>
              <Text style={[styles.value, { color: tx.type === 'income' ? theme.success : theme.danger }]}>
                {tx.type === 'income' ? '+' : '-'}
                {formatMoney(tx.amount, currency)}
              </Text>
            </View>
            <Pressable onPress={() => deleteTransaction(tx.id)}>
              <Text style={[styles.delete, { color: theme.warning }]}>Eliminar</Text>
            </Pressable>
          </PremiumCard>
          );
        })}
      </ScrollView>

      <QuickAddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontWeight: '700', fontSize: 16 },
  subtitle: { fontSize: 12, marginTop: 3 },
  value: { fontWeight: '700' },
  delete: { marginTop: 10, fontWeight: '600' },
});
