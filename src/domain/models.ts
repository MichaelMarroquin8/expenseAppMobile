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
  /** Copia generada a partir de un movimiento recurrente. */
  recurringSourceId?: string;
  /** Periodos YYYY-MM-DD que este movimiento ya generó. Evita recrearlos si se borra la copia. */
  generatedPeriods?: string[];
  source: 'manual' | 'sms' | 'notification';
  detectionId?: string;
}

export interface FinanceAccount {
  id: string;
  name: string;
  provider: string;
  kind: AccountKind;
  /** Saldo (activo) o deuda (pasivo). En inversión es el valor de mercado de las acciones. */
  balance: number;
  currency: string;
  color: string;
  icon?: string;
  note?: string;
  /** Últimos 4 de la cuenta, para emparejar SMS como “cuenta *1750”. */
  last4?: string;
  excludeFromTotal?: boolean;
  /** Ticker legado, cuando la cuenta era una sola acción. Se migra a `InvestmentHolding`. */
  symbol?: string;
  /** Cantidad legada de acciones o fracciones. Se migra a `InvestmentHolding`. */
  quantity?: number;
  lastPrice?: number;
  priceCurrency?: string;
  priceUpdatedAt?: string;
}

/** Una acción o fracción comprada dentro de una cuenta de inversión (Hapi, XTB, Trii). */
export interface InvestmentHolding {
  id: string;
  accountId: string;
  /** Nombre visible, por ejemplo Apple. Si falta, se muestra el ticker. */
  name: string;
  /** Ticker de mercado (Yahoo), por ejemplo AAPL, SPY o BTC-USD. En Trii puede ser CSPXCO o NUCO. */
  symbol: string;
  /** Acciones enteras (2 en Trii) o fracción (0.51179 en Hapi). */
  quantity: number;
  /** Precio de una acción. Si anotaste el valor de la posición, es valor / cantidad. */
  lastPrice?: number;
  /** Dinero pagado por toda la posición, en `priceCurrency`. Sirve para la ganancia. */
  costBasis?: number;
  priceCurrency?: string;
  priceUpdatedAt?: string;
  note?: string;
}

/** Abono sobre un préstamo de una cuenta por cobrar. */
export interface ReceivablePayment {
  id: string;
  amount: number;
  occurredAt: string;
  note?: string;
}

/**
 * Una parte de una cuenta por cobrar: a quién se le prestó, cuánto y cuándo,
 * más los abonos que ya recibió esa deuda.
 */
export interface ReceivableDebt {
  id: string;
  accountId: string;
  personName: string;
  /** Monto original prestado. */
  principal: number;
  /** Fecha del préstamo (ISO). */
  lentAt: string;
  note?: string;
  payments: ReceivablePayment[];
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
  /** Mes YYYY-MM en el que ya se aplicó el aporte automático. */
  lastAutoAppliedMonth?: string;
}

export interface SmsDetection {
  id: string;
  sender?: string;
  trustedSource: boolean;
  channel: 'sms' | 'email' | 'notification';
  /** `in` cuando el aviso es plata recibida. Si falta, se registra como gasto. */
  direction?: 'in' | 'out';
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
  /** Oculta el patrimonio del inicio. El ojo de esa tarjeta lo alterna. */
  balancesHidden: boolean;
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
