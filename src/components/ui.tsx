import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../core/theme/ThemeProvider';

export function Screen({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: theme.background }]}>
      {children}
    </SafeAreaView>
  );
}

export function PremiumCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { activeMode, theme } = useAppTheme();
  if (activeMode === 'dark') {
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
        {children}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#FFFFFF', '#F8FAFC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: theme.border }, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
