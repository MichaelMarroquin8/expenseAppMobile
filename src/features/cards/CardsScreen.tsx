import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { useFinanceStore } from '../../store/useFinanceStore';

export function CardsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const cards = useFinanceStore((state) => state.cards);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}
      >
        <SectionTitle title="Tarjetas y métodos de pago" subtitle="Solo se guardan últimos 4 dígitos" />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alias: { fontSize: 18, fontWeight: '800' },
  type: { fontSize: 12, fontWeight: '700' },
  bank: { marginTop: 4, fontSize: 13 },
  last4: { marginTop: 12, letterSpacing: 1, fontWeight: '700', fontSize: 17 },
  meta: { marginTop: 10, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaText: { fontSize: 12 },
});
