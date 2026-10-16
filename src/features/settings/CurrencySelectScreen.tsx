import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/ui';
import {
  CURRENCIES,
  CurrencyOption,
  formatCurrencyLabel,
} from '../../core/constants/currencies';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { useFinanceStore } from '../../store/useFinanceStore';

export function CurrencySelectScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const selectedCode = useFinanceStore((state) => state.settings.currency);
  const updateSettings = useFinanceStore((state) => state.updateSettings);

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

  const onSelect = (currency: CurrencyOption) => {
    updateSettings({ currency: currency.code });
    navigation.goBack();
  };

  return (
    <Screen>
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
            <Pressable android_ripple={null} onPress={() => navigation.goBack()} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Seleccionar</Text>
            <Pressable android_ripple={null} onPress={() => setSearchOpen(true)} hitSlop={10}>
              <Ionicons name="search" size={22} color={theme.text} />
            </Pressable>
          </>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 32) }}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            No se encontraron monedas
          </Text>
        }
        renderItem={({ item }) => {
          const active = item.code === selectedCode;
          return (
            <Pressable
              android_ripple={null}
              onPress={() => onSelect(item)}
              style={[styles.row, active && { backgroundColor: `${theme.primary}14` }]}
            >
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {formatCurrencyLabel(item)}
              </Text>
              <View style={styles.codeWrap}>
                <Text style={[styles.code, { color: theme.textMuted }]}>{item.code}</Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  codeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  code: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 18,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
});
