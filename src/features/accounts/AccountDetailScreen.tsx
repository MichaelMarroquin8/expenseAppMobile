import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useLayoutEffect, useMemo, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import {
  formatAmountInput,
  formatQuantity,
  getCurrencyFractionDigits,
  monthKey,
  monthKeyFromIso,
  parseAmountInput,
} from '../../core/utils/format';
import {
  BALANCE_ADJUSTMENT_CATEGORY,
  BALANCE_ADJUSTMENT_MERCHANT,
  getAccountDisplayCurrency,
  getAccountDisplayValue,
  isBalanceAdjustment,
  isInvestmentKind,
  isLiabilityKind,
} from '../../domain/accounts';
import { FinanceAccount, Transaction } from '../../domain/models';
import { QuickAddTransactionModal } from '../transactions/QuickAddTransactionModal';
import { useFinanceStore } from '../../store/useFinanceStore';

type DetailRoute = RouteProp<{ AccountDetail: { accountId: string } }, 'AccountDetail'>;

const formatPlainAmount = (value: number, currency: string): string => {
  const digits = getCurrencyFractionDigits(currency);
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
};

const formatMonthShort = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
};

const shiftMonthKey = (key: string, delta: number): string => {
  const [year, month] = key.split('-').map(Number);
  return monthKey(new Date(year, month - 1 + delta, 1));
};

const capitalize = (value: string): string =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);

const movementAmount = (tx: Transaction, account: FinanceAccount): number => {
  if (tx.originalCurrency === account.currency && typeof tx.originalAmount === 'number') {
    return tx.originalAmount;
  }
  return tx.amount;
};

const signedDelta = (tx: Transaction, account: FinanceAccount): number => {
  const amount = movementAmount(tx, account);
  const liability = isLiabilityKind(account.kind);
  if (tx.type === 'transfer') {
    if (tx.accountId === account.id) return liability ? amount : -amount;
    if (tx.destinationAccountId === account.id) return liability ? -amount : amount;
    return 0;
  }
  if (tx.accountId !== account.id) return 0;
  if (liability) return tx.type === 'expense' ? amount : -amount;
  return tx.type === 'expense' ? -amount : amount;
};

