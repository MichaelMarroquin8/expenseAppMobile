export type EntryType = 'income' | 'expense' | 'transfer';

export type CardType = 'credit' | 'debit';
export type AccountKind = 'bank' | 'wallet' | 'investment' | 'cash' | 'broker';

export type BudgetStatus = 'safe' | 'warning' | 'over';

export interface PaymentCard {
  id: string;
  alias: string;
  bank: string;
  cardType: CardType;
  last4: string;
  color: string;
  icon: string;
  limit?: number;
  statementDay?: number;
  dueDay?: number;
}

export interface Transaction {
  id: string;
  type: EntryType;
  amount: number;
  currency: string;
  category: string;
  subcategory?: string;
  note?: string;
  tags: string[];
  paymentMethod: 'cash' | 'transfer' | 'card' | 'wallet';
  cardId?: string;
  accountId?: string;
  destinationAccountId?: string;
  merchant: string;
  occurredAt: string;
  recurring: boolean;
  recurringRule?: 'daily' | 'weekly' | 'monthly';
  source: 'manual' | 'sms';
}

export interface FinanceAccount {
  id: string;
  name: string;
  provider: string;
  kind: AccountKind;
  balance: number;
  currency: string;
  color: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  monthKey: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  autoContribution?: number;
}

export interface SmsDetection {
  id: string;
  sender?: string;
  trustedSource: boolean;
  channel: 'sms' | 'email';
  rawMessage: string;
  bank?: string;
  amount?: number;
  merchant?: string;
  occurredAt?: string;
  last4?: string;
  categoryGuess?: string;
  cardId?: string;
  status: 'pending' | 'accepted' | 'discarded';
  duplicate: boolean;
}

export interface AppSettings {
  currency: string;
  colorScheme: 'light' | 'dark' | 'system';
  remindersEnabled: boolean;
}
