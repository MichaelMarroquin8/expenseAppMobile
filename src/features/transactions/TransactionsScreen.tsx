import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, formatShortDate } from '../../core/utils/format';
import { Transaction } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

const categories = ['Comida', 'Transporte', 'Supermercado', 'Entretenimiento', 'Servicios', 'Salario', 'Otros'];

export function TransactionsScreen() {
  const { theme } = useAppTheme();
  const currency = useFinanceStore((state) => state.settings.currency);
  const transactions = useFinanceStore((state) => state.transactions);
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('0');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Comida');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (tx) => tx.merchant.toLowerCase().includes(q) || tx.category.toLowerCase().includes(q),
    );
  }, [search, transactions]);

  const submit = () => {
    const normalizedAmount = Number(amount);
    if (!merchant || Number.isNaN(normalizedAmount) || normalizedAmount <= 0) return;
    addTransaction({
      type,
      amount: normalizedAmount,
      currency,
      category,
      tags: [],
      paymentMethod: type === 'income' ? 'transfer' : 'card',
      merchant,
      occurredAt: new Date().toISOString(),
      recurring: false,
      source: 'manual',
    });
    setModalOpen(false);
    setMerchant('');
    setAmount('0');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
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

        {filtered.map((tx) => (
          <PremiumCard key={tx.id}>
            <View style={styles.row}>
              <View>
                <Text style={[styles.title, { color: theme.text }]}>{tx.merchant}</Text>
                <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                  {tx.category} • {formatShortDate(tx.occurredAt)} • {tx.source}
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
        ))}
      </ScrollView>

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        type={type}
        setType={setType}
        amount={amount}
        setAmount={setAmount}
        merchant={merchant}
        setMerchant={setMerchant}
        category={category}
        setCategory={setCategory}
        onSubmit={submit}
      />
    </Screen>
  );
}

function TransactionModal({
  open,
  onClose,
  type,
  setType,
  amount,
  setAmount,
  merchant,
  setMerchant,
  category,
  setCategory,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  type: Transaction['type'];
  setType: (value: Transaction['type']) => void;
  amount: string;
  setAmount: (value: string) => void;
  merchant: string;
  setMerchant: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  onSubmit: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Nueva transacción</Text>
            <View style={styles.segmentRow}>
              {(['expense', 'income'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setType(option)}
                  style={[
                    styles.segment,
                    { borderColor: theme.border },
                    type === option && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                >
                  <Text style={[styles.segmentLabel, { color: type === option ? '#fff' : theme.text }]}>
                    {option === 'expense' ? 'Gasto' : 'Ingreso'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={amount}
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="Monto"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Comercio o descripción"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {categories.map((item) => (
                <Pressable
                  key={item}
                  style={[
                    styles.chip,
                    { borderColor: theme.border },
                    item === category && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                  ]}
                  onPress={() => setCategory(item)}
                >
                  <Text style={[styles.chipLabel, { color: theme.text }]}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={[styles.ghostButton, { borderColor: theme.border }]} onPress={onClose}>
                <Text style={[styles.ghostButtonText, { color: theme.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={onSubmit}>
                <Text style={styles.primaryButtonText}>Guardar</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000066',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 16,
    maxHeight: '85%',
  },
  modalTitle: { fontWeight: '800', fontSize: 20, marginBottom: 12 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  segment: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  segmentLabel: { fontWeight: '700' },
  chipsRow: { gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipLabel: { fontSize: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  ghostButton: { flex: 1, borderWidth: 1, borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  ghostButtonText: { fontWeight: '700' },
});
