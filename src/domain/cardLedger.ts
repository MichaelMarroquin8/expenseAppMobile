import { isBalanceAdjustment, isLiquidKind, normalizeAccountKind } from './accounts';
import { FinanceAccount, PaymentCard, Transaction } from './models';

export const linkedAccount = (card: PaymentCard, accounts: FinanceAccount[]): FinanceAccount | undefined =>
  accounts.find((account) => account.id === card.accountId);

export const isCreditDebtAccount = (account: FinanceAccount | undefined): boolean =>
  !!account && normalizeAccountKind(account.kind) === 'credit_card';

/** La deuda es el saldo de la cuenta crédito ligada. No se guarda otra vez en la tarjeta. */
export const cardDebt = (card: PaymentCard, accounts: FinanceAccount[]): number => {
  if (card.cardType !== 'credit') return 0;
  const account = linkedAccount(card, accounts);
  if (!isCreditDebtAccount(account)) return 0;
  return Math.max(account?.balance ?? 0, 0);
};

export const cardAvailable = (card: PaymentCard, accounts: FinanceAccount[]): number | null => {
  if (card.cardType !== 'credit' || typeof card.limit !== 'number') return null;
  return card.limit - cardDebt(card, accounts);
};

/**
 * Historial de la tarjeta: compras marcadas con cardId y pagos que entran a la cuenta crédito.
 * Un gasto sin cardId pero cargado a esa misma cuenta también aparece, para que la lista explique la deuda.
 */
export const cardMovements = (card: PaymentCard, transactions: Transaction[]): Transaction[] => {
  const debtAccountId = card.cardType === 'credit' ? card.accountId : undefined;
  return transactions
    .filter((transaction) => {
      if (isBalanceAdjustment(transaction)) return false;
      if (transaction.cardId === card.id && transaction.type === 'expense') return true;
      if (!debtAccountId) return false;
      if (transaction.type === 'expense' && !transaction.cardId && transaction.accountId === debtAccountId) {
        return true;
      }
      return transaction.type === 'transfer' && transaction.destinationAccountId === debtAccountId;
    })
    .slice()
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
};

export const firstLiquidAccountId = (accounts: FinanceAccount[], exceptId?: string): string | undefined =>
  accounts.find((account) => account.id !== exceptId && isLiquidKind(account.kind))?.id;
