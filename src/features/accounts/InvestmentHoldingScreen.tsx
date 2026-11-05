import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchQuote } from '../../backend/marketQuotes';
import { KeyboardSafeScroll } from '../../components/KeyboardSafeScroll';
import { ConfirmModal, Field, PremiumCard, Screen } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import {
  formatAmountInput,
  formatMoney,
  formatQuantityInput,
  parseAmountInput,
  parseQuantityInput,
  quantityFromRaw,
  quantityToRaw,
} from '../../core/utils/format';
import { isInvestmentKind } from '../../domain/accounts';
import { holdingMarketValue } from '../../domain/investments';
import { InvestmentHolding } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

type HoldingRoute = RouteProp<
  { InvestmentHolding: { accountId: string; holdingId?: string } },
  'InvestmentHolding'
>;

export function InvestmentHoldingScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<HoldingRoute>();
  const { accountId, holdingId } = route.params;

  const accounts = useFinanceStore((state) => state.accounts);
  const holdings = useFinanceStore((state) => state.holdings);
  const upsertHolding = useFinanceStore((state) => state.upsertHolding);
  const deleteHolding = useFinanceStore((state) => state.deleteHolding);

  const account = accounts.find((item) => item.id === accountId);
  const existing = holdings.find((item) => item.id === holdingId && item.accountId === accountId);

  const [name, setName] = useState(existing?.name ?? '');
  const [symbol, setSymbol] = useState(existing?.symbol ?? '');
  const [quantityRaw, setQuantityRaw] = useState(
    existing?.quantity != null ? quantityToRaw(existing.quantity) : '',
  );
  const [priceRaw, setPriceRaw] = useState(existing?.lastPrice != null ? String(existing.lastPrice) : '');
  const [priceCurrency, setPriceCurrency] = useState(existing?.priceCurrency ?? 'USD');
  const [priceUpdatedAt, setPriceUpdatedAt] = useState(existing?.priceUpdatedAt);
  const [note, setNote] = useState(existing?.note ?? '');
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const preview = useMemo(() => {
    const quantity = quantityFromRaw(quantityRaw);
    const price = Number(priceRaw);
    if (!quantityRaw || quantityRaw === '.' || !Number.isFinite(price)) return null;
    return quantity * price;
  }, [priceRaw, quantityRaw]);

  const loadMarketPrice = async () => {
    const ticker = symbol.trim().toUpperCase();
    if (!ticker) {
      Alert.alert('Símbolo requerido', 'Escribe el ticker, por ejemplo AAPL, SPY o VOO.');
      return;
    }
    setFetchingPrice(true);
    try {
      const quote = await fetchQuote(ticker);
      setSymbol(quote.symbol.toUpperCase());
      setPriceRaw(String(quote.price));
      setPriceCurrency(quote.currency.toUpperCase());
      setPriceUpdatedAt(quote.asOf);
      if (!name.trim()) setName(quote.symbol.toUpperCase());
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
    if (!account || !isInvestmentKind(account.kind)) return;
    const ticker = symbol.trim().toUpperCase();
    const quantity = quantityFromRaw(quantityRaw);
    if (!ticker) {
      Alert.alert('Símbolo requerido', 'Escribe el ticker de la acción.');
      return;
    }
    if (!(quantity > 0)) {
      Alert.alert('Cantidad requerida', 'Escribe cuántas acciones tienes. Puede ser una fracción, como 0,25.');
      return;
    }
    const duplicate = holdings.some(
      (item) =>
        item.accountId === account.id &&
        item.id !== existing?.id &&
        item.symbol.toUpperCase() === ticker,
    );
    if (duplicate) {
      Alert.alert(
        'Esa acción ya está',
        `${ticker} ya está en ${account.name}. Ábrela y cambia la cantidad.`,
      );
      return;
    }
    const price = priceRaw.trim() === '' ? undefined : Number(priceRaw);
    const next: InvestmentHolding = {
      id: existing?.id ?? `hold_${Date.now()}`,
      accountId: account.id,
      name: name.trim() || ticker,
      symbol: ticker,
      quantity,
      note: note.trim() || undefined,
    };
    if (typeof price === 'number' && Number.isFinite(price) && price >= 0) {
      next.lastPrice = price;
      next.priceCurrency = priceCurrency || 'USD';
      if (priceUpdatedAt) next.priceUpdatedAt = priceUpdatedAt;
    }
    upsertHolding(next);
    const stored = useFinanceStore.getState().holdings.some((item) => item.id === next.id);
    if (!stored) {
      Alert.alert('No se guardó', 'Revisa el símbolo y que la cantidad sea mayor que cero.');
      return;
    }
    navigation.goBack();
  }, [
    account,
    existing?.id,
    holdings,
    name,
    navigation,
    note,
    priceCurrency,
    priceRaw,
    priceUpdatedAt,
    quantityRaw,
    symbol,
    upsertHolding,
  ]);

  const saveRef = useRef(save);
  saveRef.current = save;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing?.symbol || 'Nueva acción',
      headerRight: () => (
        <View style={styles.headerRight}>
          {existing ? (
            <Pressable
              onPress={() => setDeleteOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Eliminar acción"
            >
              <Ionicons name="trash-outline" size={22} color={theme.danger} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => saveRef.current()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Guardar acción"
          >
            <Ionicons name="checkmark" size={28} color={theme.primary} />
          </Pressable>
        </View>
      ),
    });
  }, [existing, navigation, theme.danger, theme.primary]);

  if (!account || !isInvestmentKind(account.kind)) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={{ color: theme.text }}>Esta acción solo vive dentro de una cuenta de inversión.</Text>
        </View>
      </Screen>
    );
  }

  const currency = priceCurrency || 'USD';
  const savedValue = existing ? holdingMarketValue(existing) : null;

  return (
    <Screen>
      <KeyboardSafeScroll
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}
      >
        <Text style={[styles.hintTop, { color: theme.textMuted }]}>
          Posición en {account.name}. Guarda con ✓ arriba.
        </Text>

        <PremiumCard>
          <Text style={[styles.label, { color: theme.textMuted }]}>Símbolo (ticker)</Text>
          <View style={styles.row}>
            <Field
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
              placeholder="AAPL, SPY, VOO"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.flex, { color: theme.text, borderColor: theme.border }]}
            />
            <Pressable
              onPress={loadMarketPrice}
              disabled={fetchingPrice}
              style={[styles.refreshBtn, { backgroundColor: theme.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Consultar precio de mercado"
            >
              {fetchingPrice ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="refresh" size={20} color="#fff" />
              )}
            </Pressable>
          </View>

          <Text style={[styles.label, { color: theme.textMuted }]}>Nombre (opcional)</Text>
          <Field
            value={name}
            onChangeText={setName}
            placeholder="Apple, S&P 500…"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>Cantidad (acciones o fracción)</Text>
          <View style={styles.row}>
            <Field
              value={formatQuantityInput(quantityRaw)}
              onChangeText={(value) => setQuantityRaw(parseQuantityInput(value))}
              keyboardType="decimal-pad"
              placeholder="Ej. 0,25"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.flex, { color: theme.text, borderColor: theme.border }]}
            />
            <Pressable
              onPress={() => setQuantityRaw((prev) => (prev.includes('.') ? prev : `${prev || '0'}.`))}
              style={[styles.decimalBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Insertar coma decimal"
            >
              <Text style={[styles.decimalBtnText, { color: theme.text }]}>,</Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Puedes anotar una fracción, como 0,25 de un ETF. Si el teclado no trae coma, tócala al lado.
          </Text>

          <Text style={[styles.label, { color: theme.textMuted }]}>Precio unitario ({currency})</Text>
          <Field
            value={formatAmountInput(priceRaw, currency)}
            onChangeText={(value) => setPriceRaw(parseAmountInput(value, currency))}
            keyboardType="decimal-pad"
            placeholder="Se rellena al actualizar el precio"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          {priceUpdatedAt ? (
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Actualizado: {new Date(priceUpdatedAt).toLocaleString('es-CO')}
            </Text>
          ) : null}
          {preview != null ? (
            <Text style={[styles.valuePreview, { color: theme.text }]}>
              Valor de esta posición: {formatMoney(preview, currency)}
            </Text>
          ) : savedValue != null && existing ? (
            <Text style={[styles.valuePreview, { color: theme.text }]}>
              Valor guardado: {formatMoney(savedValue, existing.priceCurrency || currency)}
            </Text>
          ) : null}

          <Text style={[styles.label, { color: theme.textMuted }]}>Nota (opcional)</Text>
          <Field
            value={note}
            onChangeText={setNote}
            placeholder="Compra de enero"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, marginBottom: 0 }]}
          />
        </PremiumCard>
      </KeyboardSafeScroll>

      <ConfirmModal
        open={deleteOpen}
        title="Quitar acción"
        message={`Se elimina ${existing?.symbol ?? 'esta acción'} de ${account.name}. El valor de la cuenta se recalcula.`}
        confirmLabel="Eliminar"
        tone="danger"
        icon="trash-outline"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (existing) deleteHolding(existing.id);
          setDeleteOpen(false);
          navigation.goBack();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hintTop: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  hint: { fontSize: 12, lineHeight: 16, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  refreshBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decimalBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decimalBtnText: { fontSize: 22, fontWeight: '700' },
  valuePreview: { marginTop: 12, fontSize: 16, fontWeight: '800' },
});
