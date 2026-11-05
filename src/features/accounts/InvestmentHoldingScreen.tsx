import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchQuote, type MarketQuote } from '../../backend/marketQuotes';
import { KeyboardSafeScroll } from '../../components/KeyboardSafeScroll';
import { ConfirmModal, Field, PremiumCard, Screen } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import {
  amountToRaw,
  formatAmountInput,
  formatMoney,
  formatQuantityInput,
  formatShares,
  formatSignedPercent,
  parseAmountInput,
  parseQuantityInput,
  quantityFromRaw,
  quantityToRaw,
  sameMoney,
} from '../../core/utils/format';
import { isInvestmentKind } from '../../domain/accounts';
import { holdingGain, resolvePositionEntry, ResolvedPosition } from '../../domain/investments';
import { InvestmentHolding } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

type HoldingRoute = RouteProp<
  { InvestmentHolding: { accountId: string; holdingId?: string } },
  'InvestmentHolding'
>;

type EntryMode = 'value' | 'invested' | 'unit';

const QUICK_CURRENCIES = ['COP', 'USD', 'EUR', 'MXN'];

const amountFrom = (raw: string): number | undefined => {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const percentFrom = (raw: string, loss: boolean): number | undefined => {
  if (!raw || raw === '.') return undefined;
  const magnitude = Number(raw);
  if (!Number.isFinite(magnitude) || magnitude < 0) return undefined;
  return loss ? -magnitude : magnitude;
};

const initialPercent = (holding?: InvestmentHolding): { raw: string; loss: boolean } => {
  if (!holding?.costBasis || holding.lastPrice == null || !(holding.quantity > 0)) {
    return { raw: '', loss: false };
  }
  const value = holding.quantity * holding.lastPrice;
  const percent = ((value - holding.costBasis) / holding.costBasis) * 100;
  if (!Number.isFinite(percent)) return { raw: '', loss: false };
  const raw = Math.abs(percent)
    .toFixed(2)
    .replace(/\.?0+$/, '');
  return { raw, loss: percent < 0 };
};

const initialMode = (accountName: string, holding?: InvestmentHolding): EntryMode => {
  if (/trii/i.test(accountName)) return 'invested';
  if (/hapi/i.test(accountName)) return 'value';
  if (holding?.costBasis != null && holding.lastPrice == null) return 'invested';
  return 'value';
};

type Draft = {
  errorTitle?: string;
  errorMessage?: string;
  position: ResolvedPosition | null;
  priceUpdatedAt?: string;
};

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
  const openingPercent = initialPercent(existing);
  const openingCurrency = (existing?.priceCurrency || account?.currency || 'USD').toUpperCase();

  const [name, setName] = useState(existing?.name ?? '');
  const [symbol, setSymbol] = useState(existing?.symbol ?? '');
  const [mode, setMode] = useState<EntryMode>(initialMode(account?.name ?? '', existing));
  const [quantityRaw, setQuantityRaw] = useState(
    existing?.quantity != null ? quantityToRaw(existing.quantity) : '',
  );
  const [valueRaw, setValueRaw] = useState(
    existing?.lastPrice != null && existing.quantity > 0
      ? amountToRaw(existing.quantity * existing.lastPrice, openingCurrency)
      : '',
  );
  const [costRaw, setCostRaw] = useState(
    existing?.costBasis != null ? amountToRaw(existing.costBasis, openingCurrency) : '',
  );
  const [percentRaw, setPercentRaw] = useState(openingPercent.raw);
  const [percentLoss, setPercentLoss] = useState(openingPercent.loss);
  const [priceRaw, setPriceRaw] = useState(existing?.lastPrice != null ? String(existing.lastPrice) : '');
  const [priceCurrency, setPriceCurrency] = useState(openingCurrency);
  const [note, setNote] = useState(existing?.note ?? '');
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [valueTouched, setValueTouched] = useState(false);
  const [costTouched, setCostTouched] = useState(false);
  const [percentTouched, setPercentTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const currencyChoices = useMemo(() => {
    const codes = [...QUICK_CURRENCIES];
    if (priceCurrency && !codes.includes(priceCurrency)) codes.unshift(priceCurrency);
    return codes;
  }, [priceCurrency]);

  const knownUnit = quote?.price ?? existing?.lastPrice;
  const knownCurrency = (quote?.currency ?? existing?.priceCurrency ?? priceCurrency).toUpperCase();

  const scaleValue = useCallback(
    (quantity: number) => {
      if (valueTouched || knownUnit == null || !(knownUnit > 0) || !(quantity > 0)) return;
      if (knownCurrency !== priceCurrency) return;
      setValueRaw(amountToRaw(quantity * knownUnit, priceCurrency));
    },
    [knownCurrency, knownUnit, priceCurrency, valueTouched],
  );

  const draft = useMemo((): Draft => {
    const quantity = quantityFromRaw(quantityRaw);
    if (!(quantity > 0)) return { position: null };
    const quantityChanged = existing != null && existing.quantity !== quantity;
    const gain = percentFrom(percentRaw, percentLoss);
    const keptCost = existing?.costBasis;

    if (mode === 'value') {
      const marketValue = amountFrom(valueRaw);
      if (marketValue == null) {
        if (percentTouched || valueTouched) {
          return {
            position: null,
            errorTitle: 'Falta el valor de hoy',
            errorMessage: 'Escribe el monto que ves junto a la acción. En Hapi es el número de la derecha.',
          };
        }
        return { position: null };
      }
      const quoteMatches =
        quote != null &&
        !valueTouched &&
        quote.currency.toUpperCase() === priceCurrency &&
        sameMoney(marketValue, quantity * quote.price, priceCurrency);
      if (quoteMatches) {
        const priced = resolvePositionEntry({
          quantity,
          unitPrice: quote.price,
          gainPercent: percentTouched ? gain : undefined,
          costBasis: percentTouched ? undefined : keptCost,
        });
        return { position: priced, priceUpdatedAt: quote.asOf };
      }
      const storedCurrency = (existing?.priceCurrency ?? priceCurrency).toUpperCase();
      const existingMatches =
        !valueTouched &&
        existing?.lastPrice != null &&
        storedCurrency === priceCurrency &&
        sameMoney(marketValue, quantity * existing.lastPrice, priceCurrency);
      if (existingMatches && existing.lastPrice != null) {
        const priced = resolvePositionEntry({
          quantity,
          unitPrice: existing.lastPrice,
          gainPercent: percentTouched ? gain : undefined,
          costBasis: percentTouched ? undefined : keptCost,
        });
        return { position: priced, priceUpdatedAt: existing.priceUpdatedAt };
      }
      const priced = resolvePositionEntry({
        quantity,
        marketValue,
        gainPercent: percentTouched ? gain : undefined,
        costBasis: percentTouched ? undefined : keptCost,
      });
      return { position: priced, priceUpdatedAt: new Date().toISOString() };
    }

    if (mode === 'invested') {
      const costBasis = amountFrom(costRaw);
      if (costBasis == null || gain == null) {
        if (costTouched || percentTouched) {
          return {
            position: null,
            errorTitle: 'Faltan datos de Trii',
            errorMessage: 'Escribe el total invertido y el porcentaje. Si el porcentaje está en rojo, marca Bajó.',
          };
        }
        return { position: null };
      }
      const storedCurrency = (existing?.priceCurrency ?? priceCurrency).toUpperCase();
      if (
        !costTouched &&
        !percentTouched &&
        !quantityChanged &&
        storedCurrency === priceCurrency &&
        existing?.lastPrice != null &&
        existing.costBasis != null
      ) {
        return {
          position: {
            lastPrice: existing.lastPrice,
            marketValue: quantity * existing.lastPrice,
            costBasis: existing.costBasis,
          },
          priceUpdatedAt: existing.priceUpdatedAt,
        };
      }
      const priced = resolvePositionEntry({ quantity, costBasis, gainPercent: gain });
      if (!priced) {
        return {
          position: null,
          errorTitle: 'Porcentaje demasiado bajo',
          errorMessage: 'Con una pérdida de 100% o más el valor queda en cero. Revisa el porcentaje o usa Valor de hoy.',
        };
      }
      return { position: priced, priceUpdatedAt: new Date().toISOString() };
    }

    const unitPrice = amountFrom(priceRaw);
    if (unitPrice == null) {
      if (priceTouched) {
        return {
          position: null,
          errorTitle: 'Falta el precio',
          errorMessage: 'Escribe el precio de una acción o pulsa actualizar junto al símbolo.',
        };
      }
      return { position: null };
    }
    const quoteMatches =
      quote != null &&
      !priceTouched &&
      quote.currency.toUpperCase() === priceCurrency &&
      Math.abs(unitPrice - quote.price) < 1e-8;
    if (quoteMatches) {
      const priced = resolvePositionEntry({ quantity, unitPrice: quote.price, costBasis: keptCost });
      return { position: priced, priceUpdatedAt: quote.asOf };
    }
    const priced = resolvePositionEntry({ quantity, unitPrice, costBasis: keptCost });
    return {
      position: priced,
      priceUpdatedAt:
        existing?.priceUpdatedAt && existing.lastPrice != null && Math.abs(existing.lastPrice - unitPrice) < 1e-8
          ? existing.priceUpdatedAt
          : new Date().toISOString(),
    };
  }, [
    costRaw,
    costTouched,
    existing,
    mode,
    percentLoss,
    percentRaw,
    percentTouched,
    priceCurrency,
    priceRaw,
    priceTouched,
    quantityRaw,
    quote,
    valueRaw,
    valueTouched,
  ]);

  const loadMarketPrice = async () => {
    const ticker = symbol.trim().toUpperCase();
    if (!ticker) {
      Alert.alert('Símbolo requerido', 'Escribe el ticker, por ejemplo QQQ, IXG, CSPXCO o NUCO.');
      return;
    }
    setFetchingPrice(true);
    try {
      const nextQuote = await fetchQuote(ticker);
      const nextCurrency = nextQuote.currency.toUpperCase();
      setQuote(nextQuote);
      setSymbol(nextQuote.symbol.toUpperCase());
      setPriceRaw(String(nextQuote.price));
      setPriceCurrency(nextCurrency);
      setPriceTouched(false);
      setValueTouched(false);
      const quantity = quantityFromRaw(quantityRaw);
      if (quantity > 0) {
        setValueRaw(amountToRaw(quantity * nextQuote.price, nextCurrency));
        setMode('value');
      }
      if (!name.trim()) setName(nextQuote.symbol.toUpperCase());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al consultar el precio';
      Alert.alert(
        'No se pudo actualizar',
        `${message}\n\nSi es de Trii, como CSPXCO o NUCO, elige “Invertí y %” y copia el monto y el porcentaje.`,
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
      Alert.alert('Símbolo requerido', 'Escribe el ticker tal como sale en la app.');
      return;
    }
    if (!(quantity > 0)) {
      Alert.alert(
        'Cantidad requerida',
        'En Trii son acciones enteras, por ejemplo 2 o 6. En Hapi es el decimal de abajo del símbolo, por ejemplo 0,51179.',
      );
      return;
    }
    const duplicate = holdings.some(
      (item) =>
        item.accountId === account.id &&
        item.id !== existing?.id &&
        item.symbol.toUpperCase() === ticker,
    );
    if (duplicate) {
      Alert.alert('Esa acción ya está', `${ticker} ya está en ${account.name}. Ábrela para cambiar el valor.`);
      return;
    }
    if (draft.errorTitle && draft.errorMessage) {
      Alert.alert(draft.errorTitle, draft.errorMessage);
      return;
    }

    const next: InvestmentHolding = {
      id: existing?.id ?? `hold_${Date.now()}`,
      accountId: account.id,
      name: name.trim() || ticker,
      symbol: ticker,
      quantity,
      note: note.trim() || undefined,
    };
    if (draft.position) {
      next.lastPrice = draft.position.lastPrice;
      next.priceCurrency = priceCurrency || 'USD';
      if (draft.position.costBasis != null) next.costBasis = draft.position.costBasis;
      if (draft.priceUpdatedAt) next.priceUpdatedAt = draft.priceUpdatedAt;
    } else if (existing?.lastPrice != null) {
      next.lastPrice = existing.lastPrice;
      if (existing.priceCurrency) next.priceCurrency = existing.priceCurrency;
      if (existing.costBasis != null) next.costBasis = existing.costBasis;
      if (existing.priceUpdatedAt) next.priceUpdatedAt = existing.priceUpdatedAt;
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
    draft.errorMessage,
    draft.errorTitle,
    draft.position,
    draft.priceUpdatedAt,
    existing,
    holdings,
    name,
    navigation,
    note,
    priceCurrency,
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
  const quantityPlaceholder = /trii/i.test(account.name) ? '2' : '0,51179';
  const gainPreview = draft.position?.costBasis
    ? holdingGain({
        id: 'preview',
        accountId: account.id,
        name: symbol || 'Acción',
        symbol: symbol || 'ACCIÓN',
        quantity: quantityFromRaw(quantityRaw) || 1,
        lastPrice: draft.position.lastPrice,
        costBasis: draft.position.costBasis,
      })
    : null;

  const selectMode = (next: EntryMode) => {
    setMode(next);
    if (next !== 'value' || valueTouched) return;
    const quantity = quantityFromRaw(quantityRaw);
    if (quantity > 0 && knownUnit != null && knownUnit > 0 && knownCurrency === priceCurrency) {
      setValueRaw(amountToRaw(quantity * knownUnit, priceCurrency));
    }
  };

  const onCurrency = (code: string) => {
    if (code === priceCurrency) return;
    setPriceCurrency(code);
    setValueRaw((prev) => (prev ? amountToRaw(Number(prev), code) : prev));
    setCostRaw((prev) => (prev ? amountToRaw(Number(prev), code) : prev));
    setPriceRaw((prev) => (prev ? amountToRaw(Number(prev), code) : prev));
  };

  return (
    <Screen>
      <KeyboardSafeScroll
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}
      >
        <Text style={[styles.hintTop, { color: theme.textMuted }]}>
          Copia los números de la app. El monto grande no es el precio de una acción. Guarda con ✓ arriba.
        </Text>

        <PremiumCard>
          <View style={styles.chipRow}>
            {(
              [
                ['value', 'Valor de hoy'],
                ['invested', 'Invertí y %'],
                ['unit', 'Precio c/u'],
              ] as const
            ).map(([id, label]) => {
              const selected = mode === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => selectMode(id)}
                  style={[
                    styles.chip,
                    { borderColor: theme.border },
                    selected && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, { color: theme.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {mode === 'invested'
              ? 'Trii: CSPXCO tiene 2 acciones y NUCO tiene 6. A la derecha está el total invertido y, debajo, el %. Si está en rojo, marca Bajó.'
              : mode === 'value'
                ? 'Hapi: IXG tiene 0,51179 acciones y a la derecha $68,76. Ese 68,76 es el valor de todas, no el precio de una.'
                : 'Úsalo si conoces el precio de una sola acción, o pulsa actualizar. QQQ, IXG y ARKK suelen tener precio. CSPXCO y NUCO, no.'}
          </Text>

          <Text style={[styles.label, { color: theme.textMuted }]}>Símbolo</Text>
          <View style={styles.row}>
            <Field
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
              placeholder="IXG, QQQ, CSPXCO"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.flex, { color: theme.text, borderColor: theme.border }]}
            />
            <Pressable
              onPress={loadMarketPrice}
              disabled={fetchingPrice}
              style={[styles.iconBtn, { backgroundColor: theme.primary }]}
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
            placeholder="S&P 500, Nu…"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>Moneda del monto</Text>
          <View style={styles.chipRow}>
            {currencyChoices.map((code) => {
              const selected = priceCurrency === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => onCurrency(code)}
                  style={[
                    styles.chip,
                    { borderColor: theme.border },
                    selected && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, { color: theme.text }]}>{code}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>Hapi usa USD. Trii usa COP.</Text>

          <Text style={[styles.label, { color: theme.textMuted }]}>Acciones</Text>
          <View style={styles.row}>
            <Field
              value={formatQuantityInput(quantityRaw)}
              onChangeText={(value) => {
                const raw = parseQuantityInput(value);
                setQuantityRaw(raw);
                scaleValue(quantityFromRaw(raw));
              }}
              keyboardType="decimal-pad"
              placeholder={quantityPlaceholder}
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.flex, { color: theme.text, borderColor: theme.border }]}
            />
            <Pressable
              onPress={() => {
                const raw = quantityRaw.includes('.') ? quantityRaw : `${quantityRaw || '0'}.`;
                setQuantityRaw(raw);
                scaleValue(quantityFromRaw(raw));
              }}
              style={[styles.iconBtn, styles.ghostBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Insertar coma decimal"
            >
              <Text style={[styles.iconBtnText, { color: theme.text }]}>,</Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Trii muestra enteros, como 2. Hapi muestra decimales, como 0,51179. Si el teclado no trae coma, tócala al lado.
          </Text>

          {mode === 'value' ? (
            <>
              <Text style={[styles.label, { color: theme.textMuted }]}>Valor de hoy ({currency})</Text>
              <Field
                value={formatAmountInput(valueRaw, currency)}
                onChangeText={(value) => {
                  setValueTouched(true);
                  setValueRaw(parseAmountInput(value, currency));
                }}
                keyboardType="decimal-pad"
                placeholder="68,76"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Es el dinero de toda la posición. En Hapi está a la derecha del símbolo.
              </Text>
              <PercentField
                raw={percentRaw}
                loss={percentLoss}
                onRaw={(value) => {
                  setPercentTouched(true);
                  setPercentRaw(parseQuantityInput(value, 2));
                }}
                onLoss={(loss) => {
                  setPercentTouched(true);
                  setPercentLoss(loss);
                }}
              />
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Opcional. Si lo pones, calculamos cuánto habías invertido para mostrar la ganancia.
              </Text>
            </>
          ) : null}

          {mode === 'invested' ? (
            <>
              <Text style={[styles.label, { color: theme.textMuted }]}>Total invertido ({currency})</Text>
              <Field
                value={formatAmountInput(costRaw, currency)}
                onChangeText={(value) => {
                  setCostTouched(true);
                  setCostRaw(parseAmountInput(value, currency));
                }}
                keyboardType="decimal-pad"
                placeholder="5.380.000"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
              <PercentField
                raw={percentRaw}
                loss={percentLoss}
                onRaw={(value) => {
                  setPercentTouched(true);
                  setPercentRaw(parseQuantityInput(value, 2));
                }}
                onLoss={(loss) => {
                  setPercentTouched(true);
                  setPercentLoss(loss);
                }}
              />
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                En Trii el monto es el total invertido y el % está debajo. El saldo de la cuenta usa el valor de hoy, no lo invertido.
              </Text>
            </>
          ) : null}

          {mode === 'unit' ? (
            <>
              <Text style={[styles.label, { color: theme.textMuted }]}>Precio de una acción ({currency})</Text>
              <Field
                value={formatAmountInput(priceRaw, currency)}
                onChangeText={(value) => {
                  setPriceTouched(true);
                  setPriceRaw(parseAmountInput(value, currency));
                }}
                keyboardType="decimal-pad"
                placeholder="Se rellena al actualizar"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
            </>
          ) : null}

          {draft.position ? (
            <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.previewTitle, { color: theme.text }]}>
                {formatShares(quantityFromRaw(quantityRaw))} · {formatMoney(draft.position.marketValue, currency)}
              </Text>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Cada acción queda en {formatMoney(draft.position.lastPrice, currency)}.
              </Text>
              {gainPreview ? (
                <Text
                  style={[
                    styles.previewGain,
                    { color: gainPreview.amount < 0 ? theme.danger : theme.success },
                  ]}
                >
                  {formatMoney(gainPreview.amount, currency)} · {formatSignedPercent(gainPreview.percent)}
                </Text>
              ) : null}
            </View>
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

function PercentField({
  raw,
  loss,
  onRaw,
  onLoss,
}: {
  raw: string;
  loss: boolean;
  onRaw: (value: string) => void;
  onLoss: (loss: boolean) => void;
}) {
  const { theme } = useAppTheme();
  return (
    <>
      <Text style={[styles.label, { color: theme.textMuted }]}>Ganancia %</Text>
      <View style={styles.row}>
        <Field
          value={formatQuantityInput(raw)}
          onChangeText={onRaw}
          keyboardType="decimal-pad"
          placeholder="5,48"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, styles.flex, { color: theme.text, borderColor: theme.border }]}
        />
        <Pressable
          onPress={() => onRaw(raw.includes('.') ? raw : `${raw || '0'}.`)}
          style={[styles.iconBtn, styles.ghostBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
          accessibilityRole="button"
          accessibilityLabel="Insertar coma decimal en el porcentaje"
        >
          <Text style={[styles.iconBtnText, { color: theme.text }]}>,</Text>
        </Pressable>
      </View>
      <View style={styles.chipRow}>
        <Pressable
          onPress={() => onLoss(false)}
          style={[
            styles.chip,
            { borderColor: theme.border },
            !loss && { borderColor: theme.success, backgroundColor: `${theme.success}22` },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: !loss }}
        >
          <Text style={[styles.chipText, { color: theme.text }]}>Subió</Text>
        </Pressable>
        <Pressable
          onPress={() => onLoss(true)}
          style={[
            styles.chip,
            { borderColor: theme.border },
            loss && { borderColor: theme.danger, backgroundColor: `${theme.danger}22` },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: loss }}
        >
          <Text style={[styles.chipText, { color: theme.text }]}>Bajó</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hintTop: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontWeight: '700', fontSize: 13 },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtn: { borderWidth: 1 },
  iconBtnText: { fontSize: 22, fontWeight: '700' },
  preview: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewTitle: { fontSize: 16, fontWeight: '800' },
  previewGain: { marginTop: 4, fontSize: 14, fontWeight: '800' },
});
