import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  parseSms,
  isLikelyDuplicate,
  isSameAmountAndInstant,
  matchesSavedMovement,
  reconcileDetections,
  SmsRawInput,
} from '../domain/smsParser';
import {
  NotificationRawInput,
  parseWalletNotification,
} from '../domain/notificationParser';
import { clampAccountBalance, isLiabilityKind } from '../domain/accounts';
import {
  AccountKind,
  AppSettings,
  Budget,
  FinanceAccount,
  PaymentCard,
  SavingsGoal,
  SmsDetection,
  Transaction,
} from '../domain/models';
import {
  DEFAULT_BANK_SMS_SHORT_CODES,
  DEFAULT_ENABLED_BANK_SOURCE_IDS,
  DEFAULT_NOTIFICATION_PACKAGES,
  resolveBankSources,
} from '../domain/bankSources';

const KNOWN_ACCOUNT_KINDS = new Set<AccountKind>([
  'default',
  'cash',
  'debit_card',
  'credit_card',
  'virtual',
  'investment',
  'receivable',
  'payable',
  'bank',
  'wallet',
  'broker',
]);

const unionById = <T extends { id: string }>(primary: T[], secondary: T[]): T[] => {
  const map = new Map<string, T>();
  for (const item of secondary) {
    if (item && typeof item.id === 'string') map.set(item.id, item);
  }
  for (const item of primary) {
    if (item && typeof item.id === 'string') map.set(item.id, item);
  }
  return Array.from(map.values());
};

const sanitizeAccount = (raw: unknown): FinanceAccount | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<FinanceAccount>;
  if (typeof item.id !== 'string' || typeof item.name !== 'string') return null;
  const kind =
    typeof item.kind === 'string' && KNOWN_ACCOUNT_KINDS.has(item.kind as AccountKind)
      ? (item.kind as AccountKind)
      : 'default';
  return {
    id: item.id,
    name: item.name,
    provider: typeof item.provider === 'string' ? item.provider : '',
    kind,
    balance: typeof item.balance === 'number' && Number.isFinite(item.balance) ? item.balance : 0,
    currency: typeof item.currency === 'string' && item.currency ? item.currency : 'COP',
    color: typeof item.color === 'string' && item.color ? item.color : '#2563EB',
    icon: typeof item.icon === 'string' ? item.icon : undefined,
    note: typeof item.note === 'string' ? item.note : undefined,
    last4: typeof item.last4 === 'string' && /^\d{4}$/.test(item.last4) ? item.last4 : undefined,
    excludeFromTotal: typeof item.excludeFromTotal === 'boolean' ? item.excludeFromTotal : undefined,
    symbol: typeof item.symbol === 'string' ? item.symbol : undefined,
    quantity: typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : undefined,
    lastPrice: typeof item.lastPrice === 'number' && Number.isFinite(item.lastPrice) ? item.lastPrice : undefined,
    priceCurrency: typeof item.priceCurrency === 'string' ? item.priceCurrency : undefined,
    priceUpdatedAt: typeof item.priceUpdatedAt === 'string' ? item.priceUpdatedAt : undefined,
  };
};

const mergeDetections = (
  incoming: SmsDetection[],
  existing: SmsDetection[],
  transactions: Transaction[],
): SmsDetection[] => {
  const existingMap = new Map(existing.map((item) => [item.id, item]));
  const processedIncoming = incoming.map((item) => {
    const prev = existingMap.get(item.id);
    if (!prev) return item;
    // Descartado se queda descartado: el mismo SMS no vuelve a pedir aprobación en cada sync.
    if (prev.status === 'discarded') return prev;
    // Aceptado solo sigue oculto si el gasto sigue en el registro (mismo aviso, o mismo monto y hora).
    if (prev.status === 'accepted' && matchesSavedMovement(prev, transactions)) return prev;
    return { ...item, status: 'pending' as const, duplicate: false };
  });

  const merged = [...processedIncoming, ...existing];
  const unique = merged.filter(
    (item, index) => merged.findIndex((other) => other.id === item.id) === index,
  );
  return reconcileDetections(unique, transactions).slice(0, 80);
};

export type CategoryKind = 'expense' | 'income';

