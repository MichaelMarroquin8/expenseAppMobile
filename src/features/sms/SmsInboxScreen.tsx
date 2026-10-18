import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
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
  const updateSmsDetection = useFinanceStore((state) => state.updateSmsDetection);
  const acceptSms = useFinanceStore((state) => state.acceptSms);
  const discardSms = useFinanceStore((state) => state.discardSms);
  const cards = useFinanceStore((state) => state.cards);
  const accounts = useFinanceStore((state) => state.accounts);

  const [editingDetectionId, setEditingDetectionId] = useState<string | null>(null);
  const [editingAmountRaw, setEditingAmountRaw] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [manualSender, setManualSender] = useState("85540");
  const [manualMessage, setManualMessage] = useState("");
  const [manualChannel, setManualChannel] = useState<"sms" | "email">("sms");

  const pending = detections.filter((item) => item.status === "pending");

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
    setPasteOpen(false);
  };

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
          subtitle="Aprueba o descarta los gastos detectados"
        />

        {pending.length === 0 ? (
          <PremiumCard>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nada por confirmar</Text>
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              Cuando llegue una compra detectada, aparecerá aquí. La detección se activa en Más.
            </Text>
          </PremiumCard>
        ) : null}

        {pending.map((item) => {
          const linkedCard = item.accountLast4
            ? undefined
            : item.cardId
              ? cards.find((card) => card.id === item.cardId)
              : undefined;
          const linkedAccount = item.accountLast4
            ? accounts.find((account) => account.last4 === item.accountLast4) ??
              accounts.find((account) =>
                `${account.name} ${account.provider} ${account.note ?? ''}`.includes(item.accountLast4 ?? ''),
              )
            : undefined;
          return (
            <PremiumCard key={item.id}>
              <Text style={[styles.merchant, { color: theme.text }]}>{item.merchant}</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {item.bank ?? "Banco no detectado"} • {item.categoryGuess ?? "Sin categoría"}
              </Text>
              <Text
                style={[
                  styles.meta,
                  { color: item.trustedSource ? theme.success : theme.warning },
                ]}
              >
                Origen: {item.sender ?? "desconocido"} • {item.channel.toUpperCase()} •{" "}
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
                      setEditingAmountRaw(parseAmountInput(String(item.amount ?? ""), currency));
                    }
                  }}
                >
                  <Text style={[styles.editAmountBtnText, { color: theme.primary }]}>
                    {editingDetectionId === item.id ? "Cancelar" : "Editar monto"}
                  </Text>
                </Pressable>
              </View>
              {editingDetectionId === item.id ? (
                <View style={styles.editAmountBox}>
                  <TextInput
                    value={formatAmountInput(editingAmountRaw, currency)}
                    onChangeText={(val) => setEditingAmountRaw(parseAmountInput(val, currency))}
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
                    style={[styles.saveAmountBtn, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      const nextAmount = Number(editingAmountRaw);
                      if (!Number.isNaN(nextAmount) && nextAmount > 0) {
                        updateSmsDetection(item.id, { amount: nextAmount });
                      }
                      setEditingDetectionId(null);
                      setEditingAmountRaw("");
                    }}
                  >
                    <Text style={[styles.primaryButtonText, { color: theme.surface }]}>Guardar</Text>
                  </Pressable>
                </View>
              ) : null}
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {item.occurredAt ? formatShortDate(item.occurredAt) : "Fecha no detectada"}
                {item.accountLast4 ? ` • cuenta •••• ${item.accountLast4}` : ""}
                {item.last4 ? ` • •••• ${item.last4}` : ""}
              </Text>
              {item.accountLast4 ? (
                <Text style={[styles.meta, { color: linkedAccount ? theme.success : theme.warning }]}>
                  {linkedAccount
                    ? `Sale de ${linkedAccount.name}`
                    : `Transferencia desde la cuenta •••• ${item.accountLast4}. Pon esos 4 dígitos en la cuenta para descontarla ahí.`}
                </Text>
              ) : linkedCard ? (
                <Text style={[styles.meta, { color: theme.success }]}>
                  Asociada a tarjeta {linkedCard.alias}
                </Text>
              ) : (
                <Text style={[styles.meta, { color: theme.warning }]}>
                  Sin tarjeta asociada
                  {item.last4 ? ` (agrega una con terminación ${item.last4})` : ""}
                </Text>
              )}
              {item.duplicate ? (
                <Text style={[styles.meta, { color: theme.warning }]}>
                  Aviso: ya existe un movimiento similar hoy (puedes confirmarlo si es una compra distinta)
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.success }]}
                  disabled={!item.amount || item.amount <= 0}
                  onPress={() => acceptSms(item.id)}
                >
                  <Text style={[styles.actionText, { color: theme.surface }]}>Confirmar</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.border }]}
                  onPress={() => discardSms(item.id)}
                >
                  <Text style={[styles.actionText, { color: theme.text }]}>Descartar</Text>
                </Pressable>
              </View>
            </PremiumCard>
          );
        })}

        <PremiumCard>
          <Pressable
            android_ripple={null}
            style={styles.pasteHeader}
            onPress={() => setPasteOpen((open) => !open)}
          >
            <View style={styles.pasteHeaderText}>
              <Text style={[styles.pasteTitle, { color: theme.text }]}>Pegar SMS o correo</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                Carga un mensaje a mano si la detección no está disponible.
              </Text>
            </View>
            <Ionicons
              name={pasteOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.textMuted}
            />
          </Pressable>

          {pasteOpen ? (
            <View style={styles.pasteBody}>
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
                    <Text
                      style={[
                        styles.channelChipText,
                        { color: manualChannel === channel ? theme.primary : theme.text },
                      ]}
                    >
                      {channel === "sms" ? "SMS" : "Correo"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={manualSender}
                onChangeText={setManualSender}
                placeholder={manualChannel === "sms" ? "Remitente (85540)" : "Correo remitente"}
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
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
                <Text style={[styles.primaryButtonText, { color: theme.surface }]}>Procesar texto</Text>
              </Pressable>
              <Pressable
                style={styles.textAction}
                onPress={() => processSmsBatch(mockMessages)}
              >
                <Text style={[styles.textActionLabel, { color: theme.textMuted }]}>
                  Probar con un SMS de ejemplo
                </Text>
              </Pressable>
            </View>
          ) : null}
        </PremiumCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  empty: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  pasteHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  pasteHeaderText: { flex: 1 },
  pasteTitle: { fontSize: 15, fontWeight: "700" },
  pasteBody: { marginTop: 12 },
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
  primaryButtonText: { fontWeight: "700" },
  textAction: { marginTop: 10, alignSelf: "flex-start" },
  textActionLabel: { fontWeight: "600", fontSize: 13 },
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
  actionText: { fontWeight: "700" },
});
