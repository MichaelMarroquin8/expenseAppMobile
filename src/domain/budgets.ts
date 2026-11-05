import { formatMoney, monthKeyFromIso } from '../core/utils/format';
import { isBalanceAdjustment } from './accounts';
import { Budget, Transaction } from './models';

const GLOBAL = 'GLOBAL';

export type BudgetLevel = 'warning' | 'over';

export type BudgetSnapshot = {
  category: string;
  label: string;
  spent: number;
  limit: number;
  ratio: number;
  level: BudgetLevel | 'ok';
};

export const budgetLabel = (category: string): string =>
  category === GLOBAL ? 'Presupuesto general' : category;

export const spentInMonth = (
  transactions: Transaction[],
  month: string,
  category?: string,
): number =>
  transactions.reduce((sum, tx) => {
    if (isBalanceAdjustment(tx) || tx.type !== 'expense') return sum;
    if (monthKeyFromIso(tx.occurredAt) !== month) return sum;
    if (category && category !== GLOBAL && tx.category !== category) return sum;
    return sum + tx.amount;
  }, 0);

export const budgetSnapshots = (budgets: Budget[], transactions: Transaction[], month: string): BudgetSnapshot[] =>
  budgets
    .filter((budget) => budget.monthKey === month && budget.limit > 0)
    .map((budget) => {
      const spent = spentInMonth(transactions, month, budget.category);
      const ratio = spent / budget.limit;
      const level: BudgetSnapshot['level'] = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok';
      return {
        category: budget.category,
        label: budgetLabel(budget.category),
        spent,
        limit: budget.limit,
        ratio,
        level,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);

/**
 * Avisa solo cuando este gasto cruza el 80 % o el 100 %.
 * `alreadyIncluded` es true si el gasto ya está dentro de `transactions`.
 */
export const budgetCrossingMessage = (
  budgets: Budget[],
  transactions: Transaction[],
  expense: { amount: number; category: string; occurredAt: string; alreadyIncluded: boolean },
  currency: string,
): string | null => {
  if (!Number.isFinite(expense.amount) || expense.amount <= 0) return null;
  const month = monthKeyFromIso(expense.occurredAt);
  const lines: string[] = [];

  for (const budget of budgets) {
    if (budget.monthKey !== month || budget.limit <= 0) continue;
    if (budget.category !== GLOBAL && budget.category !== expense.category) continue;
    const spentAfter =
      spentInMonth(transactions, month, budget.category) + (expense.alreadyIncluded ? 0 : expense.amount);
    const spentBefore = spentAfter - expense.amount;
    const label = budgetLabel(budget.category);
    if (spentBefore < budget.limit && spentAfter >= budget.limit) {
      lines.push(
        `${label}: este gasto lo deja en ${formatMoney(spentAfter, currency)} de ${formatMoney(budget.limit, currency)}.`,
      );
      continue;
    }
    if (spentBefore < budget.limit * 0.8 && spentAfter >= budget.limit * 0.8) {
      const percent = Math.round((spentAfter / budget.limit) * 100);
      lines.push(`${label}: este gasto lo deja al ${percent} %.`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : null;
};