interface FinanceState {
  onboardingDone: boolean;
  transactions: Transaction[];
  transactionCategories: string[];
  incomeCategories: string[];
  categoryIcons: Record<string, string>;
  accounts: FinanceAccount[];
  budgets: Budget[];
  goals: SavingsGoal[];
  cards: PaymentCard[];
  smsDetections: SmsDetection[];
  settings: AppSettings;
  finishOnboarding: () => void;
  addTransaction: (payload: Omit<Transaction, 'id'>) => void;
  addTransactionCategory: (category: string, kind?: CategoryKind) => void;
  removeTransactionCategory: (category: string, kind?: CategoryKind) => void;
  setCategoryIcon: (category: string, icon: string) => void;
  upsertAccount: (account: FinanceAccount) => void;
  deleteAccount: (id: string) => void;
  updateTransaction: (id: string, payload: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (budget: Budget) => void;
  deleteBudget: (id: string) => void;
  upsertGoal: (goal: SavingsGoal) => void;
  deleteGoal: (id: string) => void;
  addGoalContribution: (goalId: string, amount: number) => void;
  upsertCard: (card: PaymentCard) => void;
  deleteCard: (id: string) => void;
  processSmsBatch: (messages: SmsRawInput[]) => void;
  processNotificationBatch: (notifications: NotificationRawInput[]) => void;
  updateSmsDetection: (
    detectionId: string,
    payload: Partial<Pick<SmsDetection, 'amount' | 'merchant' | 'categoryGuess'>>,
  ) => void;
  acceptSms: (detectionId: string, accountId?: string) => void;
  discardSms: (detectionId: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const defaultTransactionCategories = [
  'Comida',
  'Transporte',
  'Supermercado',
  'Entretenimiento',
  'Servicios',
  'Otros',
];

const defaultIncomeCategories = [
  'Salario',
  'Freelance',
  'Inversiones',
  'Ventas',
  'Regalo',
  'Otros ingresos',
];

const defaultCategoryIcons: Record<string, string> = {
  Comida: 'fast-food-outline',
  Transporte: 'car-outline',
  Supermercado: 'basket-outline',
  Entretenimiento: 'game-controller-outline',
  Servicios: 'flash-outline',
  Otros: 'apps-outline',
  Salario: 'cash-outline',
  Freelance: 'briefcase-outline',
  Inversiones: 'trending-up-outline',
  Ventas: 'storefront-outline',
  Regalo: 'gift-outline',
  'Otros ingresos': 'wallet-outline',
};

const initialSettings: AppSettings = {
  currency: 'COP',
  colorScheme: 'system',
  remindersEnabled: true,
  enabledBankSourceIds: [...DEFAULT_ENABLED_BANK_SOURCE_IDS],
  bankSmsShortCodes: [...DEFAULT_BANK_SMS_SHORT_CODES],
  notificationPackages: [...DEFAULT_NOTIFICATION_PACKAGES],
  bridgeDebugEnabled: false,
  backgroundSyncEnabled: false,
};

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.round(Math.random() * 1000)}`;

const coerceBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
};

const applyAccountMovement = (
  accounts: FinanceAccount[],
  transaction: {
    accountId?: string;
    destinationAccountId?: string;
    type: Transaction['type'];
    amount: number;
  },
  mode: 'apply' | 'revert' = 'apply',
): FinanceAccount[] => {
  if (transaction.type === 'transfer') {
    if (!transaction.accountId || !transaction.destinationAccountId) return accounts;
    const factor = mode === 'apply' ? 1 : -1;
    return accounts.map((account) => {
      if (account.id === transaction.accountId) {
        // Salida de pasivo = más deuda (avance); salida de activo = menos saldo.
        const delta = isLiabilityKind(account.kind)
          ? transaction.amount * factor
          : -transaction.amount * factor;
        return {
          ...account,
          balance: clampAccountBalance(account, account.balance + delta),
        };
      }
      if (account.id === transaction.destinationAccountId) {
        // Entrada a pasivo = pago (menos deuda); entrada a activo = más saldo.
        const delta = isLiabilityKind(account.kind)
          ? -transaction.amount * factor
          : transaction.amount * factor;
        return {
          ...account,
          balance: clampAccountBalance(account, account.balance + delta),
        };
      }
      return account;
    });
  }

  if (!transaction.accountId) return accounts;
  return accounts.map((account) => {
    if (account.id !== transaction.accountId) return account;
    // En pasivos (TC), un gasto aumenta la deuda; un ingreso/pago la reduce.
    let direction = transaction.type === 'expense' ? -1 : 1;
    if (isLiabilityKind(account.kind)) {
      direction = transaction.type === 'expense' ? 1 : -1;
    }
    const signedAmount = direction * transaction.amount * (mode === 'apply' ? 1 : -1);
    return {
      ...account,
      balance: clampAccountBalance(account, account.balance + signedAmount),
    };
  });
};

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      onboardingDone: false,
      transactions: [],
      transactionCategories: defaultTransactionCategories,
      incomeCategories: defaultIncomeCategories,
      categoryIcons: defaultCategoryIcons,
      accounts: [],
      budgets: [],
      goals: [],
      cards: [],
      smsDetections: [],
      settings: initialSettings,
      finishOnboarding: () => set({ onboardingDone: true }),
      addTransaction: (payload) =>
        set((state) => {
          const transactions = [{ ...payload, id: createId('tx') }, ...state.transactions];
          return {
            transactions,
            accounts: applyAccountMovement(state.accounts, payload, 'apply'),
            smsDetections: reconcileDetections(state.smsDetections, transactions),
          };
        }),
      addTransactionCategory: (category, kind = 'expense') =>
        set((state) => {
          const normalized = category.trim();
          if (!normalized) return state;
          const listKey = kind === 'income' ? 'incomeCategories' : 'transactionCategories';
          const currentList = state[listKey];
          const alreadyExists = currentList.some(
            (item) => item.toLowerCase() === normalized.toLowerCase(),
          );
          if (alreadyExists) return state;
          return {
            [listKey]: [...currentList, normalized],
            categoryIcons: {
              ...state.categoryIcons,
              [normalized]: state.categoryIcons[normalized] ?? (kind === 'income' ? 'cash-outline' : 'pricetag-outline'),
            },
          };
        }),
      removeTransactionCategory: (category, kind = 'expense') =>
        set((state) => {
          const protectedCategories = ['Otros', 'Salario', 'Otros ingresos'];
          if (protectedCategories.includes(category)) return state;
          const nextExpenses =
            kind === 'expense'
              ? state.transactionCategories.filter((item) => item !== category)
              : state.transactionCategories;
          const nextIncomes =
            kind === 'income'
              ? state.incomeCategories.filter((item) => item !== category)
              : state.incomeCategories;
          const stillUsed = nextExpenses.includes(category) || nextIncomes.includes(category);
          return {
            transactionCategories: nextExpenses,
            incomeCategories: nextIncomes,
            categoryIcons: stillUsed
              ? state.categoryIcons
              : Object.fromEntries(
                  Object.entries(state.categoryIcons).filter(([key]) => key !== category),
                ),
          };
        }),
      setCategoryIcon: (category, icon) =>
        set((state) => ({
          categoryIcons: {
            ...state.categoryIcons,
            [category]: icon,
          },
        })),
      upsertAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts.filter((item) => item.id !== account.id), account],
        })),
      deleteAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((item) => item.id !== id),
        })),
      updateTransaction: (id, payload) =>
        set((state) => {
          const existing = state.transactions.find((tx) => tx.id === id);
          if (!existing) return state;
          const updated: Transaction = { ...existing, ...payload };
          const revertedAccounts = applyAccountMovement(state.accounts, existing, 'revert');
          const nextAccounts = applyAccountMovement(revertedAccounts, updated, 'apply');
          const transactions = state.transactions.map((tx) => (tx.id === id ? updated : tx));
          return {
            transactions,
            accounts: nextAccounts,
            smsDetections: reconcileDetections(state.smsDetections, transactions),
          };
        }),
      deleteTransaction: (id) =>
        set((state) => {
          const target = state.transactions.find((tx) => tx.id === id);
          if (!target) return state;
          const remainingTransactions = state.transactions.filter((tx) => tx.id !== id);
          const reopened = state.smsDetections.map((det) => {
            const linkedById = Boolean(target.detectionId && det.id === target.detectionId);
            const linkedByInstant =
              target.type !== 'income' && det.status !== 'pending' && isSameAmountAndInstant(det, target);
            if (!(linkedById || linkedByInstant)) return det;
            if (matchesSavedMovement(det, remainingTransactions)) return det;
            return { ...det, status: 'pending' as const, duplicate: false };
          });
          return {
            transactions: remainingTransactions,
            accounts: applyAccountMovement(state.accounts, target, 'revert'),
            smsDetections: reconcileDetections(reopened, remainingTransactions),
          };
        }),
      setBudget: (budget) =>
        set((state) => ({
          budgets: [...state.budgets.filter((item) => item.id !== budget.id), budget],
        })),
      deleteBudget: (id) =>
        set((state) => ({
          budgets: state.budgets.filter((item) => item.id !== id),
        })),
      upsertGoal: (goal) =>
        set((state) => ({
          goals: [...state.goals.filter((item) => item.id !== goal.id), goal],
        })),
      deleteGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((item) => item.id !== id),
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
      deleteCard: (id) =>
        set((state) => ({
          cards: state.cards.filter((item) => item.id !== id),
        })),
      processSmsBatch: (messages) =>
        set((state) => {
          const detections = messages.map((input) => {
            const parsed = parseSms(input);
            const card = parsed.accountLast4
              ? undefined
              : state.cards.find((item) => item.last4 === parsed.last4);
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

          return {
            smsDetections: mergeDetections(detections, state.smsDetections, state.transactions),
          };
        }),
      processNotificationBatch: (notifications) =>
        set((state) => {
          const detections = notifications.map((input) => {
            const parsed = parseWalletNotification(input);
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

          return {
            smsDetections: mergeDetections(detections, state.smsDetections, state.transactions),
          };
        }),
      updateSmsDetection: (detectionId, payload) =>
        set((state) => ({
          smsDetections: reconcileDetections(
            state.smsDetections.map((item) => (item.id === detectionId ? { ...item, ...payload } : item)),
            state.transactions,
          ),
        })),
      acceptSms: (detectionId, explicitAccountId) =>
        set((state) => {
          const detection = state.smsDetections.find((item) => item.id === detectionId);
          if (!detection || !detection.amount || detection.amount <= 0) return state;

          const linkedCard = detection.accountLast4
            ? undefined
            : detection.cardId
              ? state.cards.find((card) => card.id === detection.cardId)
              : detection.last4
                ? state.cards.find((card) => card.last4 === detection.last4)
                : undefined;
          const accountFromMask = detection.accountLast4
            ? state.accounts.find((account) => account.last4 === detection.accountLast4) ??
              state.accounts.find((account) =>
                `${account.name} ${account.provider} ${account.note ?? ''}`.includes(detection.accountLast4 ?? ''),
              )
            : undefined;
          const resolvedAccountId =
            explicitAccountId ??
            (detection.accountLast4 ? accountFromMask?.id : linkedCard ? linkedCard.accountId : state.accounts[0]?.id);

          const fromNotification = detection.channel === 'notification';
          const transaction: Transaction = {
            id: createId('tx'),
            type: 'expense',
            amount: detection.amount,
            currency: state.settings.currency,
            category: detection.categoryGuess ?? 'Otros',
            tags: [
              ...(fromNotification ? ['wallet', 'notification'] : ['sms']),
              ...(detection.accountLast4 ? ['transferencia'] : []),
            ],
            paymentMethod: linkedCard ? 'card' : 'transfer',
            cardId: linkedCard?.id,
            accountId: resolvedAccountId,
            merchant: detection.merchant ?? 'Comercio detectado',
            occurredAt: detection.occurredAt ?? new Date().toISOString(),
            recurring: false,
            source: fromNotification ? 'notification' : 'sms',
            detectionId: detection.id,
          };

          const nextTransactions = [transaction, ...state.transactions];
          return {
            transactions: nextTransactions,
            accounts: applyAccountMovement(state.accounts, transaction, 'apply'),
            smsDetections: reconcileDetections(
              state.smsDetections.map((item) =>
                item.id === detectionId ? { ...item, status: 'accepted' as const, duplicate: false } : item,
              ),
              nextTransactions,
            ),
          };
        }),
      discardSms: (detectionId) =>
        set((state) => {
          const target = state.smsDetections.find((item) => item.id === detectionId);
          const next = state.smsDetections.map((item) => {
            if (item.id === detectionId) return { ...item, status: 'discarded' as const, duplicate: false };
            if (target && item.status === 'pending' && isSameAmountAndInstant(item, target)) {
              return { ...item, status: 'discarded' as const, duplicate: false };
            }
            return item;
          });
          return { smsDetections: reconcileDetections(next, state.transactions) };
        }),
      updateSettings: (partial) =>
        set((state) => {
          const next = { ...state.settings, ...partial };
          if (partial.enabledBankSourceIds) {
            const resolved = resolveBankSources(partial.enabledBankSourceIds);
            next.enabledBankSourceIds = resolved.enabledIds;
            if (!partial.bankSmsShortCodes) next.bankSmsShortCodes = resolved.shortCodes;
            if (!partial.notificationPackages) next.notificationPackages = resolved.packages;
          }
          return { settings: next };
        }),
    }),
    {
      // v2: arranque sin datos demo (v1 traía semillas USD/cuentas/tarjetas).
      name: 'expenseapp-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<FinanceState>;
        const persistedSettings = (persisted.settings ?? {}) as Partial<AppSettings>;
        const enabledIds = Array.isArray(persistedSettings.enabledBankSourceIds)
          ? persistedSettings.enabledBankSourceIds.filter((id) => typeof id === 'string')
          : currentState.settings.enabledBankSourceIds;
        const resolved = resolveBankSources(
          enabledIds.length > 0 ? enabledIds : DEFAULT_ENABLED_BANK_SOURCE_IDS,
        );
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
          enabledBankSourceIds: resolved.enabledIds,
          bankSmsShortCodes:
            Array.isArray(persistedSettings.bankSmsShortCodes) &&
            persistedSettings.bankSmsShortCodes.length > 0
              ? persistedSettings.bankSmsShortCodes.filter((c) => typeof c === 'string')
              : resolved.shortCodes.length > 0
                ? resolved.shortCodes
                : [...DEFAULT_BANK_SMS_SHORT_CODES],
          notificationPackages:
            Array.isArray(persistedSettings.notificationPackages) &&
            persistedSettings.notificationPackages.length > 0
              ? persistedSettings.notificationPackages.filter((p) => typeof p === 'string')
              : resolved.packages.length > 0
                ? resolved.packages
                : [...DEFAULT_NOTIFICATION_PACKAGES],
          bridgeDebugEnabled: coerceBoolean(
            persistedSettings.bridgeDebugEnabled,
            currentState.settings.bridgeDebugEnabled,
          ),
          backgroundSyncEnabled: coerceBoolean(
            persistedSettings.backgroundSyncEnabled,
            currentState.settings.backgroundSyncEnabled,
          ),
        };

        const rawExpenseCategories =
          Array.isArray(persisted.transactionCategories) && persisted.transactionCategories.length > 0
            ? persisted.transactionCategories.filter((item) => item !== 'Salario')
            : currentState.transactionCategories;
        const rawIncomeCategories =
          Array.isArray(persisted.incomeCategories) && persisted.incomeCategories.length > 0
            ? persisted.incomeCategories
            : currentState.incomeCategories;

        const persistedTransactions = Array.isArray(persisted.transactions)
          ? persisted.transactions
          : currentState.transactions;
        const persistedDetections = Array.isArray(persisted.smsDetections)
          ? reconcileDetections(persisted.smsDetections, persistedTransactions)
          : currentState.smsDetections;

        return {
          ...currentState,
          ...persisted,
          transactions: persistedTransactions,
          smsDetections: persistedDetections,
          onboardingDone: coerceBoolean(persisted.onboardingDone, currentState.onboardingDone),
          transactionCategories:
            rawExpenseCategories.length > 0 ? rawExpenseCategories : currentState.transactionCategories,
          incomeCategories: rawIncomeCategories,
          categoryIcons: {
            ...defaultCategoryIcons,
            ...((persisted.categoryIcons as Record<string, string> | undefined) ?? {}),
          },
          accounts: unionById(
            currentState.accounts,
            Array.isArray(persisted.accounts)
              ? persisted.accounts
                  .map(sanitizeAccount)
                  .filter((item): item is FinanceAccount => item != null)
              : [],
          ),
          settings: safeSettings,
        };
      },
      partialize: (state) => ({
        onboardingDone: state.onboardingDone,
        transactions: state.transactions,
        transactionCategories: state.transactionCategories,
        incomeCategories: state.incomeCategories,
        categoryIcons: state.categoryIcons,
        accounts: state.accounts,
        budgets: state.budgets,
        goals: state.goals,
        cards: state.cards,
        smsDetections: state.smsDetections,
        settings: state.settings,
      }),
    },
  ),
);
