import { FinanceAccount, SavingsGoal, Transaction } from './models';

const cell = (value: string | number | undefined | null): string => {
  const text = value == null ? '' : String(value);
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const accountName = (accounts: FinanceAccount[], id?: string): string =>
  accounts.find((account) => account.id === id)?.name ?? '';

export const transactionsToCsv = (transactions: Transaction[], accounts: FinanceAccount[]): string => {
  const header = [
    'fecha',
    'tipo',
    'monto',
    'moneda',
    'monto_original',
    'moneda_original',
    'categoria',
    'comercio',
    'cuenta',
    'cuenta_destino',
    'nota',
    'origen',
    'recurrente',
  ];
  const rows = [...transactions]
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    .map((tx) =>
      [
        tx.occurredAt,
        tx.type,
        tx.amount,
        tx.currency,
        tx.originalAmount ?? '',
        tx.originalCurrency ?? '',
        tx.category,
        tx.merchant,
        accountName(accounts, tx.accountId),
        accountName(accounts, tx.destinationAccountId),
        tx.note ?? '',
        tx.source,
        tx.recurring ? tx.recurringRule ?? 'si' : '',
      ]
        .map(cell)
        .join(','),
    );
  return [header.join(','), ...rows].join('\n');
};

export type FinanceBackup = {
  exportedAt: string;
  onboardingDone: boolean;
  transactionCategories: string[];
  incomeCategories: string[];
  categoryIcons: Record<string, string>;
  accounts: FinanceAccount[];
  receivables: unknown[];
  holdings: unknown[];
  budgets: unknown[];
  goals: SavingsGoal[];
  cards: unknown[];
  transactions: Transaction[];
  settings: unknown;
};

export const backupToJson = (backup: FinanceBackup): string => JSON.stringify(backup, null, 2);
