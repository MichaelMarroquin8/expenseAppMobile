import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { findCurrency, formatCurrencyLabel } from '../../core/constants/currencies';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { useAuth } from '../auth/AuthProvider';
import { useFinanceStore } from '../../store/useFinanceStore';

export function SettingsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, isConfigured, signOutCurrent } = useAuth();
  const settings = useFinanceStore((state) => state.settings);
  const updateSettings = useFinanceStore((state) => state.updateSettings);

  const selectedCurrency = findCurrency(settings.currency);
  const currencySubtitle = selectedCurrency
    ? formatCurrencyLabel(selectedCurrency)
    : settings.currency;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}
      >
        <SectionTitle title="Más" subtitle="Preferencias, módulos y cuenta" />

        {isConfigured ? (
          <PremiumCard>
            <Text style={[styles.title, { color: theme.text }]}>Cuenta</Text>
            <Text style={[styles.note, { color: theme.textMuted }]}>
              {user?.email ?? 'Usuario autenticado'}
            </Text>
            <Pressable
              android_ripple={null}
              style={[styles.linkButton, { borderColor: theme.border, marginTop: 8 }]}
              onPress={() => signOutCurrent()}
            >
              <Text style={[styles.linkText, { color: theme.warning }]}>Cerrar sesión</Text>
            </Pressable>
          </PremiumCard>
        ) : null}

        <PremiumCard>
          <Text style={[styles.title, { color: theme.text }]}>Tema</Text>
          <View style={styles.row}>
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <Pressable
                key={mode}
                android_ripple={null}
                onPress={() => updateSettings({ colorScheme: mode })}
                style={[
                  styles.chip,
                  { borderColor: theme.border },
                  settings.colorScheme === mode && {
                    borderColor: theme.primary,
                    backgroundColor: `${theme.primary}20`,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: theme.text }]}>{mode}</Text>
              </Pressable>
            ))}
          </View>
        </PremiumCard>

        <PremiumCard>
          <Text style={[styles.title, { color: theme.text }]}>Configuración</Text>
          <Text style={[styles.note, { color: theme.textMuted, marginBottom: 10 }]}>
            Preferencias generales de la app
          </Text>
          <Pressable
            android_ripple={null}
            style={[styles.selectRow, { borderColor: theme.border }]}
            onPress={() => navigation.navigate('CurrencySelect')}
          >
            <View style={styles.selectTextCol}>
              <Text style={[styles.selectLabel, { color: theme.text }]}>Moneda predeterminada</Text>
              <Text style={[styles.selectValue, { color: theme.textMuted }]} numberOfLines={1}>
                {currencySubtitle} · {settings.currency}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </Pressable>
        </PremiumCard>

        <PremiumCard>
          <View style={styles.toggleRow}>
            <Text style={[styles.title, { color: theme.text }]}>Recordatorios</Text>
            <Switch
              value={settings.remindersEnabled}
              onValueChange={(value) => updateSettings({ remindersEnabled: value })}
            />
          </View>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            Preparado para notificaciones locales y futuras reglas inteligentes.
          </Text>
        </PremiumCard>

        <PremiumCard>
          <Text style={[styles.title, { color: theme.text }]}>Módulos financieros</Text>
          <View style={styles.row}>
            <Pressable
              android_ripple={null}
              style={[styles.linkButton, { borderColor: theme.border }]}
              onPress={() => navigation.navigate('Budgets')}
            >
              <Text style={[styles.linkText, { color: theme.text }]}>Presupuestos</Text>
            </Pressable>
            <Pressable
              android_ripple={null}
              style={[styles.linkButton, { borderColor: theme.border }]}
              onPress={() => navigation.navigate('Goals')}
            >
              <Text style={[styles.linkText, { color: theme.text }]}>Metas de ahorro</Text>
            </Pressable>
            <Pressable
              android_ripple={null}
              style={[styles.linkButton, { borderColor: theme.border }]}
              onPress={() => navigation.navigate('Reports')}
            >
              <Text style={[styles.linkText, { color: theme.text }]}>Reportes</Text>
            </Pressable>
            <Pressable
              android_ripple={null}
              style={[styles.linkButton, { borderColor: theme.border }]}
              onPress={() => navigation.navigate('Cards')}
            >
              <Text style={[styles.linkText, { color: theme.text }]}>Tarjetas</Text>
            </Pressable>
            <Pressable
              android_ripple={null}
              style={[styles.linkButton, { borderColor: theme.border }]}
              onPress={() => navigation.navigate('Accounts')}
            >
              <Text style={[styles.linkText, { color: theme.text }]}>Cuentas</Text>
            </Pressable>
            <Pressable
              android_ripple={null}
              style={[styles.linkButton, { borderColor: theme.border }]}
              onPress={() => navigation.navigate('Categories')}
            >
              <Text style={[styles.linkText, { color: theme.text }]}>Categorías</Text>
            </Pressable>
          </View>
        </PremiumCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontWeight: '600', textTransform: 'capitalize' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { marginTop: 8, fontSize: 12 },
  linkButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  linkText: { fontWeight: '600' },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  selectTextCol: { flex: 1, gap: 4 },
  selectLabel: { fontWeight: '700', fontSize: 15 },
  selectValue: { fontSize: 13 },
});
