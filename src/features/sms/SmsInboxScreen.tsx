import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PremiumCard, Screen, SectionTitle } from "../../components/ui";
import { useAppTheme } from "../../core/theme/ThemeProvider";
import {
  formatAmountInput,
  formatMoney,
  formatShortDate,
  parseAmountInput,
} from "../../core/utils/format";
import { useFinanceStore } from "../../store/useFinanceStore";
import { SmsRawInput } from "../../domain/smsParser";
import {
  fetchRecentBancolombiaSms,
  isAndroidSmsAutoAvailable,
  requestAndroidSmsPermissions,
} from "./androidSmsAuto";
import {
  fetchRecentWalletNotifications,
  isAndroidNotificationAutoAvailable,
  isNotificationAccessEnabled,
  openNotificationAccessSettings,
  subscribeWalletNotifications,
} from "./androidNotificationAuto";

const mockMessages: SmsRawInput[] = [
  {
    channel: "sms",
    sender: "85540",
    message:
      "Bancolombia informa compra por $321.900 en UBER EATS tarjeta terminacion 4421 2026-05-04 09:31",
  },
];

export function SmsInboxScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const detections = useFinanceStore((state) => state.smsDetections);
  const currency = useFinanceStore((state) => state.settings.currency);
  const processSmsBatch = useFinanceStore((state) => state.processSmsBatch);
  const processNotificationBatch = useFinanceStore(
    (state) => state.processNotificationBatch,
  );
  const updateSmsDetection = useFinanceStore(
    (state) => state.updateSmsDetection,
  );
  const acceptSms = useFinanceStore((state) => state.acceptSms);
  const discardSms = useFinanceStore((state) => state.discardSms);
  const cards = useFinanceStore((state) => state.cards);

  const [editingDetectionId, setEditingDetectionId] = useState<string | null>(
    null,
  );
  const [editingAmountRaw, setEditingAmountRaw] = useState("");

  const [manualSender, setManualSender] = useState("85540");
  const [manualMessage, setManualMessage] = useState("");
  const [manualChannel, setManualChannel] = useState<"sms" | "email">("sms");

  const [walletAccess, setWalletAccess] = useState(false);
  const [walletListening, setWalletListening] = useState(false);
  const [walletSyncing, setWalletSyncing] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletLastSync, setWalletLastSync] = useState<string | null>(null);

  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsSyncing, setSmsSyncing] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsLastSync, setSmsLastSync] = useState<string | null>(null);

  const notifAvailable = useMemo(() => isAndroidNotificationAutoAvailable(), []);
  const smsAvailable = useMemo(() => isAndroidSmsAutoAvailable(), []);

  const refreshWalletAccess = useCallback(async () => {
    if (!notifAvailable) {
      setWalletAccess(false);
      return;
    }
    const enabled = await isNotificationAccessEnabled();
    setWalletAccess(enabled);
  }, [notifAvailable]);

  const runWalletSync = useCallback(async () => {
    if (!notifAvailable) return;
    setWalletSyncing(true);
    setWalletError(null);
    try {
      const batch = await fetchRecentWalletNotifications({ limit: 40 });
      if (batch.length > 0) processNotificationBatch(batch);
      setWalletLastSync(new Date().toLocaleTimeString("es-CO"));
    } catch {
      setWalletError("No se pudieron leer notificaciones. Revisa el permiso y el build.");
    } finally {
      setWalletSyncing(false);
    }
  }, [notifAvailable, processNotificationBatch]);

  const enableWalletAuto = async () => {
    setWalletError(null);
    if (!notifAvailable) {
      setWalletError(
        "Auto Wallet requiere un build Android nativo (EAS preview/development).",
      );
      return;
    }
    const enabled = await isNotificationAccessEnabled();
    if (!enabled) {
      setWalletError(
        "Activa ExpenseApp en Acceso a notificaciones y vuelve a esta pantalla.",
      );
      await openNotificationAccessSettings();
      return;
    }
    setWalletAccess(true);
    setWalletListening(true);
    await runWalletSync();
  };

  const runSmsSync = async () => {
    if (!smsAvailable) return;
    setSmsSyncing(true);
    setSmsError(null);
    try {
      const batch = await fetchRecentBancolombiaSms({
        shortCodes: ["85540", "85784"],
        limit: 20,
      });
      if (batch.length > 0) processSmsBatch(batch);
      setSmsLastSync(new Date().toLocaleTimeString("es-CO"));
    } catch {
      setSmsError("No fue posible leer SMS. Revisa permisos y build Android.");
    } finally {
      setSmsSyncing(false);
    }
  };

  const enableSmsAuto = async () => {
    setSmsError(null);
    if (!smsAvailable) {
      setSmsError("Auto SMS requiere Android build con módulo nativo.");
      return;
    }
    const granted = await requestAndroidSmsPermissions();
    if (!granted) {
      setSmsError("Permisos de SMS denegados.");
      return;
    }
    setSmsEnabled(true);
    await runSmsSync();
  };

  const processManualInput = () => {
    const normalized = manualMessage.trim();
    if (!normalized) return;
    processSmsBatch([
      {
        sender: manualSender.trim() || undefined,
        message: normalized,
        channel: manualChannel,
      },
    ]);
    setManualMessage("");
  };

  useEffect(() => {
    refreshWalletAccess();
  }, [refreshWalletAccess]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshWalletAccess();
    });
    return () => sub.remove();
  }, [refreshWalletAccess]);

  useEffect(() => {
    if (!walletListening || !notifAvailable || !walletAccess) return;
    const unsubscribe = subscribeWalletNotifications((item) => {
      processNotificationBatch([item]);
      setWalletLastSync(new Date().toLocaleTimeString("es-CO"));
    });
    const timer = setInterval(() => {
      runWalletSync();
    }, 20000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [
    walletListening,
    notifAvailable,
    walletAccess,
    processNotificationBatch,
    runWalletSync,
  ]);

  useEffect(() => {
    if (!smsEnabled || !smsAvailable) return;
    const timer = setInterval(() => {
      runSmsSync();
    }, 30000);
    return () => clearInterval(timer);
  }, [smsEnabled, smsAvailable]);

  const pending = detections.filter((item) => item.status === "pending");

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom + 170, 190) },
        ]}
      >
        <SectionTitle
          title="Pendientes"
          subtitle="Aprueba o descarta gastos detectados automáticamente"
        />

        <PremiumCard>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Google Wallet (recomendado)
          </Text>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            Lee notificaciones de compras (comercio + monto + últimos 4). No se
            registra solo: queda pendiente de tu confirmación. Aplica a tarjetas
            de distintos bancos.
          </Text>
          <Pressable
            style={[
              styles.primaryButton,
              {
                backgroundColor: walletListening ? theme.success : theme.primary,
              },
            ]}
            onPress={enableWalletAuto}
          >
            <Text style={styles.primaryButtonText}>
              {walletListening
                ? "Auto Wallet activo"
                : walletAccess
                  ? "Activar Auto Wallet"
                  : "Conceder acceso a notificaciones"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            onPress={runWalletSync}
            disabled={!notifAvailable || walletSyncing}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
              {walletSyncing ? "Sincronizando..." : "Sincronizar notificaciones"}
            </Text>
          </Pressable>
          {!walletAccess && notifAvailable ? (
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={openNotificationAccessSettings}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                Abrir ajustes de notificaciones
              </Text>
            </Pressable>
          ) : null}
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            Módulo: {notifAvailable ? "Disponible" : "No disponible"} • Acceso:{" "}
            {walletAccess ? "Sí" : "No"}
            {walletLastSync ? ` • Última sync: ${walletLastSync}` : ""}
          </Text>
          {walletError ? (
            <Text style={[styles.meta, { color: theme.warning }]}>{walletError}</Text>
          ) : null}
        </PremiumCard>

        <PremiumCard>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            SMS Bancolombia (opcional)
          </Text>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            Fallback para alertas SMS 85540/85784. Preferimos Wallet cuando
            pagas con Google Wallet.
          </Text>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: smsEnabled ? theme.success : theme.primary },
            ]}
            onPress={enableSmsAuto}
          >
            <Text style={styles.primaryButtonText}>
              {smsEnabled ? "Auto SMS activo" : "Activar Auto SMS"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            onPress={runSmsSync}
            disabled={!smsAvailable || smsSyncing}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
              {smsSyncing ? "Sincronizando..." : "Sincronizar SMS"}
            </Text>
          </Pressable>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            Módulo SMS: {smsAvailable ? "Disponible" : "No disponible"}
            {smsLastSync ? ` • Última sync: ${smsLastSync}` : ""}
          </Text>
          {smsError ? (
            <Text style={[styles.meta, { color: theme.warning }]}>{smsError}</Text>
          ) : null}
        </PremiumCard>

        <PremiumCard>
          <Text style={[styles.manualTitle, { color: theme.text }]}>
            Pegar texto (SMS / correo)
          </Text>
          <View style={styles.channelRow}>
            {(["sms", "email"] as const).map((channel) => (
              <Pressable
                key={channel}
                onPress={() => setManualChannel(channel)}
                style={[
                  styles.channelChip,
                  { borderColor: theme.border },
                  manualChannel === channel && {
                    borderColor: theme.primary,
                    backgroundColor: `${theme.primary}20`,
                  },
                ]}
              >
                <Text style={[styles.channelChipText, { color: theme.text }]}>
                  {channel.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={manualSender}
            onChangeText={setManualSender}
            placeholder={
              manualChannel === "sms"
                ? "Remitente (85540/85784)"
                : "Correo remitente"
            }
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border },
            ]}
          />
          <TextInput
            value={manualMessage}
            onChangeText={setManualMessage}
            placeholder="Pega aquí el contenido..."
            placeholderTextColor={theme.textMuted}
            multiline
            style={[
              styles.input,
              styles.textArea,
              { color: theme.text, borderColor: theme.border },
            ]}
          />
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={processManualInput}
          >
            <Text style={styles.primaryButtonText}>Procesar texto pegado</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            onPress={() => processSmsBatch(mockMessages)}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
              Probar con SMS de ejemplo
            </Text>
          </Pressable>
        </PremiumCard>

        {pending.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            No hay movimientos pendientes. Activa Auto Wallet y paga con una
            tarjeta; aparecerán aquí para confirmar.
          </Text>
        ) : null}

        {pending.map((item) => {
          const linkedCard = item.cardId
            ? cards.find((card) => card.id === item.cardId)
            : undefined;
          return (
            <PremiumCard key={item.id}>
              <Text style={[styles.merchant, { color: theme.text }]}>
                {item.merchant}
              </Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {item.bank ?? "Banco no detectado"} •{" "}
                {item.categoryGuess ?? "Sin categoría"}
              </Text>
              <Text
                style={[
                  styles.meta,
                  {
                    color: item.trustedSource ? theme.success : theme.warning,
                  },
                ]}
              >
                Origen: {item.sender ?? "desconocido"} •{" "}
                {item.channel.toUpperCase()} •{" "}
                {item.trustedSource ? "Confiable" : "No verificado"}
              </Text>
              <View style={styles.amountRow}>
                <Text style={[styles.amount, { color: theme.danger }]}>
                  {formatMoney(item.amount ?? 0, currency)}
                </Text>
                <Pressable
                  style={[styles.editAmountBtn, { borderColor: theme.border }]}
                  onPress={() => {
                    if (editingDetectionId === item.id) {
                      setEditingDetectionId(null);
                      setEditingAmountRaw("");
                    } else {
                      setEditingDetectionId(item.id);
                      setEditingAmountRaw(
                        parseAmountInput(String(item.amount ?? ""), currency),
                      );
                    }
                  }}
                >
                  <Text
                    style={[styles.editAmountBtnText, { color: theme.primary }]}
                  >
                    {editingDetectionId === item.id ? "Cancelar" : "Editar monto"}
                  </Text>
                </Pressable>
              </View>
              {editingDetectionId === item.id ? (
                <View style={styles.editAmountBox}>
                  <TextInput
                    value={formatAmountInput(editingAmountRaw, currency)}
                    onChangeText={(val) =>
                      setEditingAmountRaw(parseAmountInput(val, currency))
                    }
                    placeholder="Nuevo monto"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                    style={[
                      styles.input,
                      styles.editAmountInput,
                      { color: theme.text, borderColor: theme.border },
                    ]}
                  />
                  <Pressable
                    style={[
                      styles.saveAmountBtn,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={() => {
                      const nextAmount = Number(editingAmountRaw);
                      if (!Number.isNaN(nextAmount) && nextAmount > 0) {
                        updateSmsDetection(item.id, { amount: nextAmount });
                      }
                      setEditingDetectionId(null);
                      setEditingAmountRaw("");
                    }}
                  >
                    <Text style={styles.primaryButtonText}>Guardar</Text>
                  </Pressable>
                </View>
              ) : null}
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {item.occurredAt
                  ? formatShortDate(item.occurredAt)
                  : "Fecha no detectada"}
                {item.last4 ? ` • •••• ${item.last4}` : ""}
              </Text>
              {linkedCard ? (
                <Text style={[styles.meta, { color: theme.success }]}>
                  Asociada a tarjeta {linkedCard.alias}
                </Text>
              ) : (
                <Text style={[styles.meta, { color: theme.warning }]}>
                  Sin tarjeta asociada
                  {item.last4
                    ? ` (agrega una con terminación ${item.last4})`
                    : ""}
                </Text>
              )}
              {item.duplicate ? (
                <Text style={[styles.meta, { color: theme.warning }]}>
                  Aviso: ya existe un movimiento similar hoy (puedes confirmarlo
                  si es una compra distinta)
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.success }]}
                  disabled={!item.amount || item.amount <= 0}
                  onPress={() => acceptSms(item.id)}
                >
                  <Text style={styles.actionText}>Confirmar</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.border }]}
                  onPress={() => discardSms(item.id)}
                >
                  <Text style={[styles.actionText, { color: theme.text }]}>
                    Descartar
                  </Text>
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
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  note: { marginBottom: 10, fontSize: 13 },
  manualTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  channelRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  channelChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  channelChipText: { fontWeight: "600", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  primaryButton: {
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 11,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 11,
    marginTop: 8,
  },
  secondaryButtonText: { fontWeight: "700" },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  merchant: { fontWeight: "700", fontSize: 16 },
  meta: { marginTop: 4, fontSize: 12 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  amount: { fontSize: 20, fontWeight: "800" },
  editAmountBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editAmountBtnText: { fontSize: 12, fontWeight: "600" },
  editAmountBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  editAmountInput: { flex: 1, marginBottom: 0 },
  saveAmountBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  actionText: { color: "#fff", fontWeight: "700" },
  empty: { marginTop: 8, marginBottom: 12, fontSize: 13, lineHeight: 18 },
});
