import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumCard, Screen, SectionTitle } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatAmountInput, formatMoney, parseAmountInput } from '../../core/utils/format';
import { AccountKind, FinanceAccount } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';

const kinds: AccountKind[] = ['bank', 'wallet', 'investment', 'broker', 'cash'];
const kindLabels: Record<AccountKind, string> = {
  bank: 'Banco',
  wallet: 'Billetera',
  investment: 'Inversión',
  broker: 'Acciones',
  cash: 'Efectivo',
};

const palette = ['#2563EB', '#A855F7', '#10B981', '#F59E0B', '#EF4444'];

export function AccountsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const currency = useFinanceStore((state) => state.settings.currency);
  const accounts = useFinanceStore((state) => state.accounts);
  const upsertAccount = useFinanceStore((state) => state.upsertAccount);

  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [balanceRaw, setBalanceRaw] = useState('');
  const [kind, setKind] = useState<AccountKind>('bank');

  const totalBalance = useMemo(
    () => accounts.reduce((acc, account) => acc + (account.currency === currency ? account.balance : 0), 0),
    [accounts, currency],
  );

  const createAccount = () => {
    const balance = Number(balanceRaw);
    const normalizedName = name.trim();
    const normalizedProvider = provider.trim();
    if (!normalizedName || !normalizedProvider || Number.isNaN(balance) || balance < 0) return;

    const account: FinanceAccount = {
      id: `acc_${Date.now()}`,
      name: normalizedName,
      provider: normalizedProvider,
      kind,
      balance,
      currency,
      color: palette[Math.floor(Math.random() * palette.length)],
    };
    upsertAccount(account);
    setName('');
    setProvider('');
    setBalanceRaw('');
    setKind('bank');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 170, 190) }]}>
        <SectionTitle title="Cuentas y patrimonio" subtitle="Bancos, billeteras, inversiones y acciones" />

        <PremiumCard>
          <Text style={[styles.totalLabel, { color: theme.textMuted }]}>Total actual ({currency})</Text>
          <Text style={[styles.totalValue, { color: theme.text }]}>{formatMoney(totalBalance, currency)}</Text>
        </PremiumCard>

        <PremiumCard>
          <Text style={[styles.formTitle, { color: theme.text }]}>Nueva cuenta</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nombre de cuenta (ej. Nequi principal)"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            value={provider}
            onChangeText={setProvider}
            placeholder="Entidad (Bancolombia, Nequi, Trii...)"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            value={formatAmountInput(balanceRaw, currency)}
            onChangeText={(value) => setBalanceRaw(parseAmountInput(value, currency))}
            keyboardType="decimal-pad"
            placeholder="Saldo inicial"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kindRow}>
            {kinds.map((item) => (
              <Pressable
                key={item}
                onPress={() => setKind(item)}
                style={[
                  styles.kindChip,
                  { borderColor: theme.border },
                  kind === item && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                ]}
              >
                <Text style={[styles.kindText, { color: theme.text }]}>{kindLabels[item]}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={createAccount}>
            <Text style={styles.saveButtonText}>Crear cuenta</Text>
          </Pressable>
        </PremiumCard>

        {accounts.map((account) => (
          <PremiumCard key={account.id} style={{ backgroundColor: `${account.color}15` }}>
            <View style={styles.accountHeader}>
              <Text style={[styles.accountName, { color: theme.text }]}>{account.name}</Text>
              <Text style={[styles.accountKind, { color: theme.textMuted }]}>{kindLabels[account.kind]}</Text>
            </View>
            <Text style={[styles.provider, { color: theme.textMuted }]}>{account.provider}</Text>
            <Text style={[styles.balance, { color: theme.text }]}>{formatMoney(account.balance, account.currency)}</Text>
          </PremiumCard>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  formTitle: { fontWeight: '700', fontSize: 16, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  kindRow: { gap: 8, marginBottom: 12 },
  kindChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  kindText: { fontWeight: '600', fontSize: 12 },
  saveButton: { borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  accountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accountName: { fontWeight: '800', fontSize: 16 },
  accountKind: { fontSize: 12, fontWeight: '600' },
  provider: { marginTop: 4, fontSize: 12 },
  balance: { marginTop: 8, fontSize: 22, fontWeight: '800' },
});
