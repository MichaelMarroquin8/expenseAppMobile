import { formatMoney } from '../core/utils/format';
import { cardDebt } from './cardLedger';
import { budgetSnapshots } from './budgets';
import { Budget, FinanceAccount, PaymentCard, SavingsGoal, Transaction } from './models';

export type FinanceReminder = {
  id: string;
  tone: 'warning' | 'danger' | 'primary';
  title: string;
  body: string;
};

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const daysUntilMonthDay = (day: number, now: Date): number | null => {
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  const today = startOfDay(now);
  const clamp = (year: number, month: number) => {
    const dim = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, dim));
  };
  let due = clamp(today.getFullYear(), today.getMonth());
  if (due < today) due = clamp(today.getFullYear(), today.getMonth() + 1);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
};

const dayPhrase = (days: number): string => {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'mañana';
  return `en ${days} días`;
};

export const buildReminders = (
  input: {
    cards: PaymentCard[];
    accounts: FinanceAccount[];
    budgets: Budget[];
    transactions: Transaction[];
    goals: SavingsGoal[];
    now?: Date;
  },
  currency: string,
): FinanceReminder[] => {
  const now = input.now ?? new Date();
  const reminders: FinanceReminder[] = [];
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const card of input.cards) {
    if (card.cardType !== 'credit') continue;
    if (typeof card.dueDay === 'number') {
      const days = daysUntilMonthDay(card.dueDay, now);
      const debt = cardDebt(card, input.accounts);
      if (days != null && days <= 3 && debt > 0) {
        reminders.push({
          id: `due-${card.id}`,
          tone: days <= 1 ? 'danger' : 'warning',
          title: `Pago de ${card.alias}`,
          body: `La deuda es ${formatMoney(debt, currency)} y el pago es ${dayPhrase(days)}.`,
        });
      }
    }
    if (typeof card.statementDay === 'number') {
      const days = daysUntilMonthDay(card.statementDay, now);
      if (days != null && days <= 1) {
        reminders.push({
          id: `statement-${card.id}`,
          tone: 'primary',
          title: `Corte de ${card.alias}`,
          body: `El corte es ${dayPhrase(days)}.`,
        });
      }
    }
  }

  for (const snapshot of budgetSnapshots(input.budgets, input.transactions, month)) {
    if (snapshot.level === 'ok') continue;
    reminders.push({
      id: `budget-${snapshot.category}`,
      tone: snapshot.level === 'over' ? 'danger' : 'warning',
      title: snapshot.label,
      body:
        snapshot.level === 'over'
          ? `Vas en ${formatMoney(snapshot.spent, currency)} de ${formatMoney(snapshot.limit, currency)}.`
          : `Llevas ${Math.round(snapshot.ratio * 100)} % de ${formatMoney(snapshot.limit, currency)}.`,
    });
  }

  const today = startOfDay(now);
  for (const goal of input.goals) {
    if (!goal.targetDate || goal.currentAmount >= goal.targetAmount) continue;
    const target = startOfDay(new Date(goal.targetDate));
    if (Number.isNaN(target.getTime())) continue;
    const days = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (days > 14) continue;
    const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
    reminders.push({
      id: `goal-${goal.id}`,
      tone: days < 0 ? 'danger' : 'warning',
      title: goal.title,
      body:
        days < 0
          ? `La fecha ya pasó y faltan ${formatMoney(remaining, currency)}.`
          : `Faltan ${formatMoney(remaining, currency)} y la fecha es ${dayPhrase(days)}.`,
    });
  }

  return reminders;
};
