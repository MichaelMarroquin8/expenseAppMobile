import { monthKeyFromIso } from '../../core/utils/format';
import { isBalanceAdjustment } from '../../domain/accounts';
import { Transaction } from '../../domain/models';

export type EntryKind = 'expense' | 'income';
export type PeriodMode = 'month' | 'year';

export const transactionMatchesPeriod = (
  tx: Transaction,
  kind: EntryKind,
  periodMode: PeriodMode,
  periodId: string,
): boolean => {
  if (isBalanceAdjustment(tx) || tx.type !== kind) return false;
  if (periodMode === 'month') return monthKeyFromIso(tx.occurredAt) === periodId;
  return new Date(tx.occurredAt).getFullYear().toString() === periodId;
};

export const formatPeriodLabel = (periodMode: PeriodMode, periodId: string): string => {
  if (periodMode === 'year') return `Año ${periodId}`;
  const [year, month] = periodId.split('-').map(Number);
  if (!year || !month) return periodId;
  const label = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
