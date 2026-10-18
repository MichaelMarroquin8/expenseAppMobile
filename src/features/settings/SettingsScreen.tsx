import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { findCurrency, formatCurrencyLabel } from '../../core/constants/currencies';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { BANK_SOURCE_PRESETS } from '../../domain/bankSources';
import { AuthForm } from '../auth/AuthScreen';
import { useAuth } from '../auth/AuthProvider';
import { clearNativeRejectionLog } from '../sms/androidNotificationAuto';
import { useCaptureBridge } from '../sms/CaptureBridgeProvider';
import { useFinanceStore } from '../../store/useFinanceStore';

const THEME_MODES = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Oscuro' },
  { id: 'system', label: 'Sistema' },
] as const;

const MODULES = [
  { label: 'Presupuestos', route: 'Budgets' },
  { label: 'Metas de ahorro', route: 'Goals' },
  { label: 'Reportes', route: 'Reports' },
  { label: 'Tarjetas', route: 'Cards' },
  { label: 'Cuentas', route: 'Accounts' },
  { label: 'Categorías', route: 'Categories' },
] as const;

const formatTs = (ms: number | null | undefined): string => {
  if (!ms || ms <= 0) return '—';
  return new Date(ms).toLocaleString('es-CO');
};

export function SettingsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, isConfigured, signOutCurrent } = useAuth();
  const settings = useFinanceStore((state) => state.settings);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const bridge = useCaptureBridge();
  const [accountOpen, setAccountOpen] = useState(false);
  const [detectionOpen, setDetectionOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const toggleBankSource = (sourceId: string) => {
    const enabled = new Set(settings.enabledBankSourceIds);
    if (enabled.has(sourceId)) {
      if (enabled.size <= 1) return;
      enabled.delete(sourceId);
    } else {
      enabled.add(sourceId);
    }
    updateSettings({ enabledBankSourceIds: [...enabled] });
  };

  const selectedCurrency = findCurrency(settings.currency);
  const currencySubtitle = selectedCurrency
    ? formatCurrencyLabel(selectedCurrency)
    : settings.currency;

  const walletLabel = !bridge.notifAvailable
    ? 'No disponible'
    : bridge.walletListening
      ? 'Escuchando'
      : bridge.walletAccess
        ? 'Activar'
        : 'Dar acceso';

  const smsLabel = !bridge.smsAvailable
    ? 'No disponible'
    : bridge.smsEnabled
      ? 'Escuchando'
      : 'Activar';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}
      >
        <SectionTitle title="Más" subtitle="Preferencias y módulos" />

        {user ? (
          <PremiumCard>
            <Text style={[styles.title, { color: theme.text }]}>Cuenta</Text>
            <Text style={[styles.note, { color: theme.textMuted }]}>
              {user.email ?? 'Sesión iniciada'}
            </Text>
            <Pressable
              android_ripple={null}
              style={[styles.textAction, { marginTop: 8 }]}
              onPress={() => signOutCurrent()}
            >
              <Text style={[styles.textActionLabel, { color: theme.warning }]}>Cerrar sesión</Text>
            </Pressable>
          </PremiumCard>
        ) : (
          <PremiumCard>
            <Pressable
              android_ripple={null}
              style={styles.disclosureHeader}
              onPress={() => setAccountOpen((open) => !open)}
            >
              <View style={styles.navText}>
                <Text style={[styles.disclosureLabel, { color: theme.text }]}>Iniciar sesión</Text>
                {accountOpen ? null : (
                  <Text style={[styles.note, { color: theme.textMuted }]}>
                    Entra para sincronizar tus datos en la nube.
                  </Text>
                )}
              </View>
              <Ionicons
                name={accountOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.textMuted}
              />
            </Pressable>
            {accountOpen ? (
              isConfigured ? (
                <AuthForm />
              ) : (
                <Text style={[styles.note, { color: theme.textMuted }]}>
                  El inicio de sesión no está disponible en esta compilación.
                </Text>
              )
            ) : null}
          </PremiumCard>
        )}

        <PremiumCard>
          <Text style={[styles.title, { color: theme.text }]}>Tema</Text>
          <View style={styles.row}>
            {THEME_MODES.map((mode) => {
              const active = settings.colorScheme === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  android_ripple={null}
                  onPress={() => updateSettings({ colorScheme: mode.id })}
                  style={[
                    styles.chip,
                    { borderColor: theme.border },
                    active && {
                      borderColor: theme.primary,
                      backgroundColor: `${theme.primary}20`,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? theme.primary : theme.text }]}>
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </PremiumCard>

        <PremiumCard style={styles.flushCard}>
          <Pressable
            android_ripple={null}
            style={styles.navRow}
            onPress={() => navigation.navigate('CurrencySelect')}
          >
            <View style={styles.navText}>
              <Text style={[styles.title, { color: theme.text }]}>Moneda</Text>
              <Text style={[styles.note, { color: theme.textMuted }]} numberOfLines={1}>
                {currencySubtitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.navRow}>
            <View style={styles.navText}>
              <Text style={[styles.title, { color: theme.text }]}>Recordatorios</Text>
              <Text style={[styles.note, { color: theme.textMuted }]}>Avisos locales de la app</Text>
            </View>
            <Switch
              value={settings.remindersEnabled}
              onValueChange={(value) => updateSettings({ remindersEnabled: value })}
            />
          </View>
        </PremiumCard>

        <PremiumCard>
          <Pressable
            android_ripple={null}
            style={styles.disclosureHeader}
            onPress={() => setDetectionOpen((open) => !open)}
          >
            <View style={styles.navText}>
              <Text style={[styles.disclosureLabel, { color: theme.text }]}>Detección automática</Text>
              {detectionOpen ? null : (
                <Text style={[styles.note, { color: theme.textMuted }]}>
                  Wallet: {walletLabel} · SMS: {smsLabel}
                </Text>
              )}
            </View>
            <Ionicons
              name={detectionOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textMuted}
            />
          </Pressable>
          {detectionOpen ? (
          <>
          <Text style={[styles.note, { color: theme.textMuted, marginBottom: 10 }]}>
            Elige los bancos. El permiso se concede aquí; los gastos llegan a Pendientes para confirmarlos.
          </Text>
          <View style={styles.row}>
            {BANK_SOURCE_PRESETS.map((preset) => {
              const active = settings.enabledBankSourceIds.includes(preset.id);
              return (
                <Pressable
                  key={preset.id}
                  android_ripple={null}
                  onPress={() => toggleBankSource(preset.id)}
                  style={[
                    styles.chip,
                    { borderColor: theme.border },
                    active && {
                      borderColor: theme.primary,
                      backgroundColor: `${theme.primary}20`,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? theme.primary : theme.text }]}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

          <View style={styles.captureRow}>
            <View style={styles.navText}>
              <Text style={[styles.title, { color: theme.text }]}>Google Wallet</Text>
              <Text style={[styles.note, { color: theme.textMuted }]}>
                Compras de la billetera, pendientes de tu confirmación.
              </Text>
              {bridge.walletLastSync ? (
                <Text style={[styles.note, { color: theme.textMuted }]}>
                  Última lectura {bridge.walletLastSync}
                </Text>
              ) : null}
            </View>
            <Pressable
              android_ripple={null}
              disabled={!bridge.notifAvailable || bridge.walletListening}
              onPress={() => void bridge.enableWalletAuto()}
              style={[
                styles.pill,
                {
                  backgroundColor: bridge.walletListening ? `${theme.success}22` : theme.primary,
                },
                !bridge.notifAvailable && { backgroundColor: theme.border },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: bridge.walletListening ? theme.success : theme.surface },
                  !bridge.notifAvailable && { color: theme.textMuted },
                ]}
              >
                {walletLabel}
              </Text>
            </Pressable>
          </View>
          {bridge.notifAvailable ? (
            <Pressable
              android_ripple={null}
              disabled={bridge.walletSyncing}
              onPress={() => void bridge.runWalletSync()}
              style={styles.textAction}
            >
              <Text style={[styles.textActionLabel, { color: theme.primary }]}>
                {bridge.walletSyncing ? 'Sincronizando…' : 'Sincronizar notificaciones'}
              </Text>
            </Pressable>
          ) : null}
          {bridge.walletError ? (
            <Text style={[styles.note, { color: theme.warning }]}>{bridge.walletError}</Text>
          ) : null}

          <View style={[styles.cardDivider, { backgroundColor: theme.border, marginTop: 12 }]} />

          <View style={styles.captureRow}>
            <View style={styles.navText}>
              <Text style={[styles.title, { color: theme.text }]}>SMS bancario</Text>
              <Text style={[styles.note, { color: theme.textMuted }]}>
                Respaldo cuando el pago no pasa por Wallet.
              </Text>
              {bridge.smsLastSync ? (
                <Text style={[styles.note, { color: theme.textMuted }]}>
                  Última lectura {bridge.smsLastSync}
                </Text>
              ) : null}
            </View>
            <Pressable
              android_ripple={null}
              disabled={!bridge.smsAvailable || bridge.smsEnabled}
              onPress={() => void bridge.enableSmsAuto()}
              style={[
                styles.pill,
                { backgroundColor: bridge.smsEnabled ? `${theme.success}22` : theme.primary },
                !bridge.smsAvailable && { backgroundColor: theme.border },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: bridge.smsEnabled ? theme.success : theme.surface },
                  !bridge.smsAvailable && { color: theme.textMuted },
                ]}
              >
                {smsLabel}
              </Text>
            </Pressable>
          </View>
          {bridge.smsAvailable ? (
            <Pressable
              android_ripple={null}
              disabled={bridge.smsSyncing}
              onPress={() => void bridge.runSmsSync()}
              style={styles.textAction}
            >
              <Text style={[styles.textActionLabel, { color: theme.primary }]}>
                {bridge.smsSyncing ? 'Sincronizando…' : 'Sincronizar SMS'}
              </Text>
            </Pressable>
          ) : null}
          {bridge.smsError ? (
            <Text style={[styles.note, { color: theme.warning }]}>{bridge.smsError}</Text>
          ) : null}

          {!bridge.notifAvailable && !bridge.smsAvailable ? (
            <Text style={[styles.note, { color: theme.textMuted, marginTop: 8 }]}>
              En este dispositivo no hay módulo nativo. Puedes pegar un mensaje en Pendientes.
            </Text>
          ) : null}

          <Pressable
            android_ripple={null}
            style={styles.disclosure}
            onPress={() => setDiagnosticsOpen((open) => !open)}
          >
            <Text style={[styles.disclosureLabel, { color: theme.text }]}>Diagnóstico</Text>
            <Ionicons
              name={diagnosticsOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textMuted}
            />
          </Pressable>

          {diagnosticsOpen ? (
            <View>
              <View style={styles.toggleRow}>
                <View style={styles.navText}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Guardar rechazos</Text>
                  <Text style={[styles.note, { color: theme.textMuted }]}>
                    Conserva lo que el filtro descarta.
                  </Text>
                </View>
                <Switch
                  value={settings.bridgeDebugEnabled}
                  onValueChange={(value) => updateSettings({ bridgeDebugEnabled: value })}
                />
              </View>
              <View style={[styles.toggleRow, { marginTop: 12 }]}>
                <View style={styles.navText}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Segundo plano</Text>
                  <Text style={[styles.note, { color: theme.textMuted }]}>
                    Revisa SMS cada 15 min con la app cerrada.
                  </Text>
                </View>
                <Switch
                  value={settings.backgroundSyncEnabled}
                  onValueChange={(value) => updateSettings({ backgroundSyncEnabled: value })}
                />
              </View>
              <Pressable
                android_ripple={null}
                style={styles.textAction}
                onPress={() => void bridge.refreshStatus()}
              >
                <Text style={[styles.textActionLabel, { color: theme.primary }]}>Actualizar estado</Text>
              </Pressable>
              <Text style={[styles.note, { color: theme.textMuted }]}>
                {bridge.notifStatus || bridge.smsStatus
                  ? `Notificaciones: acceso ${bridge.notifStatus?.accessEnabled ? 'sí' : 'no'} · última ${formatTs(bridge.notifStatus?.lastCapturedAt)}\nSMS: lectura ${bridge.smsStatus?.readPermission ? 'sí' : 'no'} · última ${formatTs(bridge.smsStatus?.lastCapturedAt)}`
                  : 'Estado nativo no disponible en este dispositivo.'}
              </Text>
              <Text style={[styles.note, { color: theme.textMuted }]}>
                SMS: {settings.bankSmsShortCodes.join(', ') || 'ninguno'} · Apps:{' '}
                {settings.notificationPackages.length}
              </Text>
              {settings.bridgeDebugEnabled && (bridge.notifStatus?.rejections.length ?? 0) > 0 ? (
                <View style={{ marginTop: 10, gap: 6 }}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>
                    Rechazos recientes ({bridge.notifStatus!.rejections.length})
                  </Text>
                  {bridge.notifStatus!.rejections.slice(0, 5).map((rej, index) => (
                    <Text key={`${rej.at}-${index}`} style={[styles.note, { color: theme.textMuted }]}>
                      score {rej.score ?? 0} · {rej.packageName ?? '?'} ·{' '}
                      {(rej.reasons ?? []).join(', ') || 'sin señales'}
                    </Text>
                  ))}
                  <Pressable
                    android_ripple={null}
                    onPress={() => {
                      void clearNativeRejectionLog().then(() => bridge.refreshStatus());
                    }}
                  >
                    <Text style={[styles.textActionLabel, { color: theme.warning }]}>Limpiar rechazos</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
          </>
          ) : null}
        </PremiumCard>

        <PremiumCard style={styles.flushCard}>
          <Text style={[styles.title, styles.moduleHeading, { color: theme.text }]}>Módulos</Text>
          {MODULES.map((item, index) => (
            <Pressable
              key={item.route}
              android_ripple={null}
              style={[
                styles.navRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              ]}
              onPress={() => navigation.navigate(item.route)}
            >
              <Text style={[styles.rowTitle, { color: theme.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          ))}
        </PremiumCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  flushCard: { padding: 0 },
  title: { fontWeight: '700', fontSize: 16 },
  rowTitle: { fontWeight: '600', fontSize: 15 },
  moduleHeading: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontWeight: '600' },
  note: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  navText: { flex: 1 },
  divider: { height: 1, marginHorizontal: 16 },
  cardDivider: { height: 1, marginTop: 14 },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  pillText: { fontWeight: '700', fontSize: 13 },
  textAction: { marginTop: 8, alignSelf: 'flex-start' },
  textActionLabel: { fontWeight: '700', fontSize: 14 },
  disclosureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 4,
  },
  disclosureLabel: { fontWeight: '600', fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
