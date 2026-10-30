import type { ReceivableDebt, ReceivablePayment } from './models';

const MONEY_EPSILON = 0.009;

export const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export const moneyDiffers = (left: number, right: number): boolean =>
  Math.abs(left - right) > MONEY_EPSILON;

export const debtPaid = (debt: ReceivableDebt): number =>
  roundMoney(debt.payments.reduce((sum, payment) => sum + payment.amount, 0));

export const debtOutstanding = (debt: ReceivableDebt): number =>
  roundMoney(Math.max(0, debt.principal - debtPaid(debt)));

export const isDebtSettled = (debt: ReceivableDebt): boolean => debtOutstanding(debt) <= MONEY_EPSILON;

export const sumOutstanding = (debts: ReceivableDebt[]): number =>
  roundMoney(debts.reduce((sum, debt) => sum + debtOutstanding(debt), 0));

export const sumPaid = (debts: ReceivableDebt[]): number =>
  roundMoney(debts.reduce((sum, debt) => sum + debtPaid(debt), 0));

/** Parte del saldo de la cuenta que todavía no está asignada a una persona. */
export const unallocatedReceivable = (balance: number, debts: ReceivableDebt[]): number =>
  roundMoney(Math.max(0, balance - sumOutstanding(debts)));

export const debtsForAccount = (debts: ReceivableDebt[], accountId: string): ReceivableDebt[] =>
  debts.filter((debt) => debt.accountId === accountId);

/**
 * Subir el desglose primero consume el saldo que aún no tenía persona.
 * Bajarlo (abono, menos principal o borrar la deuda) reduce el saldo de la cuenta.
 */
export const reconcileReceivableBalance = (
  currentBalance: number,
  previous: ReceivableDebt[],
  next: ReceivableDebt[],
): number => {
  const prevTracked = sumOutstanding(previous);
  const nextTracked = sumOutstanding(next);
  const delta = roundMoney(nextTracked - prevTracked);
  if (delta > MONEY_EPSILON) {
    const unallocated = Math.max(0, currentBalance - prevTracked);
    const consumed = Math.min(unallocated, delta);
    return roundMoney(currentBalance + (delta - consumed));
  }
  if (delta < -MONEY_EPSILON) {
    return roundMoney(Math.max(0, currentBalance + delta));
  }
  return roundMoney(currentBalance);
};

const sanitizePayment = (raw: unknown): ReceivablePayment | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<ReceivablePayment>;
  if (typeof item.id !== 'string' || !item.id) return null;
  if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount <= 0) return null;
  if (typeof item.occurredAt !== 'string' || Number.isNaN(new Date(item.occurredAt).getTime())) return null;
  const payment: ReceivablePayment = {
    id: item.id,
    amount: roundMoney(item.amount),
    occurredAt: item.occurredAt,
  };
  if (typeof item.note === 'string' && item.note.trim()) payment.note = item.note.trim();
  return payment;
};

/** Descarta deudas corruptas o con abonos mayores al monto prestado. */
export const normalizeReceivableDebt = (debt: ReceivableDebt): ReceivableDebt | null => {
  const personName = debt.personName?.trim?.() ?? '';
  if (!debt.id || !debt.accountId || !personName) return null;
  if (typeof debt.principal !== 'number' || !Number.isFinite(debt.principal) || debt.principal <= 0) return null;
  if (typeof debt.lentAt !== 'string' || Number.isNaN(new Date(debt.lentAt).getTime())) return null;
  const payments = (Array.isArray(debt.payments) ? debt.payments : [])
    .map((payment) => sanitizePayment(payment))
    .filter((payment): payment is ReceivablePayment => payment != null);
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (paid - debt.principal > MONEY_EPSILON) return null;
  const normalized: ReceivableDebt = {
    id: debt.id,
    accountId: debt.accountId,
    personName,
    principal: roundMoney(debt.principal),
    lentAt: debt.lentAt,
    payments,
  };
  if (typeof debt.note === 'string' && debt.note.trim()) normalized.note = debt.note.trim();
  return normalized;
};

export const sanitizeReceivableDebt = (raw: unknown): ReceivableDebt | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<ReceivableDebt>;
  if (typeof item.id !== 'string' || typeof item.accountId !== 'string') return null;
  if (typeof item.personName !== 'string' || typeof item.principal !== 'number') return null;
  if (typeof item.lentAt !== 'string') return null;
  return normalizeReceivableDebt({
    id: item.id,
    accountId: item.accountId,
    personName: item.personName,
    principal: item.principal,
    lentAt: item.lentAt,
    note: typeof item.note === 'string' ? item.note : undefined,
    payments: Array.isArray(item.payments) ? item.payments : [],
  });
};
