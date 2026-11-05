import {
  getAccountDisplayCurrency,
  getAccountDisplayValue,
  isInvestmentKind,
  isLiabilityKind,
  isLiquidKind,
} from './accounts';
import { summarizePositions } from './investments';
import { FinanceAccount, InvestmentHolding } from './models';

export type NetWorthSummary = {
  assets: number;
  liabilities: number;
  /** Efectivo, banco, débito y billeteras. No incluye inversiones ni deudas. */
  liquid: number;
  net: number;
  /** Falta convertir alguna cuenta porque todavía no hay tasa. */
  partial: boolean;
};

export const accountValueInBase = (
  account: FinanceAccount,
  holdings: InvestmentHolding[],
  baseCurrency: string,
  toBase: (amount: number, currency: string) => number,
): number => {
  if (!isInvestmentKind(account.kind)) {
    return toBase(getAccountDisplayValue(account), getAccountDisplayCurrency(account));
  }
  const summary = summarizePositions(
    account,
    holdings,
    (amount, currency) => toBase(amount, currency),
    baseCurrency,
  );
  if (summary.mixed && summary.currency === baseCurrency) return summary.amount;
  return toBase(summary.amount, summary.currency);
};

export const summarizeNetWorth = (
  accounts: FinanceAccount[],
  holdings: InvestmentHolding[],
  baseCurrency: string,
  toBase: (amount: number, currency: string) => number,
  ratesReady: boolean,
): NetWorthSummary => {
  let assets = 0;
  let liabilities = 0;
  let liquid = 0;
  let partial = false;

  for (const account of accounts) {
    if (account.excludeFromTotal) continue;
    const native = isInvestmentKind(account.kind)
      ? summarizePositions(account, holdings, undefined, baseCurrency)
      : null;
    const nativeAmount = native?.amount ?? getAccountDisplayValue(account);
    const nativeCurrency = native?.currency ?? getAccountDisplayCurrency(account);
    if (!ratesReady && nativeCurrency !== baseCurrency && nativeAmount !== 0) partial = true;

    const inBase = accountValueInBase(account, holdings, baseCurrency, toBase);
    if (isLiabilityKind(account.kind)) {
      liabilities += inBase;
    } else {
      assets += inBase;
      if (isLiquidKind(account.kind)) liquid += inBase;
    }
  }

  return { assets, liabilities, liquid, net: assets - liabilities, partial };
};
