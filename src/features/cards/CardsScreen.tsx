import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatAmountInput, parseAmountInput } from '../../core/utils/format';
import { useFinanceStore } from '../../store/useFinanceStore';

const palette = ['#2563EB', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'];
const days = Array.from({ length: 31 }, (_, i) => i + 1);

export function CardsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const currency = useFinanceStore((state) => state.settings.currency);
  const cards = useFinanceStore((state) => state.cards);
  const upsertCard = useFinanceStore((state) => state.upsertCard);
  const [alias, setAlias] = useState('');
  const [bank, setBank] = useState('');
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [last4, setLast4] = useState('');
  const [limitRaw, setLimitRaw] = useState('');
  const [statementDay, setStatementDay] = useState<number>(15);
  const [dueDay, setDueDay] = useState<number>(30);

  const createCard = () => {
    const normalizedAlias = alias.trim();
    const normalizedBank = bank.trim();
    const normalizedLast4 = last4.replace(/\D/g, '').slice(-4);
    const limit = Number(limitRaw || 0);
    const statement = statementDay;
    const due = dueDay;
    if (!normalizedAlias || !normalizedBank || normalizedLast4.length !== 4) return;
    upsertCard({
      id: `card_${Date.now()}`,
      alias: normalizedAlias,
      bank: normalizedBank,
      cardType,
      last4: normalizedLast4,
      color: palette[Math.floor(Math.random() * palette.length)],
      icon: cardType === 'credit' ? 'card-outline' : 'wallet-outline',
      limit: limit > 0 ? limit : undefined,
      statementDay: statement >= 1 && statement <= 31 ? statement : undefined,
      dueDay: due >= 1 && due <= 31 ? due : undefined,
    });
    setAlias('');
    setBank('');
    setLast4('');
    setLimitRaw('');
    setStatementDay(15);
    setDueDay(30);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}
      >
        <SectionTitle title="Tarjetas y métodos de pago" subtitle="Solo se guardan últimos 4 dígitos" />

        <PremiumCard>
          <Text style={[styles.formTitle, { color: theme.text }]}>Agregar tarjeta</Text>
          <TextInput
            value={alias}
            onChangeText={setAlias}
            placeholder="Nombre / alias (ej. Visa personal)"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            value={bank}
            onChangeText={setBank}
            placeholder="Banco (ej. Bancolombia)"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <View style={styles.segmentRow}>
            {(['credit', 'debit'] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => setCardType(item)}
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
            onChangeText={(value) => setLast4(value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Últimos 4 dígitos"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            value={formatAmountInput(limitRaw, currency)}
            onChangeText={(value) => setLimitRaw(parseAmountInput(value, currency))}
            placeholder={`Monto / cupo (${currency})`}
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <Text style={[styles.pickerTitle, { color: theme.text }]}>Día de corte</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((day) => (
              <Pressable
                key={`statement-${day}`}
                onPress={() => setStatementDay(day)}
                style={[
                  styles.dayChip,
                  { borderColor: theme.border },
                  statementDay === day && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                ]}
              >
                <Text style={[styles.dayText, { color: theme.text }]}>{day}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[styles.pickerTitle, { color: theme.text }]}>Día de pago</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((day) => (
              <Pressable
                key={`due-${day}`}
                onPress={() => setDueDay(day)}
                style={[
                  styles.dayChip,
                  { borderColor: theme.border },
                  dueDay === day && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                ]}
              >
                <Text style={[styles.dayText, { color: theme.text }]}>{day}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={createCard}>
            <Text style={styles.saveButtonText}>Guardar tarjeta</Text>
          </Pressable>
        </PremiumCard>

        {cards.map((card) => (
          <PremiumCard key={card.id} style={{ backgroundColor: `${card.color}18` }}>
            <View style={styles.header}>
              <Text style={[styles.alias, { color: theme.text }]}>{card.alias}</Text>
              <Text style={[styles.type, { color: theme.textMuted }]}>{card.cardType.toUpperCase()}</Text>
            </View>
            <Text style={[styles.bank, { color: theme.textMuted }]}>{card.bank}</Text>
            <Text style={[styles.last4, { color: theme.text }]}>**** **** **** {card.last4}</Text>
            <View style={styles.meta}>
              {card.limit ? <Text style={[styles.metaText, { color: theme.textMuted }]}>Cupo: {card.limit}</Text> : null}
              {card.statementDay ? (
                <Text style={[styles.metaText, { color: theme.textMuted }]}>Corte: día {card.statementDay}</Text>
              ) : null}
              {card.dueDay ? <Text style={[styles.metaText, { color: theme.textMuted }]}>Pago: día {card.dueDay}</Text> : null}
            </View>
          </PremiumCard>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  formTitle: { fontWeight: '700', fontSize: 16, marginBottom: 10 },
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
  rowInputs: { flexDirection: 'row', gap: 8 },
  pickerTitle: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
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
  saveButton: { borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alias: { fontSize: 18, fontWeight: '800' },
  type: { fontSize: 12, fontWeight: '700' },
  bank: { marginTop: 4, fontSize: 13 },
  last4: { marginTop: 12, letterSpacing: 1, fontWeight: '700', fontSize: 17 },
  meta: { marginTop: 10, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaText: { fontSize: 12 },
});
