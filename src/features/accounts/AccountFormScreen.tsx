import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchQuote } from '../../backend/marketQuotes';
import { PremiumCard, Screen } from '../../components/ui';
import { CURRENCIES, formatCurrencyLabel } from '../../core/constants/currencies';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatAmountInput, formatMoney, parseAmountInput } from '../../core/utils/format';
import {
  ACCOUNT_ICON_OPTIONS,
  ACCOUNT_KIND_LABELS,
  ACCOUNT_KIND_OPTIONS,
  defaultIconForKind,
  isInvestmentKind,
  isLiabilityKind,
  normalizeAccountKind,
  syncInvestmentBalance,
} from '../../domain/accounts';
import { AccountKind, FinanceAccount } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

type AccountFormParams = {
  AccountForm: { accountId?: string } | undefined;
};

const palette = ['#2563EB', '#A855F7', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#0EA5E9'];
const QUICK_CURRENCIES = ['COP', 'USD', 'EUR', 'MXN'];

export function AccountFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AccountFormParams, 'AccountForm'>>();
  const accountId = route.params?.accountId;

  const defaultCurrency = useFinanceStore((state) => state.settings.currency);
  const accounts = useFinanceStore((state) => state.accounts);
  const upsertAccount = useFinanceStore((state) => state.upsertAccount);
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
  const [symbol, setSymbol] = useState(existing?.symbol ?? '');
  const [quantityRaw, setQuantityRaw] = useState(
    existing?.quantity != null ? String(existing.quantity) : '',
  );
  const [priceRaw, setPriceRaw] = useState(
    existing?.lastPrice != null ? String(existing.lastPrice) : '',
  );
  const [priceCurrency, setPriceCurrency] = useState(existing?.priceCurrency ?? 'USD');
  const [priceUpdatedAt, setPriceUpdatedAt] = useState(existing?.priceUpdatedAt);
  const [kindPickerOpen, setKindPickerOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  const investmentMode = isInvestmentKind(kind);
  const liabilityMode = isLiabilityKind(kind);

  useEffect(() => {
    if (!existing) {
      setIcon((prev) =>
        ACCOUNT_ICON_OPTIONS.includes(prev as (typeof ACCOUNT_ICON_OPTIONS)[number])
          ? prev
          : defaultIconForKind(kind),
      );
    }
  }, [kind, existing]);

  const computedInvestmentValue = useMemo(() => {
    const qty = Number(quantityRaw);
    const price = Number(priceRaw);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
    return qty * price;
  }, [quantityRaw, priceRaw]);

  const loadMarketPrice = async () => {
    const ticker = symbol.trim().toUpperCase();
    if (!ticker) {
      Alert.alert('Símbolo requerido', 'Ingresa un ticker (ej. SPY, VOO, BTC-USD).');
      return;
    }
    setFetchingPrice(true);
    try {
      const quote = await fetchQuote(ticker);
      setSymbol(quote.symbol);
      setPriceRaw(String(quote.price));
      setPriceCurrency(quote.currency);
      setPriceUpdatedAt(quote.asOf);
      setCurrency(quote.currency);
      if (!name.trim()) setName(quote.symbol);
    } catch (error) {
      Alert.alert(
        'No se pudo actualizar',
        error instanceof Error ? error.message : 'Error al consultar el precio',
      );
    } finally {
      setFetchingPrice(false);
    }
  };

  const save = useCallback(() => {
    const ticker = symbol.trim().toUpperCase();
    const normalizedName = name.trim() || ticker || provider.trim();
    if (!normalizedName) {
      Alert.alert('Nombre requerido', 'Escribe al menos un nombre (o un ticker si es inversión).');
      return;
    }

    let account: FinanceAccount = {
      id: existing?.id ?? `acc_${Date.now()}`,
      name: normalizedName,
      provider: provider.trim() || normalizedName,
      kind,
      balance: Math.max(Number(balanceRaw) || 0, 0),
      currency,
      color: existing?.color ?? palette[Math.floor(Math.random() * palette.length)],
      icon,
      note: note.trim() || undefined,
      excludeFromTotal: excludeFromTotal || undefined,
    };

    if (investmentMode) {
      const qty = quantityRaw.trim() === '' ? 0 : Number(quantityRaw);
      const price = priceRaw.trim() === '' ? undefined : Number(priceRaw);
      account = {
        ...account,
        symbol: ticker || undefined,
        quantity: Number.isFinite(qty) && qty >= 0 ? qty : 0,
        lastPrice: typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price : undefined,
        priceCurrency: priceCurrency || currency,
        priceUpdatedAt,
      };
      account = syncInvestmentBalance(account);
    }

    upsertAccount(account);
    navigation.goBack();
  }, [
    balanceRaw,
    currency,
    excludeFromTotal,
    existing,
    icon,
    investmentMode,
    kind,
    name,
    navigation,
    note,
    priceCurrency,
    priceRaw,
    priceUpdatedAt,
    provider,
    quantityRaw,
    symbol,
    upsertAccount,
  ]);

  const confirmDelete = useCallback(() => {
    if (!existing) return;
    Alert.alert('Eliminar cuenta', `¿Eliminar “${existing.name}”?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          deleteAccount(existing.id);
          navigation.goBack();
        },
      },
    ]);
  }, [deleteAccount, existing, navigation]);

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
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 40, 48) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.hintTop, { color: theme.textMuted }]}>
          Guarda cuando quieras con ✓ arriba. El resto de campos es opcional.
        </Text>

        <PremiumCard>
          <Text style={[styles.label, { color: theme.textMuted }]}>Nombre de la cuenta</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej. Bancolombia, Efectivo, SPY"
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
              <Text style={[styles.label, { color: theme.textMuted }]}>Símbolo (ticker)</Text>
              <View style={styles.row}>
                <TextInput
                  value={symbol}
                  onChangeText={setSymbol}
                  autoCapitalize="characters"
                  placeholder="SPY, VOO, AAPL, BTC-USD"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, styles.flex, { color: theme.text, borderColor: theme.border }]}
                />
                <Pressable
                  onPress={loadMarketPrice}
                  disabled={fetchingPrice}
                  style={[styles.refreshBtn, { backgroundColor: theme.primary }]}
                >
                  {fetchingPrice ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons name="refresh" size={20} color="#fff" />
                  )}
                </Pressable>
              </View>

              <Text style={[styles.label, { color: theme.textMuted }]}>Cantidad (acciones / unidades)</Text>
              <TextInput
                value={quantityRaw}
                onChangeText={setQuantityRaw}
                keyboardType="decimal-pad"
                placeholder="Ej. 2 (opcional)"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />

              <Text style={[styles.label, { color: theme.textMuted }]}>
                Precio unitario ({priceCurrency || currency})
              </Text>
              <TextInput
                value={formatAmountInput(priceRaw, priceCurrency || 'USD')}
                onChangeText={(value) => setPriceRaw(parseAmountInput(value, priceCurrency || 'USD'))}
                keyboardType="decimal-pad"
                placeholder="Opcional · se rellena al actualizar"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
              {priceUpdatedAt ? (
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  Actualizado: {new Date(priceUpdatedAt).toLocaleString('es-CO')}
                </Text>
              ) : null}
              {computedInvestmentValue != null ? (
                <Text style={[styles.valuePreview, { color: theme.text }]}>
                  Valor a la fecha:{' '}
                  {formatMoney(computedInvestmentValue, priceCurrency || currency)}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: theme.textMuted }]}>
                {liabilityMode ? 'Importe (deuda)' : 'Importe (saldo)'}
              </Text>
              <TextInput
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
          <TextInput
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
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Opcional"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, marginBottom: 0 }]}
          />
        </PremiumCard>
      </ScrollView>

      <Modal visible={kindPickerOpen} animationType="slide" transparent onRequestClose={() => setKindPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setKindPickerOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
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
          <View style={[styles.modalSheet, { backgroundColor: theme.surface, maxHeight: '70%' }]}>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '60%',
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
