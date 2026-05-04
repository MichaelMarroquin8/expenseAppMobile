import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
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
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatAmountInput, parseAmountInput } from '../../core/utils/format';
import { useFinanceStore } from '../../store/useFinanceStore';

interface QuickAddTransactionModalProps {
  open: boolean;
  onClose: () => void;
  initialType?: 'income' | 'expense';
}

export function QuickAddTransactionModal({
  open,
  onClose,
  initialType = 'expense',
}: QuickAddTransactionModalProps) {
  const { theme } = useAppTheme();
  const currency = useFinanceStore((state) => state.settings.currency);
  const categories = useFinanceStore((state) => state.transactionCategories);
  const accounts = useFinanceStore((state) => state.accounts);
  const addTransactionCategory = useFinanceStore((state) => state.addTransactionCategory);
  const addTransaction = useFinanceStore((state) => state.addTransaction);

  const [type, setType] = useState<'income' | 'expense'>(initialType);
  const [amountRaw, setAmountRaw] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Comida');
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setAmountRaw('');
    setMerchant('');
    setNewCategory('');
    setCategory(initialType === 'income' ? 'Salario' : 'Comida');
    setAccountId(accounts[0]?.id);
  }, [open, initialType, accounts]);

  const sortedCategories = useMemo(() => categories.slice().sort((a, b) => a.localeCompare(b)), [categories]);

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const submit = () => {
    const amount = Number(amountRaw);
    const normalizedMerchant = merchant.trim();
    if (!normalizedMerchant || Number.isNaN(amount) || amount <= 0) return;

    addTransaction({
      type,
      amount,
      currency,
      category,
      tags: [],
      paymentMethod: type === 'income' ? 'transfer' : 'card',
      merchant: normalizedMerchant,
      accountId,
      occurredAt: new Date().toISOString(),
      recurring: false,
      source: 'manual',
    });
    close();
  };

  const addCategory = () => {
    const normalized = newCategory.trim();
    if (!normalized) return;
    const existing = categories.find((item) => item.toLowerCase() === normalized.toLowerCase());
    addTransactionCategory(normalized);
    setCategory(existing ?? normalized);
    setNewCategory('');
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
        <Pressable style={styles.backdropPressable} onPress={close} />
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Nuevo movimiento</Text>
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
              value={formatAmountInput(amountRaw, currency)}
              keyboardType="decimal-pad"
              onChangeText={(value) => setAmountRaw(parseAmountInput(value, currency))}
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

            <Text style={[styles.blockTitle, { color: theme.text }]}>
              {type === 'expense' ? 'Sale de' : 'Entra a'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {accounts.map((account) => (
                <Pressable
                  key={account.id}
                  style={[
                    styles.chip,
                    { borderColor: theme.border },
                    accountId === account.id && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                  ]}
                  onPress={() => setAccountId(account.id)}
                >
                  <Text style={[styles.chipLabel, { color: theme.text }]}>{account.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.blockTitle, { color: theme.text }]}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {sortedCategories.map((item) => (
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

            <View style={styles.addCategoryRow}>
              <TextInput
                value={newCategory}
                onChangeText={setNewCategory}
                placeholder="Nueva categoría"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, styles.addCategoryInput, { color: theme.text, borderColor: theme.border }]}
              />
              <Pressable style={[styles.addCategoryButton, { backgroundColor: theme.primary }]} onPress={addCategory}>
                <Text style={styles.primaryButtonText}>Agregar</Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={[styles.ghostButton, { borderColor: theme.border }]} onPress={close}>
                <Text style={[styles.ghostButtonText, { color: theme.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={submit}>
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
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalTitle: { fontWeight: '800', fontSize: 20, marginBottom: 12 },
  blockTitle: { fontWeight: '700', marginBottom: 6, marginTop: 2 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  segment: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  segmentLabel: { fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  chipsRow: { gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipLabel: { fontSize: 12 },
  addCategoryRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  addCategoryInput: { flex: 1, marginBottom: 0 },
  addCategoryButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  ghostButton: { flex: 1, borderWidth: 1, borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  ghostButtonText: { fontWeight: '700' },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
