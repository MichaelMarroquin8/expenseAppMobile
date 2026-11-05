import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateField } from '../../components/DateField';
import { KeyboardSafeScroll } from '../../components/KeyboardSafeScroll';
import { ConfirmModal, Field, PremiumCard, Screen } from '../../components/ui';
import { inkSeries } from '../../core/theme/tokens';
import { CURRENCIES, formatCurrencyLabel } from '../../core/constants/currencies';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import {
  dateInputToIso,
  formatAmountInput,
  formatCalendarDate,
  formatMoney,
  parseAmountInput,
  todayDateInput,
} from '../../core/utils/format';
import {
  ACCOUNT_ICON_OPTIONS,
  ACCOUNT_KIND_LABELS,
  ACCOUNT_KIND_OPTIONS,
  defaultIconForKind,
  isInvestmentKind,
  isLiabilityKind,
  isReceivableKind,
  normalizeAccountKind,
} from '../../domain/accounts';
import { AccountKind, FinanceAccount } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

type AccountFormParams = {
  AccountForm: { accountId?: string } | undefined;
};

const palette: readonly string[] = inkSeries;
const QUICK_CURRENCIES = ['COP', 'USD', 'EUR', 'MXN'];

type DebtDraft = {
  id: string;
  personName: string;
  principalRaw: string;
  lentAt: string;
  note: string;
};

