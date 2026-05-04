import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney } from '../../core/utils/format';
import { useFinanceStore } from '../../store/useFinanceStore';

export function GoalsScreen() {
  const { theme } = useAppTheme();
  const goals = useFinanceStore((state) => state.goals);
  const currency = useFinanceStore((state) => state.settings.currency);
  const addContribution = useFinanceStore((state) => state.addGoalContribution);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionTitle title="Metas de ahorro" subtitle="Aportes manuales o automáticos" />
        {goals.map((goal) => {
          const progress = Math.min(100, (goal.currentAmount / Math.max(goal.targetAmount, 1)) * 100);
          return (
            <PremiumCard key={goal.id}>
              <Text style={[styles.title, { color: theme.text }]}>{goal.title}</Text>
              <Text style={[styles.value, { color: theme.textMuted }]}>
                {formatMoney(goal.currentAmount, currency)} de {formatMoney(goal.targetAmount, currency)}
              </Text>
              <View style={[styles.track, { backgroundColor: theme.border }]}>
                <View style={[styles.fill, { width: `${Math.max(3, progress)}%`, backgroundColor: theme.primary }]} />
              </View>
              <View style={styles.actions}>
                {[25, 50, 100].map((amount) => (
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
            </PremiumCard>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontWeight: '700', fontSize: 16 },
  value: { marginTop: 6, marginBottom: 10 },
  track: { borderRadius: 999, height: 10, overflow: 'hidden' },
  fill: { height: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  chipText: { fontWeight: '600', fontSize: 12 },
  autoText: { marginTop: 10, fontSize: 12, fontWeight: '600' },
});
