import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ConfirmModal, PremiumCard, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatCalendarDate, formatMoney } from '../../core/utils/format';
import {
  debtOutstanding,
  debtPaid,
  isDebtSettled,
  moneyDiffers,
  sumOutstanding,
  sumPaid,
  unallocatedReceivable,
} from '../../domain/receivables';
import { FinanceAccount, ReceivableDebt } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

const latestPayment = (debt: ReceivableDebt) =>
  [...debt.payments].sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  )[0];

export function ReceivableLedger({ account }: { account: FinanceAccount }) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<any>();
  const receivables = useFinanceStore((state) => state.receivables);
  const alignReceivableBalance = useFinanceStore((state) => state.alignReceivableBalance);
  const [alignOpen, setAlignOpen] = useState(false);

  const debts = useMemo(
    () =>
      receivables
        .filter((debt) => debt.accountId === account.id)
        .sort((left, right) => new Date(left.lentAt).getTime() - new Date(right.lentAt).getTime()),
    [account.id, receivables],
  );
  const openDebts = debts.filter((debt) => !isDebtSettled(debt));
  const settledDebts = debts.filter((debt) => isDebtSettled(debt));
  const tracked = sumOutstanding(debts);
  const paid = sumPaid(debts);
  const unallocated = unallocatedReceivable(account.balance, debts);
  const shortfall = tracked - account.balance > 0.009;
  const mismatch = debts.length > 0 && moneyDiffers(account.balance, tracked);

  const openDebt = (debtId?: string) => {
    navigation.navigate('ReceivableDebt', { accountId: account.id, debtId });
  };

  return (
    <View>
      <SectionTitle
        title="Desglose"
        subtitle="Cada persona, la fecha del préstamo y los abonos que ya te hizo"
      />

      <PremiumCard>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Te deben ahora</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatMoney(account.balance, account.currency)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Repartido en personas</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatMoney(tracked, account.currency)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Abonado en total</Text>
          <Text style={[styles.summaryValue, { color: theme.success }]}>
            {formatMoney(paid, account.currency)}
          </Text>
        </View>
        {unallocated > 0.009 ? (
          <Text style={[styles.notice, { color: theme.warning }]}>
            Sin asignar: {formatMoney(unallocated, account.currency)}. Este monto está en el saldo, pero todavía no tiene persona ni fecha.
          </Text>
        ) : null}
        {shortfall ? (
          <Text style={[styles.notice, { color: theme.warning }]}>
            El desglose suma más que el saldo de la cuenta.
          </Text>
        ) : null}
        {mismatch ? (
          <Pressable
            onPress={() => setAlignOpen(true)}
            style={[styles.alignButton, { borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Igualar el saldo al desglose"
          >
            <Text style={[styles.alignButtonText, { color: theme.primary }]}>Igualar el saldo al desglose</Text>
          </Pressable>
        ) : debts.length > 0 ? (
          <Text style={[styles.matchHint, { color: theme.textMuted }]}>
            El saldo coincide con lo que todavía te deben.
          </Text>
        ) : null}
      </PremiumCard>

      {debts.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>
          Todavía no hay personas. Agrega cada préstamo, por ejemplo 400.000 a Yuli el 15 de junio. Los abonos se anotan dentro de esa deuda.
        </Text>
      ) : null}

      {openDebts.map((debt) => (
        <DebtRow
          key={debt.id}
          debt={debt}
          currency={account.currency}
          onPress={() => openDebt(debt.id)}
        />
      ))}

      {settledDebts.length > 0 ? (
        <Text style={[styles.settledTitle, { color: theme.textMuted }]}>Saldadas</Text>
      ) : null}
      {settledDebts.map((debt) => (
        <DebtRow
          key={debt.id}
          debt={debt}
          currency={account.currency}
          onPress={() => openDebt(debt.id)}
        />
      ))}

      <Pressable
        onPress={() => openDebt(undefined)}
        style={[styles.addButton, { backgroundColor: theme.primary }]}
        accessibilityRole="button"
        accessibilityLabel="Agregar persona"
      >
        <Ionicons name="person-add-outline" size={18} color="#fff" />
        <Text style={styles.addButtonText}>Agregar persona</Text>
      </Pressable>

      <ConfirmModal
        open={alignOpen}
        title="Igualar saldo"
        message={
          shortfall
            ? 'El saldo de la cuenta pasará a ser la suma de lo que todavía te deben.'
            : 'El saldo quedará solo con lo repartido entre personas. Lo que estaba sin asignar sale de la cuenta.'
        }
        confirmLabel="Igualar"
        tone="primary"
        icon="swap-horizontal-outline"
        onCancel={() => setAlignOpen(false)}
        onConfirm={() => {
          alignReceivableBalance(account.id);
          setAlignOpen(false);
        }}
      />
    </View>
  );
}

function DebtRow({
  debt,
  currency,
  onPress,
}: {
  debt: ReceivableDebt;
  currency: string;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const paid = debtPaid(debt);
  const outstanding = debtOutstanding(debt);
  const settled = isDebtSettled(debt);
  const ratio = debt.principal > 0 ? Math.min(1, paid / debt.principal) : 0;
  const last = latestPayment(debt);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Deuda de ${debt.personName}`}>
      <PremiumCard>
        <View style={styles.debtHeader}>
          <View style={[styles.avatar, { backgroundColor: `${theme.primary}22` }]}>
            <Ionicons name="person-outline" size={18} color={theme.primary} />
          </View>
          <View style={styles.debtTitleBlock}>
            <Text style={[styles.person, { color: theme.text }]}>{debt.personName}</Text>
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              Prestado el {formatCalendarDate(debt.lentAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </View>

        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.trackFill,
              { width: `${Math.round(ratio * 100)}%`, backgroundColor: settled ? theme.success : theme.primary },
            ]}
          />
        </View>

        <View style={styles.figures}>
          <Text style={[styles.figure, { color: theme.textMuted }]}>
            Prestado {formatMoney(debt.principal, currency)}
          </Text>
          <Text style={[styles.figure, { color: theme.success }]}>
            Abonado {formatMoney(paid, currency)}
          </Text>
        </View>
        <Text style={[styles.pending, { color: settled ? theme.success : theme.text }]}>
          {settled ? 'Saldada' : `Pendiente ${formatMoney(outstanding, currency)}`}
        </Text>
        {last ? (
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            Último abono: {formatMoney(last.amount, currency)} el {formatCalendarDate(last.occurredAt)}
          </Text>
        ) : (
          <Text style={[styles.meta, { color: theme.textMuted }]}>Sin abonos todavía</Text>
        )}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 13, flex: 1 },
  summaryValue: { fontSize: 14, fontWeight: '800' },
  notice: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  matchHint: { fontSize: 12, marginTop: 4 },
  alignButton: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  alignButtonText: { fontWeight: '700', fontSize: 13 },
  empty: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  settledTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  addButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  debtHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtTitleBlock: { flex: 1 },
  person: { fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 2 },
  track: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
  },
  trackFill: { height: 6, borderRadius: 999 },
  figures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  figure: { fontSize: 12, fontWeight: '600' },
  pending: { fontSize: 15, fontWeight: '800', marginTop: 6 },
});
