import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, formatShortDate } from '../../core/utils/format';
import { useFinanceStore } from '../../store/useFinanceStore';

const mockMessages = [
  'BBVA: Compra aprobada por $321.90 en UBER EATS tarjeta **4421 2026-05-04 09:31',
  'NU: Se realizo un cargo de $28.50 en SPOTIFY con terminacion 4421 2026-05-03 11:00',
  'SANTANDER cargo por 59.90 en GASOLINA tarjeta 8844 2026-05-02 08:15',
];

export function SmsInboxScreen() {
  const { theme } = useAppTheme();
  const detections = useFinanceStore((state) => state.smsDetections);
  const currency = useFinanceStore((state) => state.settings.currency);
  const processSmsBatch = useFinanceStore((state) => state.processSmsBatch);
  const acceptSms = useFinanceStore((state) => state.acceptSms);
  const discardSms = useFinanceStore((state) => state.discardSms);
  const cards = useFinanceStore((state) => state.cards);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionTitle title="Detección de SMS" subtitle="Movimientos pendientes de confirmar" />

        <PremiumCard>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            Frontend demo: por seguridad y permisos nativos, aquí simulamos lectura de SMS con mensajes de prueba.
          </Text>
          <Pressable style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={() => processSmsBatch(mockMessages)}>
            <Text style={styles.primaryButtonText}>Procesar SMS de ejemplo</Text>
          </Pressable>
        </PremiumCard>

        {detections
          .filter((item) => item.status === 'pending')
          .map((item) => {
            const linkedCard = item.cardId ? cards.find((card) => card.id === item.cardId) : undefined;
            return (
              <PremiumCard key={item.id}>
                <Text style={[styles.merchant, { color: theme.text }]}>{item.merchant}</Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {item.bank ?? 'Banco no detectado'} • {item.categoryGuess ?? 'Sin categoría'}
                </Text>
                <Text style={[styles.amount, { color: theme.danger }]}>
                  {formatMoney(item.amount ?? 0, currency)}
                </Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {item.occurredAt ? formatShortDate(item.occurredAt) : 'Fecha no detectada'}
                </Text>
                {linkedCard ? (
                  <Text style={[styles.meta, { color: theme.success }]}>Asociada a tarjeta {linkedCard.alias}</Text>
                ) : (
                  <Text style={[styles.meta, { color: theme.warning }]}>Sin tarjeta asociada</Text>
                )}
                {item.duplicate ? (
                  <Text style={[styles.meta, { color: theme.warning }]}>Posible duplicado detectado</Text>
                ) : null}
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: theme.success }]}
                    disabled={item.duplicate}
                    onPress={() => acceptSms(item.id)}
                  >
                    <Text style={styles.actionText}>Confirmar</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, { backgroundColor: theme.border }]} onPress={() => discardSms(item.id)}>
                    <Text style={[styles.actionText, { color: theme.text }]}>Descartar</Text>
                  </Pressable>
                </View>
              </PremiumCard>
            );
          })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  note: { marginBottom: 10, fontSize: 13 },
  primaryButton: { borderRadius: 12, alignItems: 'center', paddingVertical: 11 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  merchant: { fontWeight: '700', fontSize: 16 },
  meta: { marginTop: 4, fontSize: 12 },
  amount: { marginTop: 8, fontSize: 20, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
  actionText: { color: '#fff', fontWeight: '700' },
});
