import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { convertToBase, getExchangeRates } from '../../backend/exchangeRates';
import { fetchQuotes } from '../../backend/marketQuotes';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatMoney, formatShortDate } from '../../core/utils/format';
import {
  ACCOUNT_SECTION_ORDER,
  getAccountDisplayCurrency,
  getAccountDisplayValue,
  getAccountKindLabel,
  isInvestmentKind,
  isLiabilityKind,
  normalizeAccountKind,
  syncInvestmentBalance,
} from '../../domain/accounts';
import { AccountKind, FinanceAccount } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

type Nav = NativeStackNavigationProp<{
  Accounts: undefined;
  AccountForm: { accountId?: string } | undefined;
}>;

type SectionGroup = {
  kind: AccountKind;
  label: string;
  accounts: FinanceAccount[];
};

export function AccountsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const baseCurrency = useFinanceStore((state) => state.settings.currency);
  const accounts = useFinanceStore((state) => state.accounts);
  const upsertAccount = useFinanceStore((state) => state.upsertAccount);

  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [refreshingPrices, setRefreshingPrices] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getExchangeRates(baseCurrency)
      .then((result) => {
        if (!cancelled) setRates(result);
      })
      .catch(() => {
        if (!cancelled) setRates({ [baseCurrency]: 1 });
      });
    return () => {
      cancelled = true;
    };
  }, [baseCurrency]);

  const toBase = useCallback(
    (amount: number, currency: string): number => {
      if (currency === baseCurrency) return amount;
      if (!rates) return currency === baseCurrency ? amount : 0;
      return convertToBase(amount, currency, baseCurrency, rates) ?? 0;
    },
    [baseCurrency, rates],
  );

  const { assetsBase, liabilitiesBase, netWorthBase } = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    for (const account of accounts) {
      if (account.excludeFromTotal) continue;
      const value = getAccountDisplayValue(account);
      const currency = getAccountDisplayCurrency(account);
      const inBase = toBase(value, currency);
      if (isLiabilityKind(account.kind)) {
        liabilities += inBase;
      } else {
        assets += inBase;
      }
    }
    return {
      assetsBase: assets,
      liabilitiesBase: liabilities,
      netWorthBase: assets - liabilities,
    };
  }, [accounts, toBase]);

  const sections = useMemo((): SectionGroup[] => {
    const map = new Map<AccountKind, FinanceAccount[]>();
    for (const account of accounts) {
      const kind = normalizeAccountKind(account.kind);
      const list = map.get(kind) ?? [];
      list.push(account);
      map.set(kind, list);
    }
    const ordered: SectionGroup[] = [];
    for (const kind of ACCOUNT_SECTION_ORDER) {
      const list = map.get(kind);
      if (!list?.length) continue;
      ordered.push({ kind, label: getAccountKindLabel(kind), accounts: list });
      map.delete(kind);
    }
    for (const [kind, list] of map) {
      ordered.push({ kind, label: getAccountKindLabel(kind), accounts: list });
    }
    return ordered;
  }, [accounts]);

  const investmentWithSymbol = useMemo(
    () => accounts.filter((item) => isInvestmentKind(item.kind) && item.symbol?.trim()),
    [accounts],
  );

  const sectionSubtotalBase = (list: FinanceAccount[], asLiability: boolean): number => {
    let sum = 0;
    for (const account of list) {
      if (account.excludeFromTotal) continue;
      const value = getAccountDisplayValue(account);
      const currency = getAccountDisplayCurrency(account);
      const inBase = toBase(value, currency);
      if (asLiability === isLiabilityKind(account.kind)) {
        sum += inBase;
      }
    }
    return sum;
  };

  const refreshInvestmentPrices = async () => {
    if (investmentWithSymbol.length === 0) return;
    setRefreshingPrices(true);
    try {
      const symbols = investmentWithSymbol.map((item) => item.symbol!);
      const { ok, failed } = await fetchQuotes(symbols);
      const bySymbol = new Map(ok.map((quote) => [quote.symbol.toUpperCase(), quote]));
      let updated = 0;
      for (const account of investmentWithSymbol) {
        const key = account.symbol!.trim().toUpperCase();
        const quote = bySymbol.get(key) ?? ok.find((item) => item.symbol.toUpperCase() === key);
        if (!quote) continue;
        const next = syncInvestmentBalance({
          ...account,
          symbol: quote.symbol,
          lastPrice: quote.price,
          priceCurrency: quote.currency,
          priceUpdatedAt: quote.asOf,
          currency: quote.currency,
        });
        upsertAccount(next);
        updated += 1;
      }
      if (failed.length > 0) {
        Alert.alert(
          'Precios parcialmente actualizados',
          `Se actualizaron ${updated}. Fallaron: ${failed.map((item) => item.symbol).join(', ')}`,
        );
      } else {
        Alert.alert('Listo', `Se actualizaron ${updated} precio(s) de mercado.`);
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'No se pudieron actualizar los precios',
      );
    } finally {
      setRefreshingPrices(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}
      >
        <SectionTitle
          title="Cuentas"
          subtitle="Patrimonio, efectivo, tarjetas, virtuales e inversiones"
        />

        <PremiumCard>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Patrimonio neto</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatMoney(netWorthBase, baseCurrency)}
          </Text>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryBox, { borderLeftColor: theme.primary }]}>
              <Text style={[styles.summarySmallLabel, { color: theme.textMuted }]}>Activos</Text>
              <Text style={[styles.summarySmallValue, { color: theme.text }]}>
                {formatMoney(assetsBase, baseCurrency)}
              </Text>
            </View>
            <View style={[styles.summaryBox, { borderLeftColor: theme.warning }]}>
              <Text style={[styles.summarySmallLabel, { color: theme.textMuted }]}>Pasivo</Text>
              <Text style={[styles.summarySmallValue, { color: theme.text }]}>
                {formatMoney(liabilitiesBase, baseCurrency)}
              </Text>
            </View>
          </View>
        </PremiumCard>

        {investmentWithSymbol.length > 0 ? (
          <Pressable
            onPress={refreshInvestmentPrices}
            disabled={refreshingPrices}
            style={[styles.refreshPricesBtn, { backgroundColor: theme.primary }]}
          >
            {refreshingPrices ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.refreshPricesText}>Actualizar precios</Text>
              </>
            )}
          </Pressable>
        ) : null}

        {sections.length === 0 ? (
          <PremiumCard>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Aún no tienes cuentas. Añade efectivo, bancos, tarjetas de crédito o inversiones (ej. 2
              acciones de SPY).
            </Text>
          </PremiumCard>
        ) : (
          sections.map((section) => {
            const liability = isLiabilityKind(section.kind);
            const subtotal = sectionSubtotalBase(section.accounts, liability);
            return (
              <View key={section.kind} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.label}</Text>
                  <Text style={[styles.sectionTotal, { color: theme.textMuted }]}>
                    {liability ? 'Pasivo: ' : ''}
                    {formatMoney(subtotal, baseCurrency)}
                  </Text>
                </View>
                {section.accounts.map((account) => {
                  const value = getAccountDisplayValue(account);
                  const currency = getAccountDisplayCurrency(account);
                  const iconName = (account.icon ?? 'wallet-outline') as keyof typeof Ionicons.glyphMap;
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => navigation.navigate('AccountForm', { accountId: account.id })}
                    >
                      <PremiumCard style={{ backgroundColor: `${account.color}12` }}>
                        <View style={styles.accountRow}>
                          <View
                            style={[styles.iconWrap, { backgroundColor: `${theme.primary}22` }]}
                          >
                            <Ionicons name={iconName} size={22} color={theme.primary} />
                          </View>
                          <View style={styles.accountBody}>
                            <Text style={[styles.accountName, { color: theme.text }]}>
                              {account.name}
                            </Text>
                            {isInvestmentKind(account.kind) && account.symbol ? (
                              <Text style={[styles.accountMeta, { color: theme.textMuted }]}>
                                {account.quantity ?? 0} × {account.symbol}
                                {account.priceUpdatedAt
                                  ? ` · ${formatShortDate(account.priceUpdatedAt)}`
                                  : ''}
                              </Text>
                            ) : (
                              <Text style={[styles.accountMeta, { color: theme.textMuted }]}>
                                {account.provider}
                                {liability ? ' · Dinero que debo' : ''}
                                {account.excludeFromTotal ? ' · Excluida del total' : ''}
                              </Text>
                            )}
                          </View>
                          <View style={styles.accountRight}>
                            <Text style={[styles.balance, { color: theme.text }]}>
                              {formatMoney(value, currency)}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                          </View>
                        </View>
                      </PremiumCard>
                    </Pressable>
                  );
                })}
              </View>
            );
          })
        )}

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => navigation.navigate('AccountForm')}
          >
            <Text style={[styles.actionText, { color: theme.text }]}>Añadir cuenta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 30, fontWeight: '800', marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  summaryBox: { flex: 1, borderLeftWidth: 3, paddingLeft: 10 },
  summarySmallLabel: { fontSize: 12 },
  summarySmallValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  refreshPricesBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshPricesText: { color: '#fff', fontWeight: '700' },
  emptyText: { fontSize: 14, lineHeight: 20 },
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontWeight: '800', fontSize: 15 },
  sectionTotal: { fontSize: 12, fontWeight: '600' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountBody: { flex: 1 },
  accountName: { fontWeight: '800', fontSize: 15 },
  accountMeta: { fontSize: 12, marginTop: 2 },
  accountRight: { alignItems: 'flex-end', gap: 4 },
  balance: { fontWeight: '800', fontSize: 15 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionText: { fontWeight: '700' },
});
