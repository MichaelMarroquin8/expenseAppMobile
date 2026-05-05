import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PremiumCard, Screen, SectionTitle } from "../../components/ui";
import { useAppTheme } from "../../core/theme/ThemeProvider";
import { formatMoney, formatShortDate } from "../../core/utils/format";
import { useFinanceStore } from "../../store/useFinanceStore";
import { SmsRawInput } from "../../domain/smsParser";
import {
  fetchRecentBancolombiaSms,
  isAndroidSmsAutoAvailable,
  requestAndroidSmsPermissions,
} from "./androidSmsAuto";

const mockMessages: SmsRawInput[] = [
  {
    channel: "sms",
    sender: "85540",
    message:
      "Bancolombia informa compra por $321.900 en UBER EATS tarjeta terminacion 4421 2026-05-04 09:31",
  },
  {
    channel: "sms",
    sender: "85784",
    message:
      "Bancolombia: transaccion por $59.900 en GASOLINA con tarjeta 8844 2026-05-02 08:15",
  },
  {
    channel: "email",
    sender: "alertasynotificaciones@an.notificacionesbancolombia.com",
    message:
      "Bancolombia: Retiraste $1.000.000,00 en AUTOCCUNIC3 de tu T.Deb **8880 el 02/05/2026 a las 19:53. Si tienes dudas, llamanos al 6045109095. Estamos cerca",
  },
];

export function SmsInboxScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const detections = useFinanceStore((state) => state.smsDetections);
  const currency = useFinanceStore((state) => state.settings.currency);
  const processSmsBatch = useFinanceStore((state) => state.processSmsBatch);
  const acceptSms = useFinanceStore((state) => state.acceptSms);
  const discardSms = useFinanceStore((state) => state.discardSms);
  const cards = useFinanceStore((state) => state.cards);
  const [manualSender, setManualSender] = useState("85540");
  const [manualMessage, setManualMessage] = useState("");
  const [manualChannel, setManualChannel] = useState<"sms" | "email">("sms");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const autoAvailable = useMemo(() => isAndroidSmsAutoAvailable(), []);

  const processManualInput = () => {
    const normalized = manualMessage.trim();
    if (!normalized) return;
    processSmsBatch([{ sender: manualSender.trim() || undefined, message: normalized, channel: manualChannel }]);
    setManualMessage("");
  };

  const runAutoSync = async () => {
    if (!autoAvailable) return;
    setIsSyncing(true);
    setAutoError(null);
    try {
      const batch = await fetchRecentBancolombiaSms({
        shortCodes: ["85540", "85784"],
        limit: 20,
      });
      if (batch.length > 0) processSmsBatch(batch);
      setLastSyncAt(new Date().toLocaleTimeString("es-CO"));
    } catch (error) {
      setAutoError("No fue posible leer SMS automáticos. Revisa permisos y build Android.");
    } finally {
      setIsSyncing(false);
    }
  };

  const enableAutoAndroid = async () => {
    setAutoError(null);
    if (!autoAvailable) {
      setAutoError("Auto SMS requiere Android dev build con módulo nativo conectado.");
      return;
    }
    const granted = await requestAndroidSmsPermissions();
    if (!granted) {
      setAutoError("Permisos de SMS denegados.");
      return;
    }
    setAutoEnabled(true);
    await runAutoSync();
  };

  useEffect(() => {
    if (!autoEnabled || !autoAvailable) return;
    const timer = setInterval(() => {
      runAutoSync();
    }, 30000);
    return () => clearInterval(timer);
  }, [autoEnabled, autoAvailable]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom + 170, 190) },
        ]}
      >
        <SectionTitle
          title="Detección de SMS"
          subtitle="Movimientos pendientes de confirmar"
        />

        <PremiumCard>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            Auto Android (fase A): sincroniza SMS reales desde 85540/85784 si el
            módulo nativo está disponible. iOS usa flujo por pegado.
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: autoEnabled ? theme.success : theme.primary }]}
            onPress={enableAutoAndroid}
          >
            <Text style={styles.primaryButtonText}>
              {autoEnabled ? "Auto Android activo" : "Activar Auto Android"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            onPress={runAutoSync}
            disabled={!autoAvailable || isSyncing}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
              {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Text>
          </Pressable>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            Estado módulo: {autoAvailable ? "Disponible" : "No disponible"}
            {lastSyncAt ? ` • Última sync: ${lastSyncAt}` : ""}
          </Text>
          {autoError ? (
            <Text style={[styles.meta, { color: theme.warning }]}>{autoError}</Text>
          ) : null}
        </PremiumCard>

        <PremiumCard>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            Demo/manual: simulamos lectura y también puedes pegar texto real.
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => processSmsBatch(mockMessages)}
          >
            <Text style={styles.primaryButtonText}>
              Procesar SMS de ejemplo
            </Text>
          </Pressable>
        </PremiumCard>

        <PremiumCard>
          <Text style={[styles.manualTitle, { color: theme.text }]}>Pegar mensaje real (iOS/Android)</Text>
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
            placeholder={manualChannel === "sms" ? "Remitente (85540/85784)" : "Correo remitente"}
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            value={manualMessage}
            onChangeText={setManualMessage}
            placeholder="Pega aquí el contenido del SMS/correo..."
            placeholderTextColor={theme.textMuted}
            multiline
            style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.border }]}
          />
          <Pressable style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={processManualInput}>
            <Text style={styles.primaryButtonText}>Procesar texto pegado</Text>
          </Pressable>
        </PremiumCard>

        {detections
          .filter((item) => item.status === "pending")
          .map((item) => {
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
                    { color: item.trustedSource ? theme.success : theme.warning },
                  ]}
                >
                  Origen: {item.sender ?? "desconocido"} •{" "}
                  {item.channel.toUpperCase()} •{" "}
                  {item.trustedSource ? "Confiable" : "No verificado"}
                </Text>
                <Text style={[styles.amount, { color: theme.danger }]}>
                  {formatMoney(item.amount ?? 0, currency)}
                </Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {item.occurredAt
                    ? formatShortDate(item.occurredAt)
                    : "Fecha no detectada"}
                </Text>
                {linkedCard ? (
                  <Text style={[styles.meta, { color: theme.success }]}>
                    Asociada a tarjeta {linkedCard.alias}
                  </Text>
                ) : (
                  <Text style={[styles.meta, { color: theme.warning }]}>
                    Sin tarjeta asociada
                  </Text>
                )}
                {item.duplicate ? (
                  <Text style={[styles.meta, { color: theme.warning }]}>
                    Posible duplicado detectado
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      { backgroundColor: theme.success },
                    ]}
                    disabled={item.duplicate}
                    onPress={() => acceptSms(item.id)}
                  >
                    <Text style={styles.actionText}>Confirmar</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      { backgroundColor: theme.border },
                    ]}
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
  note: { marginBottom: 10, fontSize: 13 },
  manualTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  channelRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  channelChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
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
  amount: { marginTop: 8, fontSize: 20, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  actionText: { color: "#fff", fontWeight: "700" },
});
