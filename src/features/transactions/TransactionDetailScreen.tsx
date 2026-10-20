import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmModal, PremiumCard, Screen } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, formatShortDate } from '../../core/utils/format';
import { Transaction } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';
import { QuickAddTransactionModal } from './QuickAddTransactionModal';

type DetailRoute = RouteProp<
  { TransactionDetail: { transactionId: string } },
  'TransactionDetail'
>;

const TYPE_LABEL: Record<Transaction['type'], string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
};

const SOURCE_LABEL: Record<Transaction['source'], string> = {
  manual: 'Manual',
  sms: 'SMS',
  notification: 'Notificación',
};

export function TransactionDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<DetailRoute>();
  const currency = useFinanceStore((state) => state.settings.currency);
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const categoryIcons = useFinanceStore((state) => state.categoryIcons);
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction);
  const [editing, setEditing] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const tx = transactions.find((item) => item.id === route.params.transactionId);

  if (!tx) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={{ color: theme.text }}>No encontramos este movimiento.</Text>
        </View>
      </Screen>
    );
  }

  const iconName =
    (categoryIcons[tx.category] as keyof typeof Ionicons.glyphMap | undefined) ??
    'pricetag-outline';
  const amountColor =
    tx.type === 'income' ? theme.success : tx.type === 'expense' ? theme.danger : theme.primary;
  const sourceAccount = tx.accountId
    ? accounts.find((account) => account.id === tx.accountId)
    : undefined;
  const destinationAccount = tx.destinationAccountId
    ? accounts.find((account) => account.id === tx.destinationAccountId)
    : undefined;
  const accountLabel =
    tx.type === 'transfer'
      ? `${sourceAccount?.name ?? 'Cuenta'} → ${destinationAccount?.name ?? 'Cuenta'}`
      : (sourceAccount?.name ?? 'Sin cuenta');
  const signedAmount = `${tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}${formatMoney(tx.amount, currency)}`;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PremiumCard style={styles.card}>
          <View style={styles.hero}>
            <View style={[styles.iconCircle, { backgroundColor: `${amountColor}22` }]}>
              <Ionicons name={iconName} size={20} color={amountColor} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.merchant, { color: theme.text }]} numberOfLines={1}>
                {tx.merchant}
              </Text>
              <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
                {tx.category} · {TYPE_LABEL[tx.type]}
              </Text>
            </View>
            <View style={styles.amountCol}>
              <Text style={[styles.amount, { color: amountColor }]}>{signedAmount}</Text>
              {tx.originalCurrency &&
              tx.originalAmount != null &&
              tx.originalCurrency !== tx.currency ? (
                <Text style={[styles.originalAmount, { color: theme.textMuted }]}>
                  {formatMoney(tx.originalAmount, tx.originalCurrency)}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.details, { borderTopColor: theme.border }]}>
            <DetailRow label="Fecha" value={formatShortDate(tx.occurredAt)} />
            <DetailRow label="Cuenta" value={accountLabel} />
            <DetailRow label="Origen" value={SOURCE_LABEL[tx.source]} />
            <DetailRow label="Nota" value={tx.note?.trim() ? tx.note : 'Sin nota'} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar movimiento"
            onPress={() => setEditing(true)}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.primaryButtonText}>Editar movimiento</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Eliminar movimiento"
            onPress={() => setConfirmDeleteOpen(true)}
            style={styles.deleteButton}
          >
            <Text style={[styles.deleteButtonText, { color: theme.danger }]}>
              Eliminar movimiento
            </Text>
          </Pressable>
        </PremiumCard>
      </ScrollView>

      <QuickAddTransactionModal
        open={editing}
        editingTransaction={tx}
        onClose={() => setEditing(false)}
      />

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Eliminar movimiento"
        message={`¿Eliminar “${tx.merchant}”? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          deleteTransaction(tx.id);
          setConfirmDeleteOpen(false);
          navigation.goBack();
        }}
      />
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16 },
  card: { marginBottom: 0 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1 },
  merchant: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 2, fontSize: 12 },
  amountCol: { alignItems: 'flex-end', marginLeft: 8 },
  amount: { fontSize: 16, fontWeight: '800' },
  originalAmount: { marginTop: 2, fontSize: 11 },
  details: { marginTop: 12, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailLabel: { width: 64, fontSize: 13 },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '700' },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  deleteButton: { alignItems: 'center', paddingTop: 12 },
  deleteButtonText: { fontWeight: '700' },
});
