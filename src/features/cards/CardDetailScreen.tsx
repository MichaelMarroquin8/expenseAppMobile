import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, formatShortDate } from '../../core/utils/format';
import { cardAvailable, cardDebt, cardMovements, firstLiquidAccountId, linkedAccount } from '../../domain/cardLedger';
import { QuickAddTransactionModal } from '../transactions/QuickAddTransactionModal';
import { useFinanceStore } from '../../store/useFinanceStore';

type DetailRoute = RouteProp<{ CardDetail: { cardId: string } }, 'CardDetail'>;

export function CardDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<DetailRoute>();
  const currency = useFinanceStore((state) => state.settings.currency);
  const cards = useFinanceStore((state) => state.cards);
  const accounts = useFinanceStore((state) => state.accounts);
  const transactions = useFinanceStore((state) => state.transactions);
  const deleteCard = useFinanceStore((state) => state.deleteCard);
  const [payOpen, setPayOpen] = useState(false);

  const card = cards.find((item) => item.id === route.params.cardId);
  if (!card) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={{ color: theme.text }}>No encontramos esta tarjeta.</Text>
        </View>
      </Screen>
    );
  }

  const account = linkedAccount(card, accounts);
  const debt = cardDebt(card, accounts);
  const available = cardAvailable(card, accounts);
  const movements = cardMovements(card, transactions);
  const payFromId = firstLiquidAccountId(accounts, card.accountId);
  const canPay = card.cardType === 'credit' && !!card.accountId && !!payFromId;

  const confirmDelete = () => {
    Alert.alert('Eliminar tarjeta', `¿Eliminar “${card.alias}”? La cuenta y sus movimientos se conservan.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          deleteCard(card.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}>
        <SectionTitle title={card.alias} subtitle={`${card.bank} · **** ${card.last4}`} />

        <PremiumCard style={{ backgroundColor: `${card.color}18` }}>
          <Text style={[styles.kind, { color: theme.textMuted }]}>
            {card.cardType === 'credit' ? 'Crédito' : 'Débito'}
            {account ? ` · ${account.name}` : ''}
          </Text>
          {card.cardType === 'credit' ? (
            <View style={styles.figures}>
              <View style={styles.figure}>
                <Text style={[styles.figureLabel, { color: theme.textMuted }]}>Cupo</Text>
                <Text style={[styles.figureValue, { color: theme.text }]}>
                  {card.limit != null ? formatMoney(card.limit, currency) : 'Sin cupo'}
                </Text>
              </View>
              <View style={styles.figure}>
                <Text style={[styles.figureLabel, { color: theme.textMuted }]}>Deuda</Text>
                <Text style={[styles.figureValue, { color: theme.text }]}>{formatMoney(debt, currency)}</Text>
              </View>
              <View style={styles.figure}>
                <Text style={[styles.figureLabel, { color: theme.textMuted }]}>Disponible</Text>
                <Text style={[styles.figureValue, { color: available != null && available < 0 ? theme.danger : theme.text }]}>
                  {available != null ? formatMoney(available, currency) : '—'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.debitNote, { color: theme.textMuted }]}>
              Cada compra sale de {account?.name ?? 'la cuenta ligada'} el mismo día. Esta tarjeta no acumula deuda.
            </Text>
          )}
          {card.cardType === 'credit' && card.dueDay && debt > 0 ? (
            <View style={[styles.reminder, { borderColor: theme.warning, backgroundColor: `${theme.warning}18` }]}>
              <Ionicons name="calendar-outline" size={16} color={theme.warning} />
              <Text style={[styles.reminderText, { color: theme.text }]}>
                Pago el día {card.dueDay}
                {card.statementDay ? ` · Corte el día ${card.statementDay}` : ''}. Es un aviso, no un gasto. El pago es una
                transferencia desde tu banco.
              </Text>
            </View>
          ) : null}
          {canPay ? (
            <Pressable style={[styles.payButton, { backgroundColor: theme.primary }]} onPress={() => setPayOpen(true)}>
              <Text style={styles.payButtonText}>Registrar pago</Text>
            </Pressable>
          ) : null}
        </PremiumCard>

        <Text style={[styles.section, { color: theme.text }]}>Movimientos</Text>
        {movements.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>Todavía no hay compras ni pagos en esta tarjeta.</Text>
        ) : (
          movements.map((movement) => {
            const isPayment = movement.type === 'transfer';
            return (
              <PremiumCard key={movement.id}>
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={[styles.merchant, { color: theme.text }]}>
                      {isPayment ? 'Pago de tarjeta' : movement.merchant}
                    </Text>
                    <Text style={[styles.date, { color: theme.textMuted }]}>{formatShortDate(movement.occurredAt)}</Text>
                  </View>
                  <Text style={[styles.amount, { color: isPayment ? theme.success : theme.danger }]}>
                    {isPayment ? '−' : ''}
                    {formatMoney(movement.amount, currency)}
                  </Text>
                </View>
              </PremiumCard>
            );
          })
        )}

        <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={{ color: theme.danger, fontWeight: '700' }}>Eliminar tarjeta</Text>
        </Pressable>
      </ScrollView>

      {canPay ? (
        <QuickAddTransactionModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          initialType="transfer"
          presetAccountId={payFromId}
          presetDestinationAccountId={card.accountId}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  kind: { fontSize: 13, fontWeight: '700', marginBottom: 12 },
  figures: { flexDirection: 'row', gap: 8 },
  figure: { flex: 1 },
  figureLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  figureValue: { fontSize: 14, fontWeight: '800' },
  debitNote: { fontSize: 13, lineHeight: 18 },
  reminder: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
  },
  reminderText: { flex: 1, fontSize: 13, lineHeight: 18 },
  payButton: { marginTop: 14, borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  payButtonText: { color: '#fff', fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '800', marginBottom: 8, marginTop: 4 },
  empty: { fontSize: 13, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  merchant: { fontWeight: '700', fontSize: 15 },
  date: { marginTop: 2, fontSize: 12 },
  amount: { fontWeight: '800', fontSize: 14 },
  deleteBtn: { alignItems: 'center', paddingVertical: 16 },
});
