import { getAccountDisplayCurrency, getAccountDisplayValue, isInvestmentKind } from './accounts';
import type { FinanceAccount, InvestmentHolding } from './models';

export type PositionSummary = {
  amount: number;
  currency: string;
  /** Hay acciones en más de una moneda y el total ya está en la moneda base, si se pudo convertir. */
  mixed: boolean;
  positionCount: number;
};

export const holdingsForAccount = (
  holdings: InvestmentHolding[],
  accountId: string,
): InvestmentHolding[] => holdings.filter((holding) => holding.accountId === accountId);

export const holdingMarketValue = (holding: InvestmentHolding): number | null => {
  const quantity = holding.quantity;
  const price = holding.lastPrice;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) return null;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null;
  return quantity * price;
};

const holdingCurrency = (holding: InvestmentHolding, fallback: string): string =>
  (holding.priceCurrency || fallback).toUpperCase();

const stripLegacyPosition = (account: FinanceAccount): FinanceAccount => {
  const next: FinanceAccount = { ...account };
  delete next.symbol;
  delete next.quantity;
  delete next.lastPrice;
  delete next.priceUpdatedAt;
  return next;
};

/** Recalcula el saldo de la cuenta a partir de sus acciones. */
export const syncInvestmentAccount = (
  account: FinanceAccount,
  holdings: InvestmentHolding[],
): FinanceAccount => {
  if (!isInvestmentKind(account.kind)) return account;
  const positions = holdingsForAccount(holdings, account.id);
  if (positions.length === 0) return account;

  const parts = positions.flatMap((holding) => {
    const amount = holdingMarketValue(holding);
    if (amount == null) return [];
    return [{ amount, currency: holdingCurrency(holding, account.currency) }];
  });
  if (parts.length === 0) return stripLegacyPosition(account);

  const next = stripLegacyPosition(account);
  const currencies = new Set(parts.map((part) => part.currency));
  if (currencies.size === 1) {
    const currency = parts[0].currency;
    return {
      ...next,
      balance: parts.reduce((sum, part) => sum + part.amount, 0),
      priceCurrency: currency,
    };
  }

  const matching = parts.filter((part) => part.currency === account.currency.toUpperCase());
  delete next.priceCurrency;
  return {
    ...next,
    balance: matching.reduce((sum, part) => sum + part.amount, 0),
  };
};

/**
 * Total visible de una cuenta de inversión.
 * Si todas las acciones cotizan en la misma moneda, el total va en esa moneda.
 * Si no, y hay tasas, el total va en la moneda base.
 */
export const summarizePositions = (
  account: FinanceAccount,
  holdings: InvestmentHolding[],
  toBase?: (amount: number, currency: string) => number,
  baseCurrency?: string,
): PositionSummary => {
  const positions = holdingsForAccount(holdings, account.id);
  const parts = positions.flatMap((holding) => {
    const amount = holdingMarketValue(holding);
    if (amount == null) return [];
    return [{ amount, currency: holdingCurrency(holding, account.currency) }];
  });

  if (parts.length === 0) {
    return {
      amount: getAccountDisplayValue(account),
      currency: getAccountDisplayCurrency(account),
      mixed: false,
      positionCount: positions.length,
    };
  }

  const currencies = new Set(parts.map((part) => part.currency));
  if (currencies.size === 1) {
    return {
      amount: parts.reduce((sum, part) => sum + part.amount, 0),
      currency: parts[0].currency,
      mixed: false,
      positionCount: positions.length,
    };
  }

  if (toBase && baseCurrency) {
    return {
      amount: parts.reduce((sum, part) => sum + toBase(part.amount, part.currency), 0),
      currency: baseCurrency,
      mixed: true,
      positionCount: positions.length,
    };
  }

  const matching = parts.filter((part) => part.currency === account.currency.toUpperCase());
  return {
    amount: matching.reduce((sum, part) => sum + part.amount, 0),
    currency: account.currency,
    mixed: true,
    positionCount: positions.length,
  };
};

/**
 * Pasa a una acción el ticker que antes vivía en la cuenta.
 * Así Hapi, XTB o Trii siguen existiendo y la acción queda dentro.
 */
export const absorbLegacyPositions = (
  accounts: FinanceAccount[],
  holdings: InvestmentHolding[],
): { accounts: FinanceAccount[]; holdings: InvestmentHolding[] } => {
  const nextHoldings = [...holdings];
  const nextAccounts = accounts.map((account) => {
    if (!isInvestmentKind(account.kind)) return account;
    const symbol = account.symbol?.trim().toUpperCase();
    const quantity = account.quantity;
    if (symbol && typeof quantity === 'number' && quantity > 0) {
      const exists = nextHoldings.some(
        (holding) => holding.accountId === account.id && holding.symbol.toUpperCase() === symbol,
      );
      if (!exists) {
        const holding: InvestmentHolding = {
          id: `hold_legacy_${account.id}`,
          accountId: account.id,
          name: symbol,
          symbol,
          quantity,
          priceCurrency: (account.priceCurrency || account.currency).toUpperCase(),
        };
        if (typeof account.lastPrice === 'number' && Number.isFinite(account.lastPrice)) {
          holding.lastPrice = account.lastPrice;
        }
        if (account.priceUpdatedAt) holding.priceUpdatedAt = account.priceUpdatedAt;
        nextHoldings.push(holding);
      }
    }
    return syncInvestmentAccount(account, nextHoldings);
  });
  return { accounts: nextAccounts, holdings: nextHoldings };
};

export const normalizeInvestmentHolding = (holding: InvestmentHolding): InvestmentHolding | null => {
  const symbol = holding.symbol?.trim?.().toUpperCase() ?? '';
  const name = holding.name?.trim?.() || symbol;
  if (!holding.id || !holding.accountId || !symbol || !name) return null;
  if (typeof holding.quantity !== 'number' || !Number.isFinite(holding.quantity) || holding.quantity <= 0) {
    return null;
  }
  const normalized: InvestmentHolding = {
    id: holding.id,
    accountId: holding.accountId,
    name,
    symbol,
    quantity: holding.quantity,
  };
  if (typeof holding.lastPrice === 'number' && Number.isFinite(holding.lastPrice) && holding.lastPrice >= 0) {
    normalized.lastPrice = holding.lastPrice;
  }
  if (typeof holding.priceCurrency === 'string' && holding.priceCurrency.trim()) {
    normalized.priceCurrency = holding.priceCurrency.trim().toUpperCase();
  }
  if (typeof holding.priceUpdatedAt === 'string' && holding.priceUpdatedAt) {
    normalized.priceUpdatedAt = holding.priceUpdatedAt;
  }
  if (typeof holding.note === 'string' && holding.note.trim()) normalized.note = holding.note.trim();
  return normalized;
};

export const sanitizeInvestmentHolding = (raw: unknown): InvestmentHolding | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<InvestmentHolding>;
  if (typeof item.id !== 'string' || typeof item.accountId !== 'string') return null;
  if (typeof item.symbol !== 'string' || typeof item.quantity !== 'number') return null;
  return normalizeInvestmentHolding({
    id: item.id,
    accountId: item.accountId,
    name: typeof item.name === 'string' ? item.name : item.symbol,
    symbol: item.symbol,
    quantity: item.quantity,
    lastPrice: typeof item.lastPrice === 'number' ? item.lastPrice : undefined,
    priceCurrency: typeof item.priceCurrency === 'string' ? item.priceCurrency : undefined,
    priceUpdatedAt: typeof item.priceUpdatedAt === 'string' ? item.priceUpdatedAt : undefined,
    note: typeof item.note === 'string' ? item.note : undefined,
  });
};
