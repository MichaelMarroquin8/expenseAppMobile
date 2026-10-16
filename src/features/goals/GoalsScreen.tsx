import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatAmountInput, formatMoney, getCurrencyFractionDigits, parseAmountInput } from '../../core/utils/format';
import { useFinanceStore } from '../../store/useFinanceStore';

export function GoalsScreen() {
  const { theme, activeMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const goals = useFinanceStore((state) => state.goals);
  const currency = useFinanceStore((state) => state.settings.currency);
  const upsertGoal = useFinanceStore((state) => state.upsertGoal);
  const deleteGoal = useFinanceStore((state) => state.deleteGoal);
  const addContribution = useFinanceStore((state) => state.addGoalContribution);

  const [title, setTitle] = useState('');
  const [targetRaw, setTargetRaw] = useState('');
  const [autoRaw, setAutoRaw] = useState('');

  const quickAmounts = getCurrencyFractionDigits(currency) === 0 ? [20000, 50000, 100000] : [25, 50, 100];

  const onCreateGoal = () => {
    const normalizedTitle = title.trim();
    const targetAmount = Number(targetRaw);
    const autoContribution = Number(autoRaw || 0);
    if (!normalizedTitle || Number.isNaN(targetAmount) || targetAmount <= 0) return;

    upsertGoal({
      id: `goal_${Date.now()}`,
      title: normalizedTitle,
      targetAmount,
      currentAmount: 0,
      autoContribution: autoContribution > 0 ? autoContribution : undefined,
    });
    setTitle('');
    setTargetRaw('');
    setAutoRaw('');
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}
      >
        <SectionTitle title="Metas de ahorro" subtitle="Crea objetivos y registra aportes manuales o automáticos" />

        <PremiumCard>
          <Text style={[styles.formTitle, { color: theme.text }]}>Nueva meta de ahorro</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Nombre de la meta (ej. Fondo de emergencia, Viaje)"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            value={formatAmountInput(targetRaw, currency)}
            onChangeText={(value) => setTargetRaw(parseAmountInput(value, currency))}
            placeholder={`Monto objetivo (${currency})`}
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            keyboardAppearance={activeMode === 'dark' ? 'dark' : 'light'}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            value={formatAmountInput(autoRaw, currency)}
            onChangeText={(value) => setAutoRaw(parseAmountInput(value, currency))}
            placeholder={`Aporte mensual planeado opcional (${currency})`}
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            keyboardAppearance={activeMode === 'dark' ? 'dark' : 'light'}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <Pressable style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={onCreateGoal}>
            <Text style={styles.saveButtonText}>Crear meta</Text>
          </Pressable>
        </PremiumCard>

        {goals.length === 0 ? (
          <PremiumCard>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Aún no tienes metas de ahorro activas. Crea tu primera meta arriba para visualizar tu progreso.
            </Text>
          </PremiumCard>
        ) : null}

        {goals.map((goal) => {
          const progress = Math.min(100, (goal.currentAmount / Math.max(goal.targetAmount, 1)) * 100);
          return (
            <PremiumCard key={goal.id}>
              <View style={styles.goalHeader}>
                <Text style={[styles.title, { color: theme.text }]}>{goal.title}</Text>
                <Text style={[styles.percent, { color: theme.primary }]}>{progress.toFixed(0)}%</Text>
              </View>
              <Text style={[styles.value, { color: theme.textMuted }]}>
                {formatMoney(goal.currentAmount, currency)} de {formatMoney(goal.targetAmount, currency)}
              </Text>
              <View style={[styles.track, { backgroundColor: theme.border }]}>
                <View style={[styles.fill, { width: `${Math.max(3, progress)}%`, backgroundColor: theme.primary }]} />
              </View>
              <View style={styles.actions}>
                {quickAmounts.map((amount) => (
                  <Pressable
                    key={amount}
                    style={[styles.chip, { borderColor: theme.border }]}
                    onPress={() => addContribution(goal.id, amount)}
                  >
                    <Text style={[styles.chipText, { color: theme.text }]}>+{formatMoney(amount, currency)}</Text>
                  </Pressable>
                ))}
              </View>
              {goal.autoContribution ? (
                <Text style={[styles.autoText, { color: theme.success }]}>
                  Aporte automático: {formatMoney(goal.autoContribution, currency)} / mes
                </Text>
              ) : null}
              <Pressable onPress={() => deleteGoal(goal.id)} style={{ marginTop: 10 }}>
                <Text style={[styles.deleteText, { color: theme.warning }]}>Eliminar meta</Text>
              </Pressable>
            </PremiumCard>
          );
        })}
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
  saveButton: {
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', fontSize: 16 },
  percent: { fontWeight: '700', fontSize: 13 },
  value: { marginTop: 6, marginBottom: 10 },
  track: { borderRadius: 999, height: 10, overflow: 'hidden' },
  fill: { height: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  chipText: { fontWeight: '600', fontSize: 12 },
  autoText: { marginTop: 10, fontSize: 12, fontWeight: '600' },
  deleteText: { fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 13 },
});
