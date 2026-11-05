import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateField } from '../../components/DateField';
import { KeyboardSafeScroll } from '../../components/KeyboardSafeScroll';
import { ConfirmModal, Field, PremiumCard, Screen } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import {
  dateInputToIso,
  formatAmountInput,
  formatCalendarDate,
  formatMoney,
  isoToDateInput,
  parseAmountInput,
  todayDateInput,
} from '../../core/utils/format';
import { isReceivableKind } from '../../domain/accounts';
import { ReceivableDebt, ReceivablePayment } from '../../domain/models';
import { debtOutstanding, debtPaid, isDebtSettled } from '../../domain/receivables';
import { useFinanceStore } from '../../store/useFinanceStore';

type DebtRoute = RouteProp<{ ReceivableDebt: { accountId: string; debtId?: string } }, 'ReceivableDebt'>;

type TimelineItem = {
  id: string;
  kind: 'loan' | 'payment';
  amount: number;
  occurredAt: string;
  note?: string;
};

export function ReceivableDebtScreen() {
  const { theme, activeMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<DebtRoute>();
  const { accountId, debtId } = route.params;

  const accounts = useFinanceStore((state) => state.accounts);
  const receivables = useFinanceStore((state) => state.receivables);
  const upsertReceivableDebt = useFinanceStore((state) => state.upsertReceivableDebt);
  const deleteReceivableDebt = useFinanceStore((state) => state.deleteReceivableDebt);
  const addReceivablePayment = useFinanceStore((state) => state.addReceivablePayment);
  const deleteReceivablePayment = useFinanceStore((state) => state.deleteReceivablePayment);

  const account = accounts.find((item) => item.id === accountId);
  const debt = receivables.find((item) => item.id === debtId && item.accountId === accountId);
  const currency = account?.currency ?? 'COP';

  const [personName, setPersonName] = useState(debt?.personName ?? '');
  const [principalRaw, setPrincipalRaw] = useState(debt ? String(debt.principal) : '');
  const [lentAtInput, setLentAtInput] = useState(debt ? isoToDateInput(debt.lentAt) : todayDateInput());
  const [note, setNote] = useState(debt?.note ?? '');
  const [seededId, setSeededId] = useState<string | null>(debt?.id ?? null);
  const [paymentRaw, setPaymentRaw] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayDateInput());
  const [paymentNote, setPaymentNote] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<ReceivablePayment | null>(null);

  useEffect(() => {
    if (!debt || seededId === debt.id) return;
    setPersonName(debt.personName);
    setPrincipalRaw(String(debt.principal));
    setLentAtInput(isoToDateInput(debt.lentAt));
    setNote(debt.note ?? '');
    setSeededId(debt.id);
  }, [debt, seededId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: debt?.personName || (debtId ? 'Deuda' : 'Nueva deuda'),
      headerRight: () =>
        debt ? (
          <Pressable
            onPress={() => setDeleteOpen(true)}
            hitSlop={10}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Eliminar deuda"
          >
            <Ionicons name="trash-outline" size={22} color={theme.danger} />
          </Pressable>
        ) : null,
    });
  }, [debt, debtId, navigation, theme.danger]);

  const outstanding = debt ? debtOutstanding(debt) : 0;
  const paid = debt ? debtPaid(debt) : 0;
  const settled = debt ? isDebtSettled(debt) : false;
  const ratio = debt && debt.principal > 0 ? Math.min(1, paid / debt.principal) : 0;

  const timeline = useMemo((): TimelineItem[] => {
    if (!debt) return [];
    const items: TimelineItem[] = [
      { id: `loan_${debt.id}`, kind: 'loan', amount: debt.principal, occurredAt: debt.lentAt, note: debt.note },
      ...debt.payments.map((payment) => ({
        id: payment.id,
        kind: 'payment' as const,
        amount: payment.amount,
        occurredAt: payment.occurredAt,
        note: payment.note,
      })),
    ];
    return items.sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime());
  }, [debt]);

  if (!account || !isReceivableKind(account.kind)) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={{ color: theme.text }}>Esta deuda solo existe en cuentas por cobrar.</Text>
        </View>
      </Screen>
    );
  }

  const saveDebt = () => {
    const principal = Number(principalRaw);
    const lentAt = dateInputToIso(lentAtInput);
    if (!personName.trim()) {
      Alert.alert('Nombre requerido', 'Escribe a quién le prestaste.');
      return;
    }
    if (!Number.isFinite(principal) || principal <= 0) {
      Alert.alert('Monto requerido', 'Escribe cuánto le prestaste.');
      return;
    }
    if (!lentAt) {
      Alert.alert('Fecha inválida', 'Elige la fecha del préstamo en el calendario.');
      return;
    }
    const alreadyPaid = debt ? debtPaid(debt) : 0;
    if (principal + 0.009 < alreadyPaid) {
      Alert.alert(
        'Monto menor que los abonos',
        `Ya te abonaron ${formatMoney(alreadyPaid, currency)}. El préstamo no puede quedar por debajo.`,
      );
      return;
    }
    const next: ReceivableDebt = {
      id: debt?.id ?? `debt_${Date.now()}`,
      accountId: account.id,
      personName: personName.trim(),
      principal,
      lentAt,
      note: note.trim() || undefined,
      payments: debt?.payments ?? [],
    };
    upsertReceivableDebt(next);
    const stored = useFinanceStore.getState().receivables.some((item) => item.id === next.id);
    if (!stored) {
      Alert.alert('No se guardó', 'Revisa el nombre, el monto y que los abonos no superen el préstamo.');
      return;
    }
    if (!debtId) {
      navigation.setParams({ accountId: account.id, debtId: next.id });
    }
  };

  const savePayment = () => {
    if (!debt) {
      Alert.alert('Guarda el préstamo', 'Primero guarda a quién le prestaste. Después puedes anotar abonos.');
      return;
    }
    const amount = Number(paymentRaw);
    const occurredAt = dateInputToIso(paymentDate);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Monto requerido', 'Escribe cuánto te abonó.');
      return;
    }
    if (amount - outstanding > 0.009) {
      Alert.alert(
        'Abono mayor al pendiente',
        `Todavía te deben ${formatMoney(outstanding, currency)}.`,
      );
      return;
    }
    if (!occurredAt) {
      Alert.alert('Fecha inválida', 'Elige la fecha del abono en el calendario.');
      return;
    }
    addReceivablePayment(debt.id, {
      amount,
      occurredAt,
      note: paymentNote.trim() || undefined,
    });
    setPaymentRaw('');
    setPaymentNote('');
    setPaymentDate(todayDateInput());
  };

  return (
    <Screen>
      <KeyboardSafeScroll
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 32, 48) }]}
      >
        {debt ? (
          <PremiumCard>
            <Text style={[styles.kicker, { color: theme.textMuted }]}>
              {settled ? 'Saldada' : 'Pendiente'}
            </Text>
            <Text style={[styles.heroAmount, { color: theme.text }]}>
              {formatMoney(outstanding, currency)}
            </Text>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.trackFill,
                  {
                    width: `${Math.round(ratio * 100)}%`,
                    backgroundColor: settled ? theme.success : theme.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.heroMeta, { color: theme.textMuted }]}>
              Prestado {formatMoney(debt.principal, currency)} · Abonado {formatMoney(paid, currency)}
            </Text>
          </PremiumCard>
        ) : (
          <Text style={[styles.intro, { color: theme.textMuted }]}>
            Anota a quién le prestaste, cuánto y qué día. Después, cada abono queda en la línea de tiempo de esta deuda.
          </Text>
        )}

        <PremiumCard>
          <Text style={[styles.label, { color: theme.textMuted }]}>Persona</Text>
          <Field
            value={personName}
            onChangeText={setPersonName}
            placeholder="Ej. Yuli"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            keyboardAppearance={activeMode === 'dark' ? 'dark' : 'light'}
          />
          <Text style={[styles.label, { color: theme.textMuted }]}>Monto prestado</Text>
          <Field
            value={formatAmountInput(principalRaw, currency)}
            onChangeText={(value) => setPrincipalRaw(parseAmountInput(value, currency))}
            placeholder="400000"
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            keyboardAppearance={activeMode === 'dark' ? 'dark' : 'light'}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <Text style={[styles.label, { color: theme.textMuted }]}>Fecha del préstamo</Text>
          <DateField
            value={lentAtInput}
            onChange={setLentAtInput}
            accessibilityLabel="Elegir la fecha del préstamo"
          />
          <Text style={[styles.label, { color: theme.textMuted }]}>Nota (opcional)</Text>
          <Field
            value={note}
            onChangeText={setNote}
            placeholder="Préstamo personal"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, marginBottom: 4 }]}
            keyboardAppearance={activeMode === 'dark' ? 'dark' : 'light'}
          />
          <Pressable
            onPress={saveDebt}
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Guardar préstamo"
          >
            <Text style={styles.primaryBtnText}>{debt ? 'Guardar cambios' : 'Guardar préstamo'}</Text>
          </Pressable>
        </PremiumCard>

        {debt ? (
          <PremiumCard>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Trazabilidad</Text>
            {timeline.map((item, index) => {
              const isLoan = item.kind === 'loan';
              const payment = isLoan ? undefined : debt.payments.find((entry) => entry.id === item.id);
              return (
                <View
                  key={item.id}
                  style={[
                    styles.event,
                    index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={[styles.eventIcon, { backgroundColor: isLoan ? `${theme.primary}22` : `${theme.success}22` }]}>
                    <Ionicons
                      name={isLoan ? 'arrow-up-outline' : 'arrow-down-outline'}
                      size={16}
                      color={isLoan ? theme.primary : theme.success}
                    />
                  </View>
                  <View style={styles.eventBody}>
                    <Text style={[styles.eventTitle, { color: theme.text }]}>
                      {isLoan ? 'Préstamo' : 'Abono'}
                    </Text>
                    <Text style={[styles.eventDate, { color: theme.textMuted }]}>
                      {formatCalendarDate(item.occurredAt)}
                      {item.note ? ` · ${item.note}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.eventAmount, { color: isLoan ? theme.text : theme.success }]}>
                    {isLoan ? '' : '−'}
                    {formatMoney(item.amount, currency)}
                  </Text>
                  {payment ? (
                    <Pressable
                      onPress={() => setPaymentToDelete(payment)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Eliminar abono"
                    >
                      <Ionicons name="close" size={18} color={theme.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </PremiumCard>
        ) : null}

        {debt && !settled ? (
          <PremiumCard>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Registrar abono</Text>
            <Text style={[styles.helper, { color: theme.textMuted }]}>
              Pendiente actual: {formatMoney(outstanding, currency)}.
            </Text>
            <Text style={[styles.label, { color: theme.textMuted }]}>Monto del abono</Text>
            <Field
              value={formatAmountInput(paymentRaw, currency)}
              onChangeText={(value) => setPaymentRaw(parseAmountInput(value, currency))}
              placeholder="100000"
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              keyboardAppearance={activeMode === 'dark' ? 'dark' : 'light'}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <Text style={[styles.label, { color: theme.textMuted }]}>Fecha del abono</Text>
            <DateField
              value={paymentDate}
              onChange={setPaymentDate}
              accessibilityLabel="Elegir la fecha del abono"
            />
            <Text style={[styles.label, { color: theme.textMuted }]}>Nota del abono (opcional)</Text>
            <Field
              value={paymentNote}
              onChangeText={setPaymentNote}
              placeholder="Transferencia"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, marginBottom: 4 }]}
              keyboardAppearance={activeMode === 'dark' ? 'dark' : 'light'}
            />
            <Pressable
              onPress={savePayment}
              style={[styles.primaryBtn, { backgroundColor: theme.success }]}
              accessibilityRole="button"
              accessibilityLabel="Registrar abono"
            >
              <Text style={styles.primaryBtnText}>Registrar abono</Text>
            </Pressable>
          </PremiumCard>
        ) : null}

        {debt && settled ? (
          <Text style={[styles.helper, { color: theme.success }]}>
            Esta deuda está saldada. Si el monto prestado sube, vuelve a quedar pendiente.
          </Text>
        ) : null}
      </KeyboardSafeScroll>

      <ConfirmModal
        open={deleteOpen}
        title="Eliminar deuda"
        message={
          debt
            ? outstanding > 0.009
              ? `Se quita el préstamo de ${debt.personName} y el saldo baja ${formatMoney(outstanding, currency)}.`
              : `Se quita el historial de ${debt.personName}. El saldo no cambia porque ya estaba saldada.`
            : ''
        }
        confirmLabel="Eliminar"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!debt) return;
          deleteReceivableDebt(debt.id);
          setDeleteOpen(false);
          navigation.goBack();
        }}
      />

      <ConfirmModal
        open={paymentToDelete != null}
        title="Eliminar abono"
        message={
          paymentToDelete
            ? `Se quita el abono de ${formatMoney(paymentToDelete.amount, currency)} y el pendiente vuelve a subir.`
            : ''
        }
        confirmLabel="Eliminar"
        onCancel={() => setPaymentToDelete(null)}
        onConfirm={() => {
          if (!debt || !paymentToDelete) return;
          deleteReceivablePayment(debt.id, paymentToDelete.id);
          setPaymentToDelete(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  intro: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroAmount: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  heroMeta: { fontSize: 12, marginTop: 8 },
  track: { height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  trackFill: { height: 6, borderRadius: 999 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  sectionLabel: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  helper: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  primaryBtn: {
    marginTop: 8,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '800' },
  eventDate: { fontSize: 12, marginTop: 2 },
  eventAmount: { fontSize: 13, fontWeight: '800' },
});
