import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatAmountInput, formatMoney, parseAmountInput } from '../../core/utils/format';
import { defaultIconForKind, isInstitutionAccount, isLiquidKind, normalizeAccountKind } from '../../domain/accounts';
import { cardAvailable, cardDebt } from '../../domain/cardLedger';
import { FinanceAccount } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

type Nav = NativeStackNavigationProp<{
  Cards: undefined;
  CardDetail: { cardId: string };
}>;

type CardFieldErrors = {
  alias?: string;
  bank?: string;
  last4?: string;
  limit?: string;
  days?: string;
};

const palette = ['#2563EB', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'];

const parseDay = (raw: string): number | null => {
  if (!/^\d{1,2}$/.test(raw.trim())) return null;
  const day = Number(raw);
  if (day < 1 || day > 31) return null;
  return day;
};

export function CardsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const currency = useFinanceStore((state) => state.settings.currency);
  const cards = useFinanceStore((state) => state.cards);
  const accounts = useFinanceStore((state) => state.accounts);
  const upsertCard = useFinanceStore((state) => state.upsertCard);
  const upsertAccount = useFinanceStore((state) => state.upsertAccount);
  const [alias, setAlias] = useState('');
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [last4, setLast4] = useState('');
  const [limitRaw, setLimitRaw] = useState('');
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [statementRaw, setStatementRaw] = useState('');
  const [dueRaw, setDueRaw] = useState('');
  const [errors, setErrors] = useState<CardFieldErrors>({});
  const scrollRef = useRef<ScrollView>(null);

  const bankAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        cardType === 'debit' ? isLiquidKind(account.kind) : isInstitutionAccount(account.kind),
      ),
    [accounts, cardType],
  );
  const selectedBank = bankAccounts.find((account) => account.id === accountId);
  const selectedIsCreditAccount = selectedBank
    ? normalizeAccountKind(selectedBank.kind) === 'credit_card'
    : false;

  const clearError = (field: keyof CardFieldErrors) => {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const selectType = (next: 'credit' | 'debit') => {
    setCardType(next);
    setAccountId(undefined);
    setErrors({});
  };

  const createCard = () => {
    const normalizedAlias = alias.trim();
    const normalizedBank = (selectedBank?.provider.trim() || selectedBank?.name.trim() || '').trim();
    const normalizedLast4 = last4.replace(/\D/g, '').slice(-4);
    const limit = Number(limitRaw || 0);
    const statement = parseDay(statementRaw);
    const due = parseDay(dueRaw);
    const nextErrors: CardFieldErrors = {};
    if (!normalizedAlias) nextErrors.alias = 'Escribe un nombre para la tarjeta.';
    if (!selectedBank || !normalizedBank) {
      nextErrors.bank =
        bankAccounts.length === 0
          ? 'Crea primero una cuenta en Más, dentro de Cuentas.'
          : 'Elige la cuenta de esta tarjeta.';
    }
    if (normalizedLast4.length !== 4) {
      nextErrors.last4 = 'Ingresa los últimos 4 dígitos.';
    } else if (
      normalizedBank &&
      cards.some(
        (card) =>
          card.last4 === normalizedLast4 && card.bank.trim().toLowerCase() === normalizedBank.toLowerCase(),
      )
    ) {
      nextErrors.last4 = 'Ya guardaste una tarjeta de ese banco con esos 4 dígitos.';
    }
    if (cardType === 'credit') {
      if (!(limit > 0)) nextErrors.limit = 'Escribe el cupo de la tarjeta.';
      if (statement == null || due == null) nextErrors.days = 'El corte y el pago van del día 1 al 31.';
    }
    if (nextErrors.alias || nextErrors.bank || nextErrors.last4 || nextErrors.limit || nextErrors.days) {
      setErrors(nextErrors);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!selectedBank) return;

    const color = palette[Math.floor(Math.random() * palette.length)];
    let linkedAccountId = selectedBank.id;
    if (cardType === 'credit' && !selectedIsCreditAccount) {
      const debtAccount: FinanceAccount = {
        id: `acc_${Date.now()}`,
        name: normalizedAlias,
        provider: normalizedBank,
        kind: 'credit_card',
        balance: 0,
        currency: selectedBank.currency || currency,
        color,
        icon: defaultIconForKind('credit_card'),
      };
      upsertAccount(debtAccount);
      linkedAccountId = debtAccount.id;
    }

    setErrors({});
    upsertCard({
      id: `card_${Date.now()}`,
      alias: normalizedAlias,
      bank: normalizedBank,
      cardType,
      last4: normalizedLast4,
      color,
      icon: cardType === 'credit' ? 'card-outline' : 'wallet-outline',
      accountId: linkedAccountId,
      limit: cardType === 'credit' && limit > 0 ? limit : undefined,
      statementDay: cardType === 'credit' ? statement ?? undefined : undefined,
      dueDay: cardType === 'credit' ? due ?? undefined : undefined,
    });
    setAlias('');
    setLast4('');
    setLimitRaw('');
    setAccountId(undefined);
    setStatementRaw('');
    setDueRaw('');
  };

  return (
    <Screen>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}
      >
        <SectionTitle title="Tarjetas y métodos de pago" subtitle="Solo se guardan últimos 4 dígitos" />

        <PremiumCard>
          <Text style={[styles.formTitle, { color: theme.text }]}>Agregar tarjeta</Text>
          {errors.alias || errors.bank || errors.last4 || errors.limit || errors.days ? (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.errorBanner, { backgroundColor: `${theme.danger}18`, borderColor: theme.danger }]}
            >
              <Ionicons name="alert-circle" size={18} color={theme.danger} />
              <Text style={[styles.errorText, { color: theme.danger }]}>
                Revisa los campos marcados para guardar la tarjeta.
              </Text>
            </View>
          ) : null}
          <TextInput
            value={alias}
            onChangeText={(value) => {
              setAlias(value);
              if (value.trim()) clearError('alias');
            }}
            placeholder="Nombre / alias (ej. Visa personal)"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: errors.alias ? theme.danger : theme.border }]}
          />
          {errors.alias ? <Text style={[styles.fieldError, { color: theme.danger }]}>{errors.alias}</Text> : null}

          <View style={styles.segmentRow}>
            {(['credit', 'debit'] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => selectType(item)}
                style={[
                  styles.segment,
                  { borderColor: theme.border },
                  item === cardType && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                ]}
              >
                <Text style={[styles.segmentText, { color: theme.text }]}>
                  {item === 'credit' ? 'Crédito' : 'Débito'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={last4}
            onChangeText={(value) => {
              const digits = value.replace(/\D/g, '').slice(0, 4);
              setLast4(digits);
              if (digits.length === 4) clearError('last4');
            }}
            placeholder="Últimos 4 dígitos"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            style={[styles.input, { color: theme.text, borderColor: errors.last4 ? theme.danger : theme.border }]}
          />
          {errors.last4 ? <Text style={[styles.fieldError, { color: theme.danger }]}>{errors.last4}</Text> : null}

          <Text style={[styles.pickerTitle, { color: errors.bank ? theme.danger : theme.text }]}>
            {cardType === 'credit' ? 'Banco o cuenta de crédito' : 'Cuenta de donde sale'}
          </Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {cardType === 'credit'
              ? selectedIsCreditAccount
                ? 'La deuda queda en esta cuenta de crédito.'
                : 'Si eliges un banco, al guardar se crea la cuenta donde vive la deuda.'
              : 'Las compras de débito salen de esta cuenta el mismo día.'}
          </Text>
          {bankAccounts.length === 0 ? (
            <Text style={[styles.fieldError, { color: theme.textMuted, marginTop: 0 }]}>
              Crea primero una cuenta en Más, dentro de Cuentas.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              {bankAccounts.map((account) => {
                const selected = account.id === accountId;
                return (
                  <Pressable
                    key={account.id}
                    onPress={() => {
                      setAccountId(account.id);
                      clearError('bank');
                    }}
                    style={[
                      styles.dayChip,
                      { borderColor: errors.bank ? theme.danger : theme.border, paddingHorizontal: 12 },
                      selected && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: selected ? theme.primary : theme.text }]}>{account.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {errors.bank ? <Text style={[styles.fieldError, { color: theme.danger }]}>{errors.bank}</Text> : null}

          {cardType === 'credit' ? (
            <>
              <TextInput
                value={formatAmountInput(limitRaw, currency)}
                onChangeText={(value) => {
                  setLimitRaw(parseAmountInput(value, currency));
                  if (Number(parseAmountInput(value, currency)) > 0) clearError('limit');
                }}
                placeholder={`Cupo (${currency})`}
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                style={[styles.input, { color: theme.text, borderColor: errors.limit ? theme.danger : theme.border }]}
              />
              {errors.limit ? <Text style={[styles.fieldError, { color: theme.danger }]}>{errors.limit}</Text> : null}
              <View style={styles.dayInputs}>
                <TextInput
                  value={statementRaw}
                  onChangeText={(value) => {
                    setStatementRaw(value.replace(/\D/g, '').slice(0, 2));
                    clearError('days');
                  }}
                  placeholder="Día de corte"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[
                    styles.input,
                    styles.dayInput,
                    { color: theme.text, borderColor: errors.days ? theme.danger : theme.border },
                  ]}
                />
                <TextInput
                  value={dueRaw}
                  onChangeText={(value) => {
                    setDueRaw(value.replace(/\D/g, '').slice(0, 2));
                    clearError('days');
                  }}
                  placeholder="Día de pago"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[
                    styles.input,
                    styles.dayInput,
                    { color: theme.text, borderColor: errors.days ? theme.danger : theme.border },
                  ]}
                />
              </View>
              {errors.days ? <Text style={[styles.fieldError, { color: theme.danger }]}>{errors.days}</Text> : null}
            </>
          ) : null}

          <Pressable style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={createCard}>
            <Text style={styles.saveButtonText}>Guardar tarjeta</Text>
          </Pressable>
        </PremiumCard>

        {cards.map((card) => {
          const debt = cardDebt(card, accounts);
          const available = cardAvailable(card, accounts);
          return (
            <Pressable key={card.id} onPress={() => navigation.navigate('CardDetail', { cardId: card.id })}>
              <PremiumCard style={{ backgroundColor: `${card.color}18` }}>
                <View style={styles.header}>
                  <Text style={[styles.alias, { color: theme.text }]}>{card.alias}</Text>
                  <Text style={[styles.type, { color: theme.textMuted }]}>
                    {card.cardType === 'credit' ? 'CRÉDITO' : 'DÉBITO'}
                  </Text>
                </View>
                <Text style={[styles.bank, { color: theme.textMuted }]}>
                  {card.bank} · **** {card.last4}
                </Text>
                {card.cardType === 'credit' ? (
                  <Text style={[styles.metaLine, { color: theme.text }]}>
                    Deuda {formatMoney(debt, currency)}
                    {available != null ? ` · Disponible ${formatMoney(available, currency)}` : ''}
                  </Text>
                ) : (
                  <Text style={[styles.metaLine, { color: theme.textMuted }]}>Toca para ver los movimientos</Text>
                )}
              </PremiumCard>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  formTitle: { fontWeight: '700', fontSize: 16, marginBottom: 10 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  fieldError: { fontSize: 12, fontWeight: '600', marginTop: -4, marginBottom: 10 },
  hint: { fontSize: 12, marginBottom: 8, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  segment: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontWeight: '600' },
  pickerTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4, marginTop: 4 },
  dayRow: { gap: 8, marginBottom: 8 },
  dayChip: {
    borderWidth: 1,
    borderRadius: 999,
    minWidth: 34,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  dayText: { fontWeight: '600' },
  dayInputs: { flexDirection: 'row', gap: 8 },
  dayInput: { flex: 1, marginBottom: 10 },
  saveButton: { borderRadius: 12, alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alias: { fontSize: 18, fontWeight: '800' },
  type: { fontSize: 12, fontWeight: '700' },
  bank: { marginTop: 4, fontSize: 13 },
  metaLine: { marginTop: 10, fontSize: 14, fontWeight: '700' },
});