export function AccountFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AccountFormParams, 'AccountForm'>>();
  const accountId = route.params?.accountId;

  const defaultCurrency = useFinanceStore((state) => state.settings.currency);
  const accounts = useFinanceStore((state) => state.accounts);
  const holdings = useFinanceStore((state) => state.holdings);
  const upsertAccount = useFinanceStore((state) => state.upsertAccount);
  const upsertReceivableDebt = useFinanceStore((state) => state.upsertReceivableDebt);
  const deleteAccount = useFinanceStore((state) => state.deleteAccount);

  const existing = useMemo(
    () => (accountId ? accounts.find((item) => item.id === accountId) : undefined),
    [accountId, accounts],
  );

  const [name, setName] = useState(existing?.name ?? '');
  const [provider, setProvider] = useState(existing?.provider ?? '');
  const [kind, setKind] = useState<AccountKind>(
    existing ? normalizeAccountKind(existing.kind) : 'default',
  );
  const [currency, setCurrency] = useState(existing?.currency ?? defaultCurrency);
  const [balanceRaw, setBalanceRaw] = useState(
    existing ? String(existing.balance || '') : '',
  );
  const [icon, setIcon] = useState(existing?.icon ?? defaultIconForKind(kind));
  const [note, setNote] = useState(existing?.note ?? '');
  const [excludeFromTotal, setExcludeFromTotal] = useState(existing?.excludeFromTotal ?? false);
  const [kindPickerOpen, setKindPickerOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draftPerson, setDraftPerson] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [draftDate, setDraftDate] = useState(todayDateInput());
  const [draftNote, setDraftNote] = useState('');
  const [drafts, setDrafts] = useState<DebtDraft[]>([]);

  const investmentMode = isInvestmentKind(kind);
  const liabilityMode = isLiabilityKind(kind);
  const receivableMode = isReceivableKind(kind);
  const draftTotal = useMemo(
    () => drafts.reduce((sum, draft) => sum + (Number(draft.principalRaw) || 0), 0),
    [drafts],
  );

  useEffect(() => {
    if (!existing) {
      setIcon((prev) =>
        ACCOUNT_ICON_OPTIONS.includes(prev as (typeof ACCOUNT_ICON_OPTIONS)[number])
          ? prev
          : defaultIconForKind(kind),
      );
    }
  }, [kind, existing]);

  const save = useCallback(() => {
    const normalizedName = name.trim() || provider.trim();
    if (!normalizedName) {
      Alert.alert('Nombre requerido', 'Escribe el nombre de la cuenta, por ejemplo Hapi o Bancolombia.');
      return;
    }

    const creatingParts = !existing && receivableMode && !investmentMode && drafts.length > 0;
    if (creatingParts) {
      const invalidDraft = drafts.some(
        (draft) =>
          !draft.personName.trim() ||
          !(Number(draft.principalRaw) > 0) ||
          !dateInputToIso(draft.lentAt),
      );
      if (invalidDraft) {
        Alert.alert('Desglose incompleto', 'Revisa el nombre, el monto y la fecha de cada persona.');
        return;
      }
    }

    let account: FinanceAccount = {
      id: existing?.id ?? `acc_${Date.now()}`,
      name: normalizedName,
      provider: provider.trim() || normalizedName,
      kind,
      balance: investmentMode
        ? (existing?.balance ?? 0)
        : existing
          ? existing.balance
          : creatingParts
            ? 0
            : Math.max(Number(balanceRaw) || 0, 0),
      last4: existing?.last4,
      currency,
      color: existing?.color ?? palette[Math.floor(Math.random() * palette.length)],
      icon,
      note: note.trim() || undefined,
      excludeFromTotal: excludeFromTotal || undefined,
    };

    if (investmentMode && existing && !holdings.some((item) => item.accountId === existing.id)) {
      if (existing.symbol) account.symbol = existing.symbol;
      if (typeof existing.quantity === 'number') account.quantity = existing.quantity;
      if (typeof existing.lastPrice === 'number') account.lastPrice = existing.lastPrice;
      if (existing.priceCurrency) account.priceCurrency = existing.priceCurrency;
      if (existing.priceUpdatedAt) account.priceUpdatedAt = existing.priceUpdatedAt;
    }

    upsertAccount(account);
    if (creatingParts) {
      drafts.forEach((draft, index) => {
        const lentAt = dateInputToIso(draft.lentAt);
        const principal = Number(draft.principalRaw);
        if (!lentAt || !(principal > 0)) return;
        upsertReceivableDebt({
          id: `debt_${Date.now()}_${index}`,
          accountId: account.id,
          personName: draft.personName.trim(),
          principal,
          lentAt,
          note: draft.note.trim() || undefined,
          payments: [],
        });
      });
    }
    navigation.goBack();
  }, [
    balanceRaw,
    currency,
    drafts,
    excludeFromTotal,
    existing,
    holdings,
    icon,
    investmentMode,
    kind,
    name,
    navigation,
    note,
    provider,
    receivableMode,
    upsertAccount,
    upsertReceivableDebt,
  ]);

  const addDraft = () => {
    const principal = Number(draftAmount);
    if (!draftPerson.trim()) {
      Alert.alert('Nombre requerido', 'Escribe a quién le prestaste.');
      return;
    }
    if (!Number.isFinite(principal) || principal <= 0) {
      Alert.alert('Monto requerido', 'Escribe cuánto le prestaste.');
      return;
    }
    if (!dateInputToIso(draftDate)) {
        Alert.alert('Fecha inválida', 'Elige la fecha del préstamo en el calendario.');
      return;
    }
    setDrafts((current) => [
      ...current,
      {
        id: `draft_${Date.now()}_${current.length}`,
        personName: draftPerson.trim(),
        principalRaw: draftAmount,
        lentAt: draftDate,
        note: draftNote.trim(),
      },
    ]);
    setDraftPerson('');
    setDraftAmount('');
    setDraftNote('');
  };

  const confirmDelete = useCallback(() => {
    if (!existing) return;
    setDeleteOpen(true);
  }, [existing]);

  const saveRef = useRef(save);
  const deleteRef = useRef(confirmDelete);
  saveRef.current = save;
  deleteRef.current = confirmDelete;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerTitleAlign: 'center',
      headerTitle: existing ? 'Editar' : 'Nueva cuenta',
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
        >
          <Text style={[styles.headerCancel, { color: theme.primary }]}>Cancelar</Text>
        </Pressable>
      ),
      headerRight: () => (
        <View style={styles.headerRight}>
          {existing ? (
            <Pressable
              onPress={() => deleteRef.current()}
              hitSlop={10}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Eliminar"
            >
              <Ionicons name="trash-outline" size={22} color={theme.danger} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => saveRef.current()}
            hitSlop={10}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Guardar"
          >
            <Ionicons name="checkmark" size={28} color={theme.primary} />
          </Pressable>
        </View>
      ),
    });
  }, [existing, navigation, theme.danger, theme.primary]);

  const currencyLabel =
    CURRENCIES.find((item) => item.code === currency) != null
      ? formatCurrencyLabel(CURRENCIES.find((item) => item.code === currency)!)
      : currency;

  return (
    <Screen>
      <KeyboardSafeScroll
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 40, 48) }]}
      >
        <Text style={[styles.hintTop, { color: theme.textMuted }]}>
          Guarda cuando quieras con ✓ arriba. El resto de campos es opcional.
        </Text>

        <PremiumCard>
          <Text style={[styles.label, { color: theme.textMuted }]}>Nombre de la cuenta</Text>
          <Field
            value={name}
            onChangeText={setName}
            placeholder={investmentMode ? 'Ej. Hapi, XTB, Trii' : 'Ej. Bancolombia, Efectivo'}
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            autoFocus={!existing}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>Tipo</Text>
          <Pressable
            onPress={() => setKindPickerOpen(true)}
            style={[styles.selectRow, { borderColor: theme.border }]}
          >
            <Text style={[styles.selectText, { color: theme.text }]}>{ACCOUNT_KIND_LABELS[kind]}</Text>
            <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
          </Pressable>
          {receivableMode ? (
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Puedes repartir el total entre las personas que te deben. Cada préstamo guarda su fecha y, después, sus abonos.
            </Text>
          ) : null}
          {investmentMode ? (
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Esta cuenta es el bróker, por ejemplo Hapi, XTB o Trii. Las acciones y las fracciones se agregan dentro, al abrirla.
            </Text>
          ) : null}

          <Text style={[styles.label, { color: theme.textMuted }]}>Moneda</Text>
          <View style={styles.chipRow}>
            {QUICK_CURRENCIES.map((code) => (
              <Pressable
                key={code}
                onPress={() => setCurrency(code)}
                style={[
                  styles.chip,
                  { borderColor: theme.border },
                  currency === code && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                ]}
              >
                <Text style={[styles.chipText, { color: theme.text }]}>{code}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setCurrencyPickerOpen(true)}
              style={[styles.chip, { borderColor: theme.border }]}
            >
              <Text style={[styles.chipText, { color: theme.textMuted }]}>Más…</Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>{currencyLabel}</Text>

          {investmentMode ? (
            <>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                El valor de la cuenta es la suma de sus acciones. Guarda y ábrela para anotar cada ticker y su cantidad.
              </Text>
              {existing && isInvestmentKind(existing.kind) ? (
                <Pressable
                  onPress={() =>
                    (navigation as { navigate: (name: string, params: { accountId: string }) => void }).navigate(
                      'AccountDetail',
                      { accountId: existing.id },
                    )
                  }
                  style={[styles.draftAdd, { backgroundColor: theme.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Ver acciones de esta cuenta"
                >
                  <Text style={styles.draftAddText}>Ver acciones</Text>
                </Pressable>
              ) : null}
            </>
          ) : existing ? (
            <>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                El saldo se ajusta desde el historial de la cuenta, con el lápiz junto al importe.
              </Text>
              {receivableMode && isReceivableKind(existing.kind) ? (
                <Pressable
                  onPress={() =>
                    (navigation as { navigate: (name: string, params: { accountId: string }) => void }).navigate(
                      'AccountDetail',
                      { accountId: existing.id },
                    )
                  }
                  style={[styles.draftAdd, { backgroundColor: theme.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Organizar deudas y abonos"
                >
                  <Text style={styles.draftAddText}>Organizar deudas y abonos</Text>
                </Pressable>
              ) : receivableMode ? (
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  Guarda la cuenta como dinero que te deben y ábrela para repartir el saldo por persona.
                </Text>
              ) : null}
            </>
          ) : receivableMode ? (
            <>
              <Text style={[styles.label, { color: theme.textMuted }]}>Persona</Text>
              <Field
                value={draftPerson}
                onChangeText={setDraftPerson}
                placeholder="Ej. Yuli"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
              <Text style={[styles.label, { color: theme.textMuted }]}>Monto prestado</Text>
              <Field
                value={formatAmountInput(draftAmount, currency)}
                onChangeText={(value) => setDraftAmount(parseAmountInput(value, currency))}
                keyboardType="decimal-pad"
                placeholder="400000"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
              <Text style={[styles.label, { color: theme.textMuted }]}>Fecha del préstamo</Text>
              <DateField
                value={draftDate}
                onChange={setDraftDate}
                accessibilityLabel="Elegir la fecha del préstamo"
              />
              <Text style={[styles.label, { color: theme.textMuted }]}>Nota (opcional)</Text>
              <Field
                value={draftNote}
                onChangeText={setDraftNote}
                placeholder="Préstamo personal"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
              <Pressable
                onPress={addDraft}
                style={[styles.draftAdd, { backgroundColor: theme.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Agregar al desglose"
              >
                <Text style={styles.draftAddText}>Agregar al desglose</Text>
              </Pressable>
              {drafts.map((draft) => {
                const lentAt = dateInputToIso(draft.lentAt);
                return (
                  <View key={draft.id} style={[styles.draftRow, { borderColor: theme.border }]}>
                    <View style={styles.flex}>
                      <Text style={[styles.draftName, { color: theme.text }]}>{draft.personName}</Text>
                      <Text style={[styles.hint, { color: theme.textMuted, marginBottom: 0 }]}>
                        {formatMoney(Number(draft.principalRaw) || 0, currency)}
                        {lentAt ? ` · ${formatCalendarDate(lentAt)}` : ''}
                        {draft.note ? ` · ${draft.note}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar a ${draft.personName}`}
                    >
                      <Ionicons name="close" size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>
                );
              })}
              {drafts.length > 0 ? (
                <Text style={[styles.valuePreview, { color: theme.text }]}>
                  Total por cobrar: {formatMoney(draftTotal, currency)}
                </Text>
              ) : (
                <>
                  <Text style={[styles.label, { color: theme.textMuted }]}>
                    Total por cobrar, sin desglosar (opcional)
                  </Text>
                  <Field
                    value={formatAmountInput(balanceRaw, currency)}
                    onChangeText={(value) => setBalanceRaw(parseAmountInput(value, currency))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                  <Text style={[styles.hint, { color: theme.textMuted }]}>
                    Si aún no quieres dividirlo, deja aquí el total. Podrás asignar personas desde el detalle de la cuenta.
                  </Text>
                </>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: theme.textMuted }]}>
                {liabilityMode ? 'Importe inicial (deuda)' : 'Importe inicial (saldo)'}
              </Text>
              <Field
                value={formatAmountInput(balanceRaw, currency)}
                onChangeText={(value) => setBalanceRaw(parseAmountInput(value, currency))}
                keyboardType="decimal-pad"
                placeholder="0 (opcional)"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
            </>
          )}

          <Text style={[styles.label, { color: theme.textMuted }]}>Entidad / proveedor (opcional)</Text>
          <Field
            value={provider}
            onChangeText={setProvider}
            placeholder="Bancolombia, Nequi, Trii..."
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>Icono</Text>
          <View style={styles.iconGrid}>
            {ACCOUNT_ICON_OPTIONS.map((item) => (
              <Pressable
                key={item}
                onPress={() => setIcon(item)}
                style={[
                  styles.iconBtn,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                  icon === item && { borderColor: theme.primary, backgroundColor: `${theme.primary}25` },
                ]}
              >
                <Ionicons
                  name={item as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={icon === item ? theme.primary : theme.text}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>No incluir en el total</Text>
            <Switch
              value={excludeFromTotal}
              onValueChange={setExcludeFromTotal}
              trackColor={{ false: theme.border, true: `${theme.primary}88` }}
              thumbColor={excludeFromTotal ? theme.primary : '#f4f3f4'}
            />
          </View>

          <Text style={[styles.label, { color: theme.textMuted }]}>Nota (opcional)</Text>
          <Field
            value={note}
            onChangeText={setNote}
            placeholder="Opcional"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, marginBottom: 0 }]}
          />
        </PremiumCard>
      </KeyboardSafeScroll>

      <Modal visible={kindPickerOpen} animationType="slide" transparent onRequestClose={() => setKindPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setKindPickerOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Tipo de cuenta</Text>
            <ScrollView>
              {ACCOUNT_KIND_OPTIONS.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    setKind(item);
                    if (!existing) setIcon(defaultIconForKind(item));
                    setKindPickerOpen(false);
                  }}
                  style={[
                    styles.modalItem,
                    { borderBottomColor: theme.border },
                    kind === item && { backgroundColor: `${theme.primary}15` },
                  ]}
                >
                  <Text style={[styles.modalItemText, { color: theme.text }]}>{ACCOUNT_KIND_LABELS[item]}</Text>
                  {kind === item ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={currencyPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCurrencyPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCurrencyPickerOpen(false)}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.surface, borderColor: theme.border, maxHeight: '70%' },
            ]}
          >
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Moneda</Text>
            <ScrollView>
              {CURRENCIES.slice(0, 40).map((item) => (
                <Pressable
                  key={item.code}
                  onPress={() => {
                    setCurrency(item.code);
                    setCurrencyPickerOpen(false);
                  }}
                  style={[styles.modalItem, { borderBottomColor: theme.border }]}
                >
                  <Text style={[styles.modalItemText, { color: theme.text }]}>
                    {item.code} — {item.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        title="Eliminar cuenta"
        message={existing ? `¿Eliminar “${existing.name}”?` : ''}
        confirmLabel="Eliminar"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!existing) return;
          deleteAccount(existing.id);
          setDeleteOpen(false);
          navigation.goBack();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  hintTop: { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  selectRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontWeight: '600', flex: 1, marginRight: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontWeight: '600', fontSize: 12 },
  hint: { fontSize: 11, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  flex: { flex: 1 },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decimalBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  decimalBtnText: { fontSize: 22, fontWeight: '700', lineHeight: 24 },
  draftAdd: {
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  draftAddText: { color: '#fff', fontWeight: '800' },
  draftRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  draftName: { fontSize: 14, fontWeight: '800' },
  valuePreview: { fontWeight: '800', fontSize: 16, marginBottom: 12 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switchLabel: { fontWeight: '600', fontSize: 14 },
  headerBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  headerCancel: { fontSize: 16, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '60%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', paddingHorizontal: 16, marginBottom: 8 },
  modalItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalItemText: { fontSize: 14, fontWeight: '600', flex: 1 },
});
