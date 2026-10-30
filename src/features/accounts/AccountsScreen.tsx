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
import { formatMoney, formatQuantity, formatShortDate } from '../../core/utils/format';
import {
  ACCOUNT_SECTION_ORDER,
  getAccountDisplayCurrency,
  getAccountDisplayValue,
  getAccountKindLabel,
  isInvestmentKind,
  isLiabilityKind,
  normalizeAccountKind,
} from '../../domain/accounts';
import { holdingsForAccount, summarizePositions } from '../../domain/investments';
import { AccountKind, FinanceAccount } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

type Nav = NativeStackNavigationProp<{
  Accounts: undefined;
  AccountDetail: { accountId: string };
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
  const holdings = useFinanceStore((state) => state.holdings);
  const applyMarketQuotes = useFinanceStore((state) => state.applyMarketQuotes);

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

  const valueInBase = useCallback(
    (account: FinanceAccount): number => {
      if (!isInvestmentKind(account.kind)) {
        return toBase(getAccountDisplayValue(account), getAccountDisplayCurrency(account));
      }
      const summary = summarizePositions(
        account,
        holdings,
        rates ? (amount, currency) => toBase(amount, currency) : undefined,
        baseCurrency,
      );
      if (summary.mixed && summary.currency === baseCurrency) return summary.amount;
      return toBase(summary.amount, summary.currency);
    },
    [baseCurrency, holdings, rates, toBase],
  );

  const displayValue = useCallback(
    (account: FinanceAccount): { amount: number; currency: string } => {
      if (!isInvestmentKind(account.kind)) {
        return {
          amount: getAccountDisplayValue(account),
          currency: getAccountDisplayCurrency(account),
        };
      }
      const summary = summarizePositions(
        account,
        holdings,
        rates ? (amount, currency) => toBase(amount, currency) : undefined,
        baseCurrency,
      );
      return { amount: summary.amount, currency: summary.currency };
    },
    [baseCurrency, holdings, rates, toBase],
  );

  const { assetsBase, liabilitiesBase, netWorthBase } = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    for (const account of accounts) {
      if (account.excludeFromTotal) continue;
      const inBase = valueInBase(account);
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
  }, [accounts, valueInBase]);

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

  const quotedSymbols = useMemo(() => {
    const symbols = holdings.map((holding) => holding.symbol.trim()).filter(Boolean);
    for (const account of accounts) {
      if (isInvestmentKind(account.kind) && account.symbol?.trim()) symbols.push(account.symbol.trim());
    }
    return [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  }, [accounts, holdings]);

  const sectionSubtotalBase = (list: FinanceAccount[], asLiability: boolean): number => {
    let sum = 0;
    for (const account of list) {
      if (account.excludeFromTotal) continue;
      if (asLiability === isLiabilityKind(account.kind)) {
        sum += valueInBase(account);
      }
    }
    return sum;
  };

  const refreshInvestmentPrices = async () => {
    if (quotedSymbols.length === 0) return;
    setRefreshingPrices(true);
    try {
      const { ok, failed } = await fetchQuotes(quotedSymbols);
      if (ok.length > 0) applyMarketQuotes(ok);
      if (failed.length > 0) {
        Alert.alert(
          'Precios parcialmente actualizados',
          `Se actualizaron ${ok.length}. Fallaron: ${failed.map((item) => item.symbol).join(', ')}`,
        );
      } else {
        Alert.alert('Listo', `Se actualizaron ${ok.length} precio(s) de mercado.`);
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

        {quotedSymbols.length > 0 ? (
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
              Aún no tienes cuentas. Añade efectivo, bancos o un bróker como Hapi, XTB o Trii, y dentro anota cada acción.
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
                  const shown = displayValue(account);
                  const positions = isInvestmentKind(account.kind)
                    ? holdingsForAccount(holdings, account.id)
                    : [];
                  const iconName = (account.icon ?? 'wallet-outline') as keyof typeof Ionicons.glyphMap;
                  const positionMeta =
                    positions.length === 1
                      ? `${formatQuantity(positions[0].quantity)} × ${positions[0].symbol}${
                          positions[0].priceUpdatedAt ? ` · ${formatShortDate(positions[0].priceUpdatedAt)}` : ''
                        }`
                      : positions.length > 1
                        ? `${positions.length} acciones`
                        : null;
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => navigation.navigate('AccountDetail', { accountId: account.id })}
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
                            {positionMeta ? (
                              <Text style={[styles.accountMeta, { color: theme.textMuted }]}>
                                {positionMeta}
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
                              {formatMoney(shown.amount, shown.currency)}
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
