import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatExchangeRateLabel,
  getExchangeRates,
  getUnitsOfBasePerOne,
} from '../../backend/exchangeRates';
import {
  CURRENCIES,
  CurrencyOption,
  findCurrency,
} from '../../core/constants/currencies';
import { useAppTheme } from '../../core/theme/ThemeProvider';

interface TransactionCurrencyPickerProps {
  open: boolean;
  onClose: () => void;
  defaultCurrency: string;
  selectedCurrency: string;
  onSelect: (code: string) => void;
}

export function TransactionCurrencyPicker({
  open,
  onClose,
  defaultCurrency,
  selectedCurrency,
  onSelect,
}: TransactionCurrencyPickerProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getExchangeRates(defaultCurrency)
      .then((result) => {
        if (!cancelled) setRates(result);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar las tasas. Revisa tu conexión.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, defaultCurrency]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSearchOpen(false);
    }
  }, [open]);

  const defaultMeta = findCurrency(defaultCurrency);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return CURRENCIES;
    return CURRENCIES.filter(
      (item) =>
        item.code.toLowerCase().includes(normalized) ||
        item.name.toLowerCase().includes(normalized) ||
        item.symbol.toLowerCase().includes(normalized),
    );
  }, [query]);

  const renderRate = (item: CurrencyOption) => {
    if (item.code === defaultCurrency) return null;
    if (!rates) return null;
    const units = getUnitsOfBasePerOne(rates, defaultCurrency, item.code);
    if (units == null) return null;
    return (
      <Text style={[styles.rate, { color: theme.textMuted }]} numberOfLines={1}>
        {formatExchangeRateLabel(item.code, defaultCurrency, units)}
      </Text>
    );
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          {searchOpen ? (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={theme.textMuted} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar moneda"
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.text }]}
              />
              <Pressable
                android_ripple={null}
                onPress={() => {
                  setQuery('');
                  setSearchOpen(false);
                }}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable android_ripple={null} onPress={onClose} hitSlop={10}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </Pressable>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Moneda</Text>
              <Pressable android_ripple={null} onPress={() => setSearchOpen(true)} hitSlop={10}>
                <Ionicons name="search" size={22} color={theme.text} />
              </Pressable>
            </>
          )}
        </View>

        <View style={[styles.defaultRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.defaultLabel, { color: theme.text }]}>Moneda predeterminada</Text>
          <View style={styles.defaultValueCol}>
            <Text style={[styles.defaultCode, { color: theme.text }]}>
              {defaultCurrency}
              {defaultMeta ? ` ( ${defaultMeta.symbol} )` : ''}
            </Text>
            <Text style={[styles.defaultName, { color: theme.textMuted }]} numberOfLines={1}>
              {defaultMeta?.name ?? defaultCurrency}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.stateText, { color: theme.textMuted }]}>Cargando tasas…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={[styles.stateText, { color: theme.danger }]}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 32) }}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.border }]} />
            )}
            renderItem={({ item }) => {
              const active = item.code === selectedCurrency;
              return (
                <Pressable
                  android_ripple={null}
                  onPress={() => {
                    onSelect(item.code);
                    onClose();
                  }}
                  style={styles.row}
                >
                  <View style={styles.rowLeft}>
                    <Text style={[styles.codeLine, { color: theme.text }]}>
                      {item.code} ( {item.symbol} )
                    </Text>
                    <Text style={[styles.nameLine, { color: theme.textMuted }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    {renderRate(item)}
                    <View
                      style={[
                        styles.radio,
                        { borderColor: active ? theme.primary : theme.border },
                        active && { backgroundColor: theme.primary },
                      ]}
                    >
                      {active ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  defaultLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  defaultValueCol: { alignItems: 'flex-end', maxWidth: '55%' },
  defaultCode: { fontSize: 15, fontWeight: '700' },
  defaultName: { fontSize: 12, marginTop: 2 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stateText: { textAlign: 'center', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 10,
  },
  rowLeft: { flex: 1, gap: 2 },
  codeLine: { fontSize: 16, fontWeight: '700' },
  nameLine: { fontSize: 13 },
  rowRight: { alignItems: 'flex-end', gap: 8, maxWidth: '48%' },
  rate: { fontSize: 11, textAlign: 'right' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 18 },
});
