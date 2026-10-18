import { AccountKind, FinanceAccount } from './models';

/** Corrección de saldo: vive en el historial de la cuenta, no en el libro diario. */
export const BALANCE_ADJUSTMENT_CATEGORY = 'Ajuste';
export const BALANCE_ADJUSTMENT_MERCHANT = 'Ajustar importe';

export const isBalanceAdjustment = (tx: { category?: string; merchant?: string }): boolean =>
  tx.category === BALANCE_ADJUSTMENT_CATEGORY || tx.merchant === BALANCE_ADJUSTMENT_MERCHANT;

/** Kinds disponibles al crear/editar (sin legacy). */
export const ACCOUNT_KIND_OPTIONS: AccountKind[] = [
  'default',
  'cash',
  'debit_card',
  'credit_card',
  'virtual',
  'investment',
  'receivable',
  'payable',
];

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  default: 'Predeterminado',
  cash: 'Efectivo',
  debit_card: 'Tarjeta de débito',
  credit_card: 'Tarjeta de crédito (Pasivo)',
  virtual: 'Cuenta virtual',
  investment: 'Inversión',
  receivable: 'Dinero que me deben / Cuentas por cobrar',
  payable: 'Dinero que debo / Cuentas por pagar (Pasivo)',
  bank: 'Banco',
  wallet: 'Billetera',
  broker: 'Acciones',
};

/** Orden de secciones en la lista de patrimonio. */
export const ACCOUNT_SECTION_ORDER: AccountKind[] = [
  'default',
  'cash',
  'debit_card',
  'virtual',
  'investment',
  'receivable',
  'credit_card',
  'payable',
];

export const ACCOUNT_ICON_OPTIONS = [
  'wallet-outline',
  'cash-outline',
  'card-outline',
  'phone-portrait-outline',
  'trending-up-outline',
  'stats-chart-outline',
  'logo-bitcoin',
  'business-outline',
  'briefcase-outline',
  'home-outline',
  'globe-outline',
  'diamond-outline',
] as const;

/** Normaliza kinds legacy a la taxonomía actual para agrupación UI. */
export const normalizeAccountKind = (kind: AccountKind): AccountKind => {
  if (kind === 'bank') return 'default';
  if (kind === 'wallet') return 'virtual';
  if (kind === 'broker') return 'investment';
  return kind;
};

export const isLiabilityKind = (kind: AccountKind): boolean => {
  const normalized = normalizeAccountKind(kind);
  return normalized === 'credit_card' || normalized === 'payable';
};

export const isInvestmentKind = (kind: AccountKind): boolean =>
  normalizeAccountKind(kind) === 'investment';

/** Cuenta que puede ser el banco de una tarjeta: banco, débito, crédito o billetera. */
export const isInstitutionAccount = (kind: AccountKind): boolean => {
  const normalized = normalizeAccountKind(kind);
  return (
    normalized === 'default' ||
    normalized === 'debit_card' ||
    normalized === 'credit_card' ||
    normalized === 'virtual'
  );
};

export type AccountMovementRole =
  | 'expense_source'
  | 'income_destination'
  | 'transfer_source'
  | 'transfer_destination';

const LIQUID_KINDS = new Set<AccountKind>(['default', 'cash', 'debit_card', 'virtual']);

export const isLiquidKind = (kind: AccountKind): boolean => LIQUID_KINDS.has(normalizeAccountKind(kind));

/**
 * Qué cuentas pueden participar en cada movimiento.
 * Gasto: solo de donde sale plata o se carga una compra (líquidas y tarjeta de crédito).
 * Ingreso: solo cuentas líquidas. Pagar una deuda o aportar a una inversión es una transferencia.
 * Transferencia: el origen no puede ser una deuda; el destino puede ser cualquiera.
 */
export const accountSupportsMovement = (kind: AccountKind, role: AccountMovementRole): boolean => {
  const normalized = normalizeAccountKind(kind);
  switch (role) {
    case 'expense_source':
      return LIQUID_KINDS.has(normalized) || normalized === 'credit_card';
    case 'income_destination':
      return LIQUID_KINDS.has(normalized);
    case 'transfer_source':
      return normalized !== 'payable';
    case 'transfer_destination':
      return true;
    default:
      return false;
  }
};

/** Valor contable a mostrar (inversión = qty × precio si hay datos). */
export const getAccountDisplayValue = (account: FinanceAccount): number => {
  if (isInvestmentKind(account.kind)) {
    const qty = account.quantity;
    const price = account.lastPrice;
    if (typeof qty === 'number' && qty >= 0 && typeof price === 'number' && price >= 0) {
      return qty * price;
    }
  }
  return account.balance;
};

/** Moneda efectiva del valor mostrado (precio de mercado o currency de la cuenta). */
export const getAccountDisplayCurrency = (account: FinanceAccount): string => {
  if (isInvestmentKind(account.kind) && account.priceCurrency) {
    return account.priceCurrency;
  }
  return account.currency;
};

export const getAccountKindLabel = (kind: AccountKind): string =>
  ACCOUNT_KIND_LABELS[normalizeAccountKind(kind)] ?? ACCOUNT_KIND_LABELS.default;

export const defaultIconForKind = (kind: AccountKind): string => {
  switch (normalizeAccountKind(kind)) {
    case 'cash':
      return 'cash-outline';
    case 'debit_card':
    case 'credit_card':
      return 'card-outline';
    case 'virtual':
      return 'phone-portrait-outline';
    case 'investment':
      return 'trending-up-outline';
    case 'receivable':
      return 'arrow-down-circle-outline';
    case 'payable':
      return 'arrow-up-circle-outline';
    default:
      return 'wallet-outline';
  }
};

export const clampAccountBalance = (account: FinanceAccount, nextBalance: number): number => {
  if (isLiabilityKind(account.kind)) {
    return nextBalance;
  }
  return Math.max(nextBalance, 0);
};

/** Recalcula balance de inversión a partir de quantity × lastPrice. */
export const syncInvestmentBalance = (account: FinanceAccount): FinanceAccount => {
  if (!isInvestmentKind(account.kind)) return account;
  const qty = account.quantity;
  const price = account.lastPrice;
  if (typeof qty !== 'number' || typeof price !== 'number') return account;
  const currency = account.priceCurrency ?? account.currency;
  return {
    ...account,
    balance: qty * price,
    currency,
  };
};
