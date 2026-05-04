import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { useFinanceStore } from '../../store/useFinanceStore';

export function OnboardingScreen() {
  const { theme } = useAppTheme();
  const finishOnboarding = useFinanceStore((state) => state.finishOnboarding);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[styles.badge, { color: theme.primary, borderColor: theme.primary }]}>ExpenseApp Pro</Text>
        <Text style={[styles.title, { color: theme.text }]}>Tu copiloto financiero personal</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Detecta gastos por SMS, controla presupuestos y construye metas con una experiencia premium tipo fintech.
        </Text>

        <View style={styles.featureList}>
          {['Dashboard inteligente', 'Transacciones y tarjetas', 'Reportes avanzados', 'Metas con progreso'].map(
            (item) => (
              <Text key={item} style={[styles.featureItem, { color: theme.text }]}>
                • {item}
              </Text>
            ),
          )}
        </View>

        <Pressable
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => finishOnboarding()}
        >
          <Text style={styles.buttonText}>Comenzar</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontWeight: '600',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
  },
  featureList: {
    marginTop: 24,
    gap: 10,
  },
  featureItem: {
    fontSize: 15,
  },
  button: {
    marginTop: 30,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
