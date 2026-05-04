import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { monthKey } from '../core/utils/format';
import { parseSms, isLikelyDuplicate } from '../domain/smsParser';
import { AppSettings, Budget, PaymentCard, SavingsGoal, SmsDetection, Transaction } from '../domain/models';

interface FinanceState {
  onboardingDone: boolean;
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  cards: PaymentCard[];
  smsDetections: SmsDetection[];
  settings: AppSettings;
  finishOnboarding: () => void;
  addTransaction: (payload: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, payload: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (budget: Budget) => void;
  upsertGoal: (goal: SavingsGoal) => void;
  addGoalContribution: (goalId: string, amount: number) => void;
  upsertCard: (card: PaymentCard) => void;
  processSmsBatch: (messages: string[]) => void;
  acceptSms: (detectionId: string) => void;
  discardSms: (detectionId: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const currentMonth = monthKey();

const seedCards: PaymentCard[] = [
  {
    id: 'card_1',
    alias: 'Nu Principal',
    bank: 'Nu',
    cardType: 'credit',
    last4: '4421',
    color: '#8B5CF6',
    icon: 'card-outline',
    limit: 22000,
    statementDay: 23,
    dueDay: 8,
  },
  {
    id: 'card_2',
    alias: 'BBVA Debito',
    bank: 'BBVA',
    cardType: 'debit',
    last4: '8844',
    color: '#2563EB',
    icon: 'wallet-outline',
  },
];

const seedTransactions: Transaction[] = [
  {
    id: 'tx_1',
    type: 'income',
    amount: 2800,
    currency: 'USD',
    category: 'Salario',
    tags: ['fijo'],
    paymentMethod: 'transfer',
    merchant: 'Empresa',
    occurredAt: new Date().toISOString(),
    recurring: true,
    recurringRule: 'monthly',
    source: 'manual',
  },
  {
    id: 'tx_2',
    type: 'expense',
    amount: 74,
    currency: 'USD',
    category: 'Comida',
    tags: ['delivery'],
    paymentMethod: 'card',
    cardId: 'card_1',
    merchant: 'Uber Eats',
    occurredAt: new Date(Date.now() - 86400000).toISOString(),
    recurring: false,
    source: 'sms',
  },
  {
    id: 'tx_3',
    type: 'expense',
    amount: 38,
    currency: 'USD',
    category: 'Entretenimiento',
    tags: ['suscripciones'],
    paymentMethod: 'card',
    cardId: 'card_2',
    merchant: 'Spotify',
    occurredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    recurring: true,
    recurringRule: 'monthly',
    source: 'manual',
  },
];

const seedBudgets: Budget[] = [
  { id: 'budget_global', category: 'GLOBAL', limit: 1800, monthKey: currentMonth },
  { id: 'budget_food', category: 'Comida', limit: 350, monthKey: currentMonth },
  { id: 'budget_transport', category: 'Transporte', limit: 200, monthKey: currentMonth },
];

const seedGoals: SavingsGoal[] = [
  { id: 'goal_1', title: 'Fondo de emergencia', targetAmount: 3000, currentAmount: 900 },
  { id: 'goal_2', title: 'Vacaciones', targetAmount: 1400, currentAmount: 460, autoContribution: 75 },
];

const initialSettings: AppSettings = {
  currency: 'USD',
  colorScheme: 'system',
  remindersEnabled: true,
};

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.round(Math.random() * 1000)}`;

const coerceBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
};

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      onboardingDone: false,
      transactions: seedTransactions,
      budgets: seedBudgets,
      goals: seedGoals,
      cards: seedCards,
      smsDetections: [],
      settings: initialSettings,
      finishOnboarding: () => set({ onboardingDone: true }),
      addTransaction: (payload) =>
        set((state) => ({
          transactions: [{ ...payload, id: createId('tx') }, ...state.transactions],
        })),
      updateTransaction: (id, payload) =>
        set((state) => ({
          transactions: state.transactions.map((tx) => (tx.id === id ? { ...tx, ...payload } : tx)),
        })),
      deleteTransaction: (id) =>
        set((state) => ({ transactions: state.transactions.filter((tx) => tx.id !== id) })),
      setBudget: (budget) =>
        set((state) => ({
          budgets: [...state.budgets.filter((item) => item.id !== budget.id), budget],
        })),
      upsertGoal: (goal) =>
        set((state) => ({
          goals: [...state.goals.filter((item) => item.id !== goal.id), goal],
        })),
      addGoalContribution: (goalId, amount) =>
        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === goalId
              ? { ...goal, currentAmount: Math.min(goal.currentAmount + Math.max(0, amount), goal.targetAmount) }
              : goal,
          ),
        })),
      upsertCard: (card) =>
        set((state) => ({
          cards: [...state.cards.filter((item) => item.id !== card.id), card],
        })),
      processSmsBatch: (messages) =>
        set((state) => {
          const detections = messages.map((message) => {
            const parsed = parseSms(message);
            const card = state.cards.find((item) => item.last4 === parsed.last4);
            const candidate: SmsDetection = {
              ...parsed,
              cardId: card?.id,
              status: 'pending',
              duplicate: false,
            };
            return {
              ...candidate,
              duplicate: isLikelyDuplicate(candidate, state.transactions, state.smsDetections),
            };
          });

          const unique = detections.filter(
            (item, index) => detections.findIndex((other) => other.id === item.id) === index,
          );

          return {
            smsDetections: [...unique, ...state.smsDetections].slice(0, 50),
          };
        }),
      acceptSms: (detectionId) =>
        set((state) => {
          const detection = state.smsDetections.find((item) => item.id === detectionId);
          if (!detection || detection.duplicate || !detection.amount) return state;

          const transaction: Transaction = {
            id: createId('tx'),
            type: 'expense',
            amount: detection.amount,
            currency: state.settings.currency,
            category: detection.categoryGuess ?? 'Otros',
            tags: ['sms'],
            paymentMethod: detection.cardId ? 'card' : 'transfer',
            cardId: detection.cardId,
            merchant: detection.merchant ?? 'Comercio detectado',
            occurredAt: detection.occurredAt ?? new Date().toISOString(),
            recurring: false,
            source: 'sms',
          };

          return {
            transactions: [transaction, ...state.transactions],
            smsDetections: state.smsDetections.map((item) =>
              item.id === detectionId ? { ...item, status: 'accepted' } : item,
            ),
          };
        }),
      discardSms: (detectionId) =>
        set((state) => ({
          smsDetections: state.smsDetections.map((item) =>
            item.id === detectionId ? { ...item, status: 'discarded' } : item,
          ),
        })),
      updateSettings: (settings) =>
        set((state) => ({ settings: { ...state.settings, ...settings } })),
    }),
    {
      name: 'expenseapp-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<FinanceState>;
        const persistedSettings = (persisted.settings ?? {}) as Partial<AppSettings>;
        const safeSettings: AppSettings = {
          currency:
            typeof persistedSettings.currency === 'string'
              ? persistedSettings.currency
              : currentState.settings.currency,
          colorScheme:
            persistedSettings.colorScheme === 'light' ||
            persistedSettings.colorScheme === 'dark' ||
            persistedSettings.colorScheme === 'system'
              ? persistedSettings.colorScheme
              : currentState.settings.colorScheme,
          remindersEnabled: coerceBoolean(
            persistedSettings.remindersEnabled,
            currentState.settings.remindersEnabled,
          ),
        };

        return {
          ...currentState,
          ...persisted,
          onboardingDone: coerceBoolean(persisted.onboardingDone, currentState.onboardingDone),
          settings: safeSettings,
        };
      },
      partialize: (state) => ({
        onboardingDone: state.onboardingDone,
        transactions: state.transactions,
        budgets: state.budgets,
        goals: state.goals,
        cards: state.cards,
        smsDetections: state.smsDetections,
        settings: state.settings,
      }),
    },
  ),
);
