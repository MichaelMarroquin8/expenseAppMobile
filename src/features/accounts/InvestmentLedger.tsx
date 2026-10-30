import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchQuotes } from '../../backend/marketQuotes';
import { PremiumCard, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, formatQuantity, formatShortDate } from '../../core/utils/format';
import { holdingMarketValue, holdingsForAccount } from '../../domain/investments';
import { FinanceAccount, InvestmentHolding } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

export function InvestmentLedger({ account }: { account: FinanceAccount }) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<any>();
  const holdings = useFinanceStore((state) => state.holdings);
  const applyMarketQuotes = useFinanceStore((state) => state.applyMarketQuotes);
  const [refreshing, setRefreshing] = useState(false);

  const positions = useMemo(
    () =>
      holdingsForAccount(holdings, account.id).sort((left, right) =>
        left.symbol.localeCompare(right.symbol),
      ),
    [account.id, holdings],
  );

  const openHolding = (holdingId?: string) => {
    navigation.navigate('InvestmentHolding', { accountId: account.id, holdingId });
  };

  const refreshPrices = async () => {
    const symbols = positions.map((holding) => holding.symbol).filter(Boolean);
    if (symbols.length === 0) return;
    setRefreshing(true);
    try {
      const { ok, failed } = await fetchQuotes(symbols);
      if (ok.length > 0) applyMarketQuotes(ok);
      if (failed.length > 0) {
        Alert.alert(
          'Precios parciales',
          `No se pudo actualizar: ${failed.map((item) => item.symbol).join(', ')}`,
        );
      }
    } catch (error) {
      Alert.alert(
        'No se pudieron actualizar',
        error instanceof Error ? error.message : 'Error al consultar el mercado',
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View>
      <SectionTitle
        title="Acciones"
        subtitle="Lo que compraste en esta cuenta, incluidas las fracciones"
      />

      {positions.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>
          Todavía no hay acciones. Agrega cada compra de esta cuenta, por ejemplo 0,25 de VOO en Hapi.
        </Text>
      ) : (
        positions.map((holding) => (
          <HoldingRow key={holding.id} holding={holding} onPress={() => openHolding(holding.id)} />
        ))
      )}

      <View style={styles.actions}>
        {positions.length > 0 ? (
          <Pressable
            onPress={refreshPrices}
            disabled={refreshing}
            style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Actualizar precios de esta cuenta"
          >
            {refreshing ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color={theme.primary} />
                <Text style={[styles.secondaryText, { color: theme.text }]}>Actualizar precios</Text>
              </>
            )}
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => openHolding(undefined)}
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Agregar acción"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Agregar acción</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HoldingRow({ holding, onPress }: { holding: InvestmentHolding; onPress: () => void }) {
  const { theme } = useAppTheme();
  const value = holdingMarketValue(holding);
  const currency = holding.priceCurrency || 'USD';
  const fraction = holding.quantity > 0 && holding.quantity < 1;
  const title = holding.name && holding.name.toUpperCase() !== holding.symbol ? holding.name : holding.symbol;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${holding.symbol}, ${formatQuantity(holding.quantity)} acciones`}
    >
      <PremiumCard>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: `${theme.primary}22` }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]} numberOfLines={1}>
              {holding.symbol.slice(0, 4)}
            </Text>
          </View>
          <View style={styles.body}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
              {formatQuantity(holding.quantity)} × {holding.symbol}
              {fraction ? ' · Fracción' : ''}
              {holding.lastPrice != null ? ` · ${formatMoney(holding.lastPrice, currency)}` : ' · Sin precio'}
            </Text>
            {holding.priceUpdatedAt ? (
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                Precio del {formatShortDate(holding.priceUpdatedAt)}
              </Text>
            ) : null}
          </View>
          <View style={styles.valueBlock}>
            <Text style={[styles.value, { color: theme.text }]}>
              {value == null ? '—' : formatMoney(value, currency)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </View>
        </View>
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 14, lineHeight: 20, marginBottom: 12, paddingHorizontal: 4 },
  actions: { gap: 10, marginBottom: 8 },
  addButton: {
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
  body: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  valueBlock: { alignItems: 'flex-end', gap: 4 },
  value: { fontSize: 14, fontWeight: '800' },
});