export function AccountDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<DetailRoute>();
  const accounts = useFinanceStore((state) => state.accounts);
  const transactions = useFinanceStore((state) => state.transactions);
  const settingsCurrency = useFinanceStore((state) => state.settings.currency);
  const addTransaction = useFinanceStore((state) => state.addTransaction);

  const account = accounts.find((item) => item.id === route.params.accountId);
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => monthKey());
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRaw, setAdjustRaw] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Detalles',
      headerRight: () =>
        account ? (
          <Pressable
            onPress={() => navigation.navigate('AccountForm', { accountId: account.id })}
            hitSlop={10}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Editar cuenta"
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
          </Pressable>
        ) : null,
    });
  }, [account, navigation, theme.text]);

  const currency = account ? getAccountDisplayCurrency(account) : settingsCurrency;
  const balance = account ? getAccountDisplayValue(account) : 0;
  const investment = account ? isInvestmentKind(account.kind) : false;
  const currentMonthKey = monthKey();
  const previousMonthKey = shiftMonthKey(selectedMonthKey, -1);
  const nextMonthKey = shiftMonthKey(selectedMonthKey, 1);
  const canGoNext = nextMonthKey <= currentMonthKey;

  const monthMovements = useMemo(() => {
    if (!account) return [];
    return transactions
      .filter((tx) => {
        const involves =
          tx.accountId === account.id || tx.destinationAccountId === account.id;
        return involves && monthKeyFromIso(tx.occurredAt) === selectedMonthKey;
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [account, selectedMonthKey, transactions]);

  const monthTotals = useMemo(() => {
    if (!account) return { expense: 0, income: 0 };
    let expense = 0;
    let income = 0;
    for (const tx of monthMovements) {
      if (isBalanceAdjustment(tx) || tx.type === 'transfer') continue;
      if (tx.accountId !== account.id) continue;
      const amount = movementAmount(tx, account);
      if (tx.type === 'expense') expense += amount;
      if (tx.type === 'income') income += amount;
    }
    return { expense, income };
  }, [account, monthMovements]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const tx of monthMovements) {
      const key = new Date(tx.occurredAt).toDateString();
      const list = groups.get(key) ?? [];
      list.push(tx);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([dayKey, items]) => {
      const date = new Date(items[0].occurredAt);
      const dayLabel = `${date.getDate()} ${new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(date)}`;
      const weekday = capitalize(
        new Intl.DateTimeFormat('es-CO', { weekday: 'long' }).format(date),
      );
      return { dayKey, dayLabel, weekday, items };
    });
  }, [monthMovements]);

  if (!account) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={{ color: theme.text }}>No encontramos esta cuenta.</Text>
        </View>
      </Screen>
    );
  }

  const iconName = (account.icon ?? 'wallet-outline') as keyof typeof Ionicons.glyphMap;

  const openAdjust = () => {
    if (investment) {
      navigation.navigate('AccountForm', { accountId: account.id });
      return;
    }
    setAdjustRaw(String(account.balance || ''));
    setAdjustOpen(true);
  };

  const saveAdjustment = () => {
    const target = Number(adjustRaw);
    if (!Number.isFinite(target)) return;
    const safeTarget = isLiabilityKind(account.kind) ? target : Math.max(target, 0);
    const delta = safeTarget - account.balance;
    const digits = getCurrencyFractionDigits(account.currency);
    const epsilon = digits === 0 ? 0.5 : 10 ** -(digits + 1);
    if (Math.abs(delta) < epsilon) {
      setAdjustOpen(false);
      return;
    }
    const increasesBalance = delta > 0;
    const liability = isLiabilityKind(account.kind);
    const type = liability
      ? increasesBalance
        ? 'expense'
        : 'income'
      : increasesBalance
        ? 'income'
        : 'expense';
    addTransaction({
      type,
      amount: Math.abs(delta),
      currency: account.currency,
      originalAmount: Math.abs(delta),
      originalCurrency: account.currency,
      category: BALANCE_ADJUSTMENT_CATEGORY,
      tags: [],
      paymentMethod: 'transfer',
      merchant: BALANCE_ADJUSTMENT_MERCHANT,
      accountId: account.id,
      occurredAt: new Date().toISOString(),
      recurring: false,
      source: 'manual',
    });
    setAdjustOpen(false);
  };

  const movementTitle = (tx: Transaction): string => {
    if (isBalanceAdjustment(tx)) return BALANCE_ADJUSTMENT_MERCHANT;
    if (tx.type === 'transfer') {
      const source = accounts.find((item) => item.id === tx.accountId)?.name ?? 'Cuenta';
      const destination =
        accounts.find((item) => item.id === tx.destinationAccountId)?.name ?? 'Cuenta';
      return `${source} → ${destination}`;
    }
    return tx.merchant;
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom + 96, 120) },
        ]}
      >
        <PremiumCard style={[styles.hero, { borderLeftColor: account.color }]}>
          <View style={styles.watermark} pointerEvents="none">
            <Ionicons name={iconName} size={78} color={theme.textMuted} style={{ opacity: 0.22 }} />
          </View>
          <Text style={[styles.heroName, { color: theme.text }]}>{account.name}</Text>
          <View style={styles.balanceRow}>
            <Text style={[styles.currencyCode, { color: theme.textMuted }]}>{currency}</Text>
            <Text style={[styles.balanceValue, { color: theme.text }]}>
              {formatPlainAmount(balance, currency)}
            </Text>
            <Pressable
              onPress={openAdjust}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Ajustar saldo"
            >
              <Ionicons name="pencil" size={16} color={theme.textMuted} />
            </Pressable>
          </View>
          {investment ? (
            <Text style={[styles.heroHint, { color: theme.textMuted }]}>
              {account.symbol
                ? `${formatQuantity(account.quantity ?? 0)} × ${account.symbol}. `
                : ''}
              El valor sale de la cantidad por el precio. El lápiz abre la edición.
            </Text>
          ) : null}
        </PremiumCard>

        <View style={styles.monthHeader}>
          <Text style={[styles.monthTitle, { color: theme.text }]}>
            {formatMonthShort(selectedMonthKey)}
          </Text>
          <Text style={[styles.monthTotals, { color: theme.textMuted }]}>
            Gastos: {formatPlainAmount(monthTotals.expense, currency)} Ingresos:{' '}
            {formatPlainAmount(monthTotals.income, currency)}
          </Text>
        </View>

        {grouped.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            No hay movimientos en {formatMonthShort(selectedMonthKey)}.
          </Text>
        ) : (
          grouped.map((group) => (
            <View key={group.dayKey} style={styles.dayBlock}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayLabel, { color: theme.text }]}>{group.dayLabel}</Text>
                <Text style={[styles.weekday, { color: theme.textMuted }]}>{group.weekday}</Text>
              </View>
              {group.items.map((tx) => {
                const delta = signedDelta(tx, account);
                const adjustment = isBalanceAdjustment(tx);
                const icon: keyof typeof Ionicons.glyphMap = adjustment
                  ? 'options'
                  : tx.type === 'transfer'
                    ? 'swap-horizontal'
                    : delta >= 0
                      ? 'arrow-down'
                      : 'arrow-up';
                return (
                  <Pressable
                    key={tx.id}
                    style={[styles.movement, { borderTopColor: theme.border }]}
                    onPress={() => {
                      setEditingTx(tx);
                      setComposeOpen(true);
                    }}
                  >
                    <View style={[styles.movementIcon, { backgroundColor: `${theme.warning}22` }]}>
                      <Ionicons name={icon} size={18} color={theme.warning} />
                    </View>
                    <Text style={[styles.movementTitle, { color: theme.text }]} numberOfLines={1}>
                      {movementTitle(tx)}
                    </Text>
                    <Text
                      style={[
                        styles.movementAmount,
                        { color: delta > 0 ? theme.success : theme.text },
                      ]}
                    >
                      {delta > 0 ? '+' : delta < 0 ? '−' : ''}
                      {formatPlainAmount(Math.abs(delta), currency)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}

        <View style={styles.monthNav}>
          <Pressable
            style={[styles.monthPill, { borderColor: theme.border }]}
            onPress={() => setSelectedMonthKey(previousMonthKey)}
          >
            <Text style={[styles.monthPillText, { color: theme.text }]}>
              {formatMonthShort(previousMonthKey)} ←
            </Text>
          </Pressable>
          <Pressable
            disabled={!canGoNext}
            style={[
              styles.monthPill,
              { borderColor: theme.border },
              !canGoNext && styles.monthPillDisabled,
            ]}
            onPress={() => canGoNext && setSelectedMonthKey(nextMonthKey)}
          >
            <Text style={[styles.monthPillText, { color: theme.text }]}>
              → {formatMonthShort(nextMonthKey)}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nuevo movimiento"
        style={[
          styles.fab,
          { backgroundColor: theme.primary, bottom: Math.max(insets.bottom, 16) + 16 },
        ]}
        onPress={() => {
          setEditingTx(null);
          setComposeOpen(true);
        }}
      >
        <Ionicons name="add" size={28} color={theme.surface} />
      </Pressable>

      <QuickAddTransactionModal
        open={composeOpen}
        editingTransaction={editingTx}
        presetAccountId={editingTx ? undefined : account.id}
        onClose={() => {
          setComposeOpen(false);
          setEditingTx(null);
        }}
      />

      <Modal visible={adjustOpen} transparent animationType="fade" onRequestClose={() => setAdjustOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setAdjustOpen(false)}>
            <Pressable
              style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => undefined}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>Ajustar saldo</Text>
              <Text style={[styles.modalHint, { color: theme.textMuted }]}>
                Escribe el saldo real. La diferencia queda en el historial como “Ajustar importe”.
              </Text>
              <TextInput
                value={formatAmountInput(adjustRaw, account.currency)}
                onChangeText={(value) => setAdjustRaw(parseAmountInput(value, account.currency))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setAdjustOpen(false)}
                  style={[styles.modalAction, { borderWidth: 1, borderColor: theme.border }]}
                >
                  <Text style={[styles.modalActionText, { color: theme.text }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={saveAdjustment}
                  style={[styles.modalAction, { backgroundColor: theme.primary }]}
                >
                  <Text style={[styles.modalActionText, { color: '#fff' }]}>Guardar</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  hero: {
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: 8,
    top: 8,
  },
  heroName: { fontSize: 18, fontWeight: '800' },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 14,
  },
  currencyCode: { fontSize: 13, fontWeight: '700' },
  balanceValue: { fontSize: 28, fontWeight: '800' },
  heroHint: { marginTop: 8, fontSize: 12, lineHeight: 16 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  monthTitle: { fontSize: 15, fontWeight: '700', textTransform: 'lowercase' },
  monthTotals: { flex: 1, textAlign: 'right', fontSize: 12 },
  empty: { fontSize: 13, marginBottom: 16, paddingHorizontal: 4 },
  dayBlock: { marginBottom: 8 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  dayLabel: { fontSize: 14, fontWeight: '700' },
  weekday: { fontSize: 14 },
  movement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  movementIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movementTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  movementAmount: { fontSize: 15, fontWeight: '700' },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 18,
  },
  monthPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  monthPillDisabled: { opacity: 0.35 },
  monthPillText: { fontSize: 13, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalHint: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
  modalActionText: { fontWeight: '700', fontSize: 15 },
});
