export type EntryType = 'income' | 'expense' | 'transfer';

export type CardType = 'credit' | 'debit';

/** Tipos de cuenta (Money Tracker–style). Incluye kinds legacy para datos antiguos. */
export type AccountKind =
  | 'default'
  | 'cash'
  | 'debit_card'
  | 'credit_card'
  | 'virtual'
  | 'investment'
  | 'receivable'
  | 'payable'
  | 'bank'
  | 'wallet'
  | 'broker';

export type BudgetStatus = 'safe' | 'warning' | 'over';

export interface PaymentCard {
  id: string;
  alias: string;
  bank: string;
  cardType: CardType;
  last4: string;
  color: string;
  icon: string;
  accountId?: string;
  limit?: number;
  statementDay?: number;
  dueDay?: number;
}

export interface Transaction {
  id: string;
  type: EntryType;
  /** Monto en la moneda predeterminada de la app (balances y reportes). */
  amount: number;
  /** Moneda predeterminada al momento del registro. */
  currency: string;
  /** Monto original digitado si la moneda de entrada fue distinta. */
  originalAmount?: number;
  /** Moneda en la que el usuario digitó el monto. */
  originalCurrency?: string;
  /** Unidades de `currency` por 1 de `originalCurrency`. */
  exchangeRate?: number;
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
  source: 'manual' | 'sms' | 'notification';
  detectionId?: string;
}

export interface FinanceAccount {
  id: string;
  name: string;
  provider: string;
  kind: AccountKind;
  /** Saldo (activo) o deuda (pasivo). En inversión se sincroniza con quantity × lastPrice. */
  balance: number;
  currency: string;
  color: string;
  icon?: string;
  note?: string;
  /** Últimos 4 de la cuenta, para emparejar SMS como “cuenta *1750”. */
  last4?: string;
  excludeFromTotal?: boolean;
  /** Ticker Yahoo (ej. SPY, VOO, BTC-USD). Solo inversiones. */
  symbol?: string;
  /** Cantidad de acciones o fracciones (ej. 0.25 de SPY). */
  quantity?: number;
  lastPrice?: number;
  priceCurrency?: string;
  priceUpdatedAt?: string;
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
  channel: 'sms' | 'email' | 'notification';
  rawMessage: string;
  bank?: string;
  amount?: number;
  merchant?: string;
  occurredAt?: string;
  /** Últimos 4 de una tarjeta. */
  last4?: string;
  /** Últimos 4 de la cuenta de origen, cuando el SMS es una transferencia o un QR. */
  accountLast4?: string;
  categoryGuess?: string;
  cardId?: string;
  status: 'pending' | 'accepted' | 'discarded';
  duplicate: boolean;
}

export interface AppSettings {
  currency: string;
  colorScheme: 'light' | 'dark' | 'system';
  remindersEnabled: boolean;
  /** IDs de presets en bankSources (wallet, bancolombia, nu, …). */
  enabledBankSourceIds: string[];
  /** Short codes / remitentes SMS activos (derivados + editables). */
  bankSmsShortCodes: string[];
  /** Paquetes Android de notificaciones a escuchar. */
  notificationPackages: string[];
  /** Guarda rechazos del filtro de pagos (solo Android nativo). */
  bridgeDebugEnabled: boolean;
  /** Poll SMS en background vía WorkManager (~15 min). */
  backgroundSyncEnabled: boolean;
}
