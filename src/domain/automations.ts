import { monthKey } from '../core/utils/format';
import { SavingsGoal, Transaction } from './models';

const LOOKAHEAD_GUARD = 2000;
const LOOKBACK_DAYS = 93;

type RecurringRule = NonNullable<Transaction['recurringRule']>;

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dateKey = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const shift = (date: Date, rule: RecurringRule): Date => {
  const next = new Date(date);
  if (rule === 'daily') next.setDate(next.getDate() + 1);
  else if (rule === 'weekly') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return startOfDay(next);
};

const occurrenceStamp = (day: Date, templateIso: string): string => {
  const template = new Date(templateIso);
  const hours = Number.isNaN(template.getTime()) ? 12 : template.getHours();
  const minutes = Number.isNaN(template.getTime()) ? 0 : template.getMinutes();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0).toISOString();
};

const cloneOccurrence = (template: Transaction, day: Date, id: string): Transaction => ({
  id,
  type: template.type,
  amount: template.amount,
  currency: template.currency,
  originalAmount: template.originalAmount,
  originalCurrency: template.originalCurrency,
  exchangeRate: template.exchangeRate,
  category: template.category,
  subcategory: template.subcategory,
  note: template.note,
  tags: template.tags ?? [],
  paymentMethod: template.paymentMethod,
  cardId: template.cardId,
  accountId: template.accountId,
  destinationAccountId: template.destinationAccountId,
  merchant: template.merchant,
  occurredAt: occurrenceStamp(day, template.occurredAt),
  recurring: false,
  source: 'manual',
  recurringSourceId: template.id,
});

/**
 * Crea las copias vencidas de cada movimiento recurrente.
 * No rellena más de unos tres meses atrás y no vuelve a crear una copia borrada:
 * el movimiento original recuerda los periodos ya generados.
 */
export const catchUpRecurring = (
  transactions: Transaction[],
  now = new Date(),
): { transactions: Transaction[]; created: Transaction[] } => {
  const created: Transaction[] = [];
  const existingIds = new Set(transactions.map((tx) => tx.id));
  const today = startOfDay(now);
  const horizon = startOfDay(now);
  horizon.setDate(horizon.getDate() - LOOKBACK_DAYS);
  let changed = false;

  const next = transactions.map((template) => {
    if (!template.recurring || !template.recurringRule || template.recurringSourceId) return template;
    const origin = startOfDay(new Date(template.occurredAt));
    if (Number.isNaN(origin.getTime())) return template;

    let cursor = shift(origin, template.recurringRule);
    let guard = 0;
    while (cursor < horizon && guard < LOOKAHEAD_GUARD) {
      cursor = shift(cursor, template.recurringRule);
      guard += 1;
    }

    const seen = new Set(Array.isArray(template.generatedPeriods) ? template.generatedPeriods : []);
    const periodKeys = [...seen];
    let templateChanged = false;
    while (cursor <= today && guard < LOOKAHEAD_GUARD) {
      const key = dateKey(cursor);
      const id = `recur_${template.id}_${key}`;
      if (!seen.has(key)) {
        seen.add(key);
        periodKeys.push(key);
        templateChanged = true;
        if (!existingIds.has(id)) {
          created.push(cloneOccurrence(template, cursor, id));
          existingIds.add(id);
        }
      }
      cursor = shift(cursor, template.recurringRule);
      guard += 1;
    }

    if (!templateChanged) return template;
    changed = true;
    return { ...template, generatedPeriods: periodKeys };
  });

  if (!changed) return { transactions, created: [] };
  const newestFirst = [...created].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  return { transactions: [...newestFirst, ...next], created };
};

/**
 * Suma el aporte mensual una sola vez por mes, al abrir la app en un mes nuevo.
 * El mes en que se crea la meta no se cobra: solo queda marcado.
 */
export const applyMonthlyGoalContributions = (goals: SavingsGoal[], now = new Date()): SavingsGoal[] => {
  const month = monthKey(now);
  let changed = false;
  const next = goals.map((goal) => {
    const auto = goal.autoContribution;
    if (typeof auto !== 'number' || !Number.isFinite(auto) || auto <= 0) return goal;
    const stamp = typeof goal.lastAutoAppliedMonth === 'string' ? goal.lastAutoAppliedMonth : undefined;
    if (stamp === month) return goal;
    if (goal.currentAmount >= goal.targetAmount || !stamp) {
      changed = true;
      return { ...goal, lastAutoAppliedMonth: month };
    }
    if (stamp > month) return goal;
    changed = true;
    return {
      ...goal,
      currentAmount: Math.min(goal.targetAmount, goal.currentAmount + auto),
      lastAutoAppliedMonth: month,
    };
  });
  return changed ? next : goals;
};
