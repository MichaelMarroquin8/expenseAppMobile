import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  convertToBase,
  getExchangeRates,
  getUnitsOfBasePerOne,
} from '../../backend/exchangeRates';
import { ConfirmModal } from '../../components/ui';
import { findCurrency } from '../../core/constants/currencies';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import {
  formatAmountInput,
  formatMoney,
  getCurrencyFractionDigits,
  parseAmountInput,
} from '../../core/utils/format';
import {
  accountSupportsMovement,
  defaultIconForKind,
  getAccountDisplayCurrency,
  getAccountDisplayValue,
  isLiabilityKind,
  type AccountMovementRole,
} from '../../domain/accounts';
import { Transaction } from '../../domain/models';
import { useFinanceStore } from '../../store/useFinanceStore';
import { TransactionCurrencyPicker } from './TransactionCurrencyPicker';

interface QuickAddTransactionModalProps {
  open: boolean;
  onClose: () => void;
  initialType?: 'income' | 'expense' | 'transfer';
  editingTransaction?: Transaction | null;
  presetAccountId?: string;
  presetDestinationAccountId?: string;
}

const formatDateLabel = (date: Date) =>
  new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const toLocalDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDateInput = (input: string): Date | null => {
  const normalized = input.trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatMonthLabel = (date: Date) =>
  new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(date);

const buildCalendarDays = (baseMonth: Date): Date[] => {
  const year = baseMonth.getFullYear();
  const month = baseMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const leading = (firstDay.getDay() + 6) % 7; // Monday = 0
  const start = new Date(year, month, 1 - leading);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

const PROTECTED_CATEGORIES = ['Otros', 'Salario', 'Otros ingresos'];

const sourceRoleFor = (movement: 'income' | 'expense' | 'transfer'): AccountMovementRole =>
  movement === 'income' ? 'income_destination' : movement === 'transfer' ? 'transfer_source' : 'expense_source';

const CATEGORY_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
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

export function QuickAddTransactionModal({
  open,
  onClose,
  initialType = 'expense',
  editingTransaction = null,
  presetAccountId,
  presetDestinationAccountId,
}: QuickAddTransactionModalProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const defaultCurrency = useFinanceStore((state) => state.settings.currency);
  const expenseCategories = useFinanceStore((state) => state.transactionCategories);
  const incomeCategories = useFinanceStore((state) => state.incomeCategories);
  const categoryIcons = useFinanceStore((state) => state.categoryIcons);
  const accounts = useFinanceStore((state) => state.accounts);
  const cards = useFinanceStore((state) => state.cards);
  const addTransactionCategory = useFinanceStore((state) => state.addTransactionCategory);
  const removeTransactionCategory = useFinanceStore((state) => state.removeTransactionCategory);
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const updateTransaction = useFinanceStore((state) => state.updateTransaction);
  const amountInputRef = useRef<TextInput>(null);
  const ignoreNextCategoryPress = useRef(false);

  const [step, setStep] = useState<'category' | 'amount'>('category');
  const [categoryPicked, setCategoryPicked] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(initialType);
  const [amountRaw, setAmountRaw] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Comida');
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [destinationAccountId, setDestinationAccountId] = useState<string | undefined>(undefined);
  const [transferSlot, setTransferSlot] = useState<'source' | 'destination' | null>(null);
  const [cardId, setCardId] = useState<string | undefined>(undefined);
  const [newCategory, setNewCategory] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [occurredAtInput, setOccurredAtInput] = useState(toLocalDateInput(new Date()));
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [entryCurrency, setEntryCurrency] = useState(defaultCurrency);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [categoryDeleteOpen, setCategoryDeleteOpen] = useState(false);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const keypadAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!open) return;
    if (editingTransaction) {
      const txDate = new Date(editingTransaction.occurredAt);
      const validDate = Number.isNaN(txDate.getTime()) ? new Date() : txDate;
      const entry = editingTransaction.originalCurrency ?? editingTransaction.currency;
      const entryAmount = editingTransaction.originalAmount ?? editingTransaction.amount;
      setType(editingTransaction.type);
      setEntryCurrency(entry);
      setAmountRaw(parseAmountInput(String(entryAmount), entry));
      setMerchant(editingTransaction.merchant);
      setNewCategory('');
      setCategory(editingTransaction.category);
      setAccountId(
        editingTransaction.accountId ??
          accounts.find((account) => accountSupportsMovement(account.kind, sourceRoleFor(editingTransaction.type)))
            ?.id,
      );
      setDestinationAccountId(
        editingTransaction.destinationAccountId ??
          accounts.find(
            (account) =>
              account.id !== editingTransaction.accountId &&
              accountSupportsMovement(account.kind, 'transfer_destination'),
          )?.id,
      );
      setCardId(editingTransaction.cardId);
      setOccurredAtInput(toLocalDateInput(validDate));
      setCalendarMonth(new Date(validDate.getFullYear(), validDate.getMonth(), 1));
      setShowCalendar(false);
      setCurrencyPickerOpen(false);
      setStep('amount');
      setCategoryPicked(true);
      setDeleteArmed(false);
      setTransferSlot(null);
      return;
    }

    const startType = initialType;
    const role = sourceRoleFor(startType);
    const presetSource =
      presetAccountId && accounts.some((account) => account.id === presetAccountId && accountSupportsMovement(account.kind, role))
        ? presetAccountId
        : undefined;
    const initialSourceId =
      presetSource ?? accounts.find((account) => accountSupportsMovement(account.kind, role))?.id;
    const presetDestination =
      presetDestinationAccountId &&
      presetDestinationAccountId !== initialSourceId &&
      accounts.some(
        (account) =>
          account.id === presetDestinationAccountId && accountSupportsMovement(account.kind, 'transfer_destination'),
      )
        ? presetDestinationAccountId
        : undefined;
    setType(startType);
    setAmountRaw('');
    setMerchant('');
    setNewCategory('');
    setCategory(startType === 'income' ? 'Salario' : 'Comida');
    setAccountId(startType === 'transfer' ? presetSource : initialSourceId);
    setCardId(undefined);
    setDestinationAccountId(startType === 'transfer' ? presetDestination : undefined);
    setTransferSlot(null);
    setOccurredAtInput(toLocalDateInput(new Date()));
    setCalendarMonth(new Date());
    setShowCalendar(false);
    setEntryCurrency(defaultCurrency);
    setCurrencyPickerOpen(false);
    setStep(startType === 'transfer' ? 'amount' : 'category');
    setCategoryPicked(startType === 'transfer');
    setDeleteArmed(false);
  }, [open, initialType, accounts, editingTransaction, defaultCurrency, presetAccountId, presetDestinationAccountId]);

  useEffect(() => {
    if (!open || entryCurrency === defaultCurrency) {
      setRates(null);
      return;
    }
    let cancelled = false;
    getExchangeRates(defaultCurrency)
      .then((result) => {
        if (!cancelled) setRates(result);
      })
      .catch(() => {
        if (!cancelled) setRates(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entryCurrency, defaultCurrency]);

  useEffect(() => {
    if (!open || step !== 'amount') return;
    if (type === 'transfer' && (!accountId || !destinationAccountId || transferSlot)) return;
    const timer = setTimeout(() => amountInputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [accountId, destinationAccountId, open, step, transferSlot, type]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(keypadAnim, {
      toValue: keyboardVisible ? 0 : 1,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [keyboardVisible, keypadAnim]);

  const sourceRole = sourceRoleFor(type);
  const sourceAccounts = useMemo(() => {
    const eligible = accounts.filter((account) => accountSupportsMovement(account.kind, sourceRole));
    const savedId = editingTransaction?.type === type ? editingTransaction.accountId : undefined;
    if (!savedId || eligible.some((account) => account.id === savedId)) return eligible;
    const saved = accounts.find((account) => account.id === savedId);
    return saved ? [saved, ...eligible] : eligible;
  }, [accounts, editingTransaction, sourceRole, type]);
  const destinationAccounts = useMemo(() => {
    const eligible = accounts.filter(
      (account) => account.id !== accountId && accountSupportsMovement(account.kind, 'transfer_destination'),
    );
    const savedId = editingTransaction?.type === 'transfer' ? editingTransaction.destinationAccountId : undefined;
    if (!savedId || savedId === accountId || eligible.some((account) => account.id === savedId)) return eligible;
    const saved = accounts.find((account) => account.id === savedId);
    return saved ? [saved, ...eligible] : eligible;
  }, [accountId, accounts, editingTransaction]);

  useEffect(() => {
    if (!open) return;
    const savedId = editingTransaction?.type === type ? editingTransaction.accountId : undefined;
    if (accountId && (accountId === savedId || sourceAccounts.some((account) => account.id === accountId))) return;
    if (type === 'transfer' && !editingTransaction) {
      const presetOk = !!presetAccountId && sourceAccounts.some((account) => account.id === presetAccountId);
      if (!accountId && presetOk) setAccountId(presetAccountId);
      else if (accountId) setAccountId(presetOk ? presetAccountId : undefined);
      return;
    }
    const presetOk = !!presetAccountId && sourceAccounts.some((account) => account.id === presetAccountId);
    setAccountId(presetOk ? presetAccountId : sourceAccounts[0]?.id);
  }, [accountId, editingTransaction, open, presetAccountId, sourceAccounts, type]);

  useEffect(() => {
    if (!open || type !== 'transfer') return;
    const presetDestinationOk =
      !!presetDestinationAccountId &&
      presetDestinationAccountId !== accountId &&
      destinationAccounts.some((account) => account.id === presetDestinationAccountId);
    if (presetDestinationOk) {
      if (destinationAccountId !== presetDestinationAccountId) setDestinationAccountId(presetDestinationAccountId);
      return;
    }
    const savedId = editingTransaction?.type === 'transfer' ? editingTransaction.destinationAccountId : undefined;
    if (
      destinationAccountId &&
      destinationAccountId !== accountId &&
      (destinationAccountId === savedId || destinationAccounts.some((account) => account.id === destinationAccountId))
    ) {
      return;
    }
    if (editingTransaction?.type === 'transfer' && savedId && savedId !== accountId) {
      setDestinationAccountId(savedId);
      return;
    }
    if (destinationAccountId) setDestinationAccountId(undefined);
  }, [
    accountId,
    destinationAccountId,
    destinationAccounts,
    editingTransaction,
    open,
    presetDestinationAccountId,
    type,
  ]);

  const accountCards = useMemo(
    () => (type === 'expense' ? cards.filter((card) => card.accountId === accountId) : []),
    [accountId, cards, type],
  );

  useEffect(() => {
    if (!open || type !== 'expense') return;
    if (cardId && accountCards.some((card) => card.id === cardId)) return;
    const savedId = editingTransaction?.cardId;
    if (savedId && accountCards.some((card) => card.id === savedId)) {
      setCardId(savedId);
      return;
    }
    setCardId(accountCards[0]?.id);
  }, [accountCards, cardId, editingTransaction, open, type]);

  const activeCategories = type === 'income' ? incomeCategories : expenseCategories;
  const sortedCategories = useMemo(
    () => activeCategories.slice().sort((a, b) => a.localeCompare(b)),
    [activeCategories],
  );

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const resolvePersistedAmount = (entryAmount: number) => {
    if (entryCurrency === defaultCurrency) {
      return {
        amount: entryAmount,
        currency: defaultCurrency,
        originalAmount: undefined as number | undefined,
        originalCurrency: undefined as string | undefined,
        exchangeRate: undefined as number | undefined,
      };
    }
    if (!rates) return null;
    const exchangeRate = getUnitsOfBasePerOne(rates, defaultCurrency, entryCurrency);
    const converted = convertToBase(entryAmount, entryCurrency, defaultCurrency, rates);
    if (exchangeRate == null || converted == null) return null;
    const digits = getCurrencyFractionDigits(defaultCurrency);
    const rounded =
      digits === 0 ? Math.round(converted) : Math.round(converted * 10 ** digits) / 10 ** digits;
    return {
      amount: rounded,
      currency: defaultCurrency,
      originalAmount: entryAmount,
      originalCurrency: entryCurrency,
      exchangeRate,
    };
  };

  const submit = () => {
    const entryAmount = Number(amountRaw);
    const normalizedMerchant =
      merchant.trim() || (type === 'transfer' ? 'Transferencia' : type === 'income' ? 'Ingreso' : category);
    if (Number.isNaN(entryAmount) || entryAmount <= 0) return;
    if (type === 'transfer' && (!accountId || !destinationAccountId || accountId === destinationAccountId)) return;
    if (type === 'transfer' && !sourceAccounts.some((account) => account.id === accountId)) return;
    if (type === 'transfer' && !destinationAccounts.some((account) => account.id === destinationAccountId)) return;
    if (type !== 'transfer' && sourceAccounts.length > 0 && !sourceAccounts.some((account) => account.id === accountId)) {
      return;
    }
    const persisted = resolvePersistedAmount(entryAmount);
    if (!persisted) return;
    const selectedDate = parseLocalDateInput(occurredAtInput) ?? new Date();
    const baseTime = editingTransaction ? new Date(editingTransaction.occurredAt) : new Date();
    const safeTime = Number.isNaN(baseTime.getTime()) ? new Date() : baseTime;
    const occurredAt = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      safeTime.getHours(),
      safeTime.getMinutes(),
      safeTime.getSeconds(),
      0,
    ).toISOString();

    if (editingTransaction) {
      updateTransaction(editingTransaction.id, {
        type,
        amount: persisted.amount,
        currency: persisted.currency,
        originalAmount: persisted.originalAmount,
        originalCurrency: persisted.originalCurrency,
        exchangeRate: persisted.exchangeRate,
        category: type === 'transfer' ? 'Transferencia' : category,
        merchant: normalizedMerchant,
        accountId,
        destinationAccountId: type === 'transfer' ? destinationAccountId : undefined,
        cardId: type === 'expense' ? cardId : undefined,
        paymentMethod: type === 'expense' && cardId ? 'card' : 'transfer',
        occurredAt,
      });
      close();
      return;
    }

    addTransaction({
      type,
      amount: persisted.amount,
      currency: persisted.currency,
      originalAmount: persisted.originalAmount,
      originalCurrency: persisted.originalCurrency,
      exchangeRate: persisted.exchangeRate,
      category: type === 'transfer' ? 'Transferencia' : category,
      tags: [],
      paymentMethod: type === 'expense' && cardId ? 'card' : 'transfer',
      merchant: normalizedMerchant,
      accountId,
      cardId: type === 'expense' ? cardId : undefined,
      destinationAccountId: type === 'transfer' ? destinationAccountId : undefined,
      occurredAt,
      recurring: false,
      source: 'manual',
    });
    close();
  };

  const addCategory = () => {
    const normalized = newCategory.trim();
    if (!normalized) return;
    const kind = type === 'income' ? 'income' : 'expense';
    const existing = activeCategories.find((item) => item.toLowerCase() === normalized.toLowerCase());
    addTransactionCategory(normalized, kind);
    setCategory(existing ?? normalized);
    setNewCategory('');
    setCategoryPicked(true);
    setStep('amount');
  };

  const selectType = (option: 'income' | 'expense' | 'transfer') => {
    if (option === type) return;
    setType(option);
    setDeleteArmed(false);
    if (option === 'transfer') {
      setStep('amount');
      setTransferSlot(null);
      if (!editingTransaction) {
        setAccountId(undefined);
        setDestinationAccountId(undefined);
      }
      return;
    }
    setTransferSlot(null);
    const targetList = option === 'income' ? incomeCategories : expenseCategories;
    const fallback = option === 'income' ? 'Salario' : 'Comida';
    setCategory(targetList.includes(fallback) ? fallback : (targetList[0] ?? fallback));
    setCategoryPicked(false);
    setStep('category');
  };

  const chooseCategory = (item: string) => {
    if (ignoreNextCategoryPress.current) {
      ignoreNextCategoryPress.current = false;
      return;
    }
    setCategory(item);
    setCategoryPicked(true);
    setDeleteArmed(false);
    setStep('amount');
  };

  const holdCategory = (item: string) => {
    ignoreNextCategoryPress.current = true;
    setCategory(item);
    setCategoryPicked(true);
    setDeleteArmed(true);
    setTimeout(() => {
      ignoreNextCategoryPress.current = false;
    }, 450);
  };

  const canDeleteSelected =
    deleteArmed &&
    categoryPicked &&
    type !== 'transfer' &&
    activeCategories.includes(category) &&
    !PROTECTED_CATEGORIES.includes(category);

  const confirmDeleteSelected = () => {
    if (!canDeleteSelected) return;
    setCategoryDeleteOpen(true);
  };

  const deleteSelectedCategory = () => {
    const target = category;
    const kind = type === 'income' ? 'income' : 'expense';
    removeTransactionCategory(target, kind);
    const remaining = activeCategories.filter((item) => item !== target);
    const fallback = kind === 'income' ? 'Salario' : 'Comida';
    setCategory(remaining.includes(fallback) ? fallback : (remaining[0] ?? fallback));
    setCategoryPicked(false);
    setDeleteArmed(false);
    setCategoryDeleteOpen(false);
  };

  const iconFor = (item: string): keyof typeof Ionicons.glyphMap =>
    (categoryIcons[item] as keyof typeof Ionicons.glyphMap | undefined) ??
    CATEGORY_ICON_MAP[item] ??
    'ellipse-outline';

  const onHeaderLeft = () => {
    if (step === 'amount' && type !== 'transfer' && !editingTransaction) {
      Keyboard.dismiss();
      setDeleteArmed(false);
      setStep('category');
      return;
    }
    close();
  };

  const fractionDigits = getCurrencyFractionDigits(entryCurrency);
  const entryAmountValue = Number(amountRaw);
  const convertedPreview =
    entryCurrency !== defaultCurrency && rates && !Number.isNaN(entryAmountValue) && entryAmountValue > 0
      ? convertToBase(entryAmountValue, entryCurrency, defaultCurrency, rates)
      : null;
  const entryCurrencyMeta = findCurrency(entryCurrency);
  const keypadExpandedHeight = 280 + Math.max(insets.bottom, 8);
  const keypad = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00', '.'];
  const appendKey = (key: string) => {
    setAmountRaw((prev) => {
      if (key === '.' && fractionDigits === 0) return prev;
      if (key === '.' && prev.includes('.')) return prev;
      if ((key === '0' || key === '00') && (!prev || prev === '0')) return prev === '0' ? prev : '0';
      const next = `${prev}${key}`;
      return parseAmountInput(next, entryCurrency);
    });
  };

  const backspace = () => setAmountRaw((prev) => prev.slice(0, -1));
  const clearAmount = () => setAmountRaw('');
  const applyPresetDay = (offsetDays: number) => {
    const base = new Date();
    base.setDate(base.getDate() + offsetDays);
    setOccurredAtInput(toLocalDateInput(base));
  };
  const selectedDate = parseLocalDateInput(occurredAtInput) ?? new Date();
  const todayInput = toLocalDateInput(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayInput = toLocalDateInput(yesterdayDate);
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);

  const categoryPrompt = type === 'income' ? '¿Qué tipo de ingreso es?' : '¿En qué lo gastaste?';
  const transferReady = type === 'transfer' && !!accountId && !!destinationAccountId && !transferSlot;
  const showAmountEntry = type !== 'transfer' || transferReady;
  const transferPickerAccounts = (transferSlot === 'source' ? sourceAccounts : destinationAccounts).filter(
    (account) => account.id !== (transferSlot === 'source' ? destinationAccountId : accountId),
  );

  const chooseTransferAccount = (id: string) => {
    if (transferSlot === 'destination') {
      setDestinationAccountId(id);
      setTransferSlot(accountId ? null : 'source');
      return;
    }
    setAccountId(id);
    if (destinationAccountId === id) {
      setDestinationAccountId(undefined);
      setTransferSlot('destination');
      return;
    }
    setTransferSlot(destinationAccountId ? null : 'destination');
  };

  const renderTransferSlot = (slot: 'source' | 'destination') => {
    const selectedId = slot === 'source' ? accountId : destinationAccountId;
    const account = accounts.find((item) => item.id === selectedId);
    const active = transferSlot === slot;
    return (
      <Pressable
        onPress={() => setTransferSlot(slot)}
        accessibilityRole="button"
        accessibilityLabel={
          account
            ? `${slot === 'source' ? 'Origen' : 'Destino'} ${account.name}. Toca para cambiarla`
            : slot === 'source'
              ? 'Elegir cuenta de origen'
              : 'Elegir a dónde va'
        }
        style={[
          styles.transferSlot,
          { borderColor: active ? theme.primary : theme.border, backgroundColor: theme.card },
          active && { backgroundColor: `${theme.primary}14` },
        ]}
      >
        {account ? (
          <>
            <View style={[styles.transferIcon, { backgroundColor: account.color || theme.primary }]}>
              <Ionicons
                name={(account.icon ?? defaultIconForKind(account.kind)) as keyof typeof Ionicons.glyphMap}
                size={26}
                color="#fff"
              />
            </View>
            {isLiabilityKind(account.kind) ? (
              <Text style={[styles.transferKind, { color: theme.textMuted }]} numberOfLines={1}>
                Dinero que debo
              </Text>
            ) : null}
            <Text style={[styles.transferName, { color: theme.text }]} numberOfLines={2}>
              {account.name}
            </Text>
            <Text style={[styles.transferBalance, { color: theme.textMuted }]} numberOfLines={1}>
              {formatMoney(getAccountDisplayValue(account), getAccountDisplayCurrency(account))}
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.transferIcon, { backgroundColor: `${theme.textMuted}22` }]}>
              <Ionicons name="add" size={28} color={theme.textMuted} />
            </View>
            <Text style={[styles.transferName, { color: theme.textMuted }]}>
              {slot === 'source' ? 'Desde' : 'Hacia'}
            </Text>
          </>
        )}
      </Pressable>
    );
  };
  const typeSegment = (
    <View style={styles.segmentRow}>
      {(['expense', 'income', 'transfer'] as const).map((option) => (
        <Pressable
          key={option}
          onPress={() => selectType(option)}
          style={[
            styles.segment,
            { borderColor: theme.border },
            type === option && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
        >
          <Text style={[styles.segmentLabel, { color: type === option ? '#fff' : theme.text }]}>
            {option === 'expense' ? 'Gasto' : option === 'income' ? 'Ingreso' : 'Transferencia'}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onHeaderLeft}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
        >
        <Pressable
          style={styles.backdropSpacer}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <View
          style={[
            styles.modalCard,
            step === 'category'
              ? styles.modalCardCategory
              : showAmountEntry
                ? styles.modalCardAmount
                : styles.modalCardTransferPick,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.header}>
            <Pressable android_ripple={null} onPress={onHeaderLeft} style={styles.headerSide}>
              <Text style={[styles.headerAction, { color: theme.textMuted }]}>
                {step === 'amount' && type !== 'transfer' && !editingTransaction ? 'Atrás' : 'Cancelar'}
              </Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingTransaction ? 'Editar' : 'Agregar'}
            </Text>
            {step === 'amount' ? (
              <View style={[styles.headerSide, styles.headerSideRight, styles.headerActions]}>
                <Pressable
                  android_ripple={null}
                  onPress={() => setCurrencyPickerOpen(true)}
                  hitSlop={8}
                  style={[styles.fxButton, { borderColor: theme.border, backgroundColor: `${theme.primary}18` }]}
                >
                  <Ionicons name="swap-horizontal" size={18} color={theme.primary} />
                </Pressable>
                <Pressable android_ripple={null} onPress={submit}>
                  <Text style={[styles.headerAction, { color: theme.primary }]}>Guardar</Text>
                </Pressable>
              </View>
            ) : canDeleteSelected ? (
              <Pressable
                android_ripple={null}
                onPress={confirmDeleteSelected}
                style={[styles.headerSide, styles.headerSideRight]}
              >
                <Text style={[styles.headerAction, { color: theme.danger }]}>Eliminar</Text>
              </Pressable>
            ) : (
              <View style={styles.headerSide} />
            )}
          </View>

          {step === 'category' ? (
            <ScrollView
              style={styles.stepScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {typeSegment}
              <Text style={[styles.stepTitle, { color: theme.text }]}>{categoryPrompt}</Text>
              <Text style={[styles.stepHint, { color: theme.textMuted }]}>
                Toca una categoría para seguir con el monto. Mantén pulsada si quieres eliminarla.
              </Text>
              {canDeleteSelected ? (
                <Pressable
                  onPress={confirmDeleteSelected}
                  style={[
                    styles.deleteCategoryBar,
                    { borderColor: theme.danger, backgroundColor: `${theme.danger}14` },
                  ]}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  <Text style={[styles.deleteCategoryLabel, { color: theme.danger }]}>
                    Eliminar {category}
                  </Text>
                </Pressable>
              ) : null}
              <View style={styles.categoryGrid}>
                {sortedCategories.map((item) => {
                  const selected = categoryPicked && item === category;
                  return (
                    <View key={item} style={styles.categoryCell}>
                      <Pressable
                        style={[
                          styles.categoryTile,
                          { borderColor: theme.border, backgroundColor: theme.card },
                          selected && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                        ]}
                        onPress={() => chooseCategory(item)}
                        onLongPress={() => holdCategory(item)}
                        delayLongPress={280}
                      >
                        <View
                          style={[
                            styles.categoryIconWrap,
                            { backgroundColor: selected ? `${theme.primary}22` : `${theme.textMuted}22` },
                          ]}
                        >
                          <Ionicons
                            name={iconFor(item)}
                            size={22}
                            color={selected ? theme.primary : theme.textMuted}
                          />
                        </View>
                        <Text style={[styles.categoryLabel, { color: theme.text }]} numberOfLines={2}>
                          {item}
                        </Text>
                      </Pressable>
                      {selected && deleteArmed && !PROTECTED_CATEGORIES.includes(item) ? (
                        <Pressable
                          onPress={confirmDeleteSelected}
                          hitSlop={6}
                          style={[styles.deleteBadge, { backgroundColor: theme.danger }]}
                        >
                          <Ionicons name="trash-outline" size={14} color="#fff" />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <View style={styles.addCategoryRow}>
                <TextInput
                  value={newCategory}
                  onChangeText={setNewCategory}
                  placeholder="Nueva categoría"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, styles.addCategoryInput, { color: theme.text, borderColor: theme.border }]}
                />
                <Pressable style={[styles.addCategoryButton, { backgroundColor: theme.primary }]} onPress={addCategory}>
                  <Text style={styles.primaryButtonText}>Agregar</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <ScrollView
              style={styles.stepScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {typeSegment}
              {type === 'transfer' ? (
                <View style={styles.transferPair}>
                  {renderTransferSlot('source')}
                  <Ionicons name="arrow-forward" size={18} color={theme.textMuted} />
                  {renderTransferSlot('destination')}
                </View>
              ) : null}
              {type === 'transfer' && transferSlot ? (
                <View style={styles.transferPicker}>
                  <Text style={[styles.blockTitle, { color: theme.text }]}>
                    {transferSlot === 'source' ? '¿De dónde sale?' : '¿A dónde va?'}
                  </Text>
                  {transferPickerAccounts.length === 0 ? (
                    <Text style={[styles.bannerHint, { color: theme.textMuted }]}>
                      {accounts.length < 2
                        ? 'Crea al menos 2 cuentas en Más > Cuentas para registrar transferencias.'
                        : transferSlot === 'source'
                          ? 'No hay una cuenta de origen válida.'
                          : 'Agrega otra cuenta para elegir el destino.'}
                    </Text>
                  ) : (
                    transferPickerAccounts.map((account) => {
                      const selected =
                        (transferSlot === 'source' ? accountId : destinationAccountId) === account.id;
                      const iconName = (account.icon ??
                        defaultIconForKind(account.kind)) as keyof typeof Ionicons.glyphMap;
                      return (
                        <Pressable
                          key={account.id}
                          onPress={() => chooseTransferAccount(account.id)}
                          style={[
                            styles.transferOption,
                            { borderColor: selected ? theme.primary : theme.border, backgroundColor: theme.card },
                            selected && { backgroundColor: `${theme.primary}14` },
                          ]}
                        >
                          <View style={[styles.transferOptionIcon, { backgroundColor: account.color || theme.primary }]}>
                            <Ionicons name={iconName} size={18} color="#fff" />
                          </View>
                          <View style={styles.transferOptionBody}>
                            <Text style={[styles.transferOptionName, { color: theme.text }]} numberOfLines={1}>
                              {account.name}
                            </Text>
                            <Text style={[styles.transferBalance, { color: theme.textMuted }]} numberOfLines={1}>
                              {isLiabilityKind(account.kind) ? 'Dinero que debo · ' : ''}
                              {formatMoney(getAccountDisplayValue(account), getAccountDisplayCurrency(account))}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : null}
              {type === 'transfer' && !transferSlot && !transferReady ? (
                <Text style={[styles.stepHint, { color: theme.textMuted }]}>
                  Toca un cuadro para elegir de dónde sale y a dónde va.
                </Text>
              ) : null}
              {showAmountEntry ? (
              <>
              <View style={styles.heroRow}>
                {type !== 'transfer' ? (
                  <Pressable
                    onPress={() => setStep('category')}
                    accessibilityRole="button"
                    accessibilityLabel={`Categoría ${category}. Toca para cambiarla`}
                    style={[styles.categoryBox, { borderColor: theme.border, backgroundColor: `${theme.primary}14` }]}
                  >
                    <View style={[styles.categoryBoxIcon, { backgroundColor: `${theme.primary}22` }]}>
                      <Ionicons name={iconFor(category)} size={18} color={theme.primary} />
                    </View>
                    <View style={styles.categoryBoxLabelWrap}>
                      <Text
                        style={[styles.categoryBoxLabel, { color: theme.text }]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        ellipsizeMode="tail"
                      >
                        {category}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}

                <View style={[styles.amountCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <View style={styles.amountRow}>
                    <Pressable
                      android_ripple={null}
                      onPress={() => setCurrencyPickerOpen(true)}
                      style={[styles.currencyBadge, { backgroundColor: `${theme.primary}22` }]}
                    >
                      <Text style={[styles.currencyBadgeText, { color: theme.primary }]}>
                        {entryCurrency}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.amountInputHit} onPress={() => Keyboard.dismiss()}>
                      <TextInput
                        ref={amountInputRef}
                        value={formatAmountInput(amountRaw, entryCurrency)}
                        onChangeText={(val) => setAmountRaw(parseAmountInput(val, entryCurrency))}
                        onFocus={() => Keyboard.dismiss()}
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                        style={[styles.amountInput, { color: theme.text }]}
                        showSoftInputOnFocus={false}
                      />
                    </Pressable>
                  </View>
                  {convertedPreview != null ? (
                    <Text style={[styles.conversionHint, { color: theme.textMuted }]}>
                      ≈ {formatMoney(convertedPreview, defaultCurrency)}
                    </Text>
                  ) : entryCurrency !== defaultCurrency && !rates ? (
                    <Text style={[styles.conversionHint, { color: theme.textMuted }]}>
                      Cargando conversión…
                    </Text>
                  ) : entryCurrencyMeta && entryCurrency !== defaultCurrency ? (
                    <Text style={[styles.conversionHint, { color: theme.textMuted }]}>
                      Se guardará en {defaultCurrency}
                    </Text>
                  ) : null}
                </View>
              </View>
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                placeholder={type === 'transfer' ? 'Nota' : 'Comercio o descripción'}
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />

              {type !== 'transfer' ? (
              <>
              <Text style={[styles.blockTitle, { color: theme.text }]}>
                {type === 'expense' ? 'Sale de' : 'Entra a'}
              </Text>
              <Text style={[styles.bannerHint, { color: theme.textMuted, marginBottom: 6 }]}>
                {type === 'expense'
                  ? 'Efectivo, banco, débito, billetera y tarjetas de crédito.'
                  : 'Solo cuentas donde puede entrar plata.'}
              </Text>
              {sourceAccounts.length === 0 ? (
                <Text style={[styles.bannerHint, { color: theme.textMuted, marginBottom: 8 }]}>
                  {accounts.length === 0
                    ? 'Sin cuentas registradas (se guardará como movimiento general).'
                    : type === 'expense'
                      ? 'Ninguna cuenta puede pagar este gasto. Inversiones y deudas no salen aquí.'
                      : 'Ninguna cuenta puede recibir este ingreso.'}
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  {sourceAccounts.map((account) => (
                    <Pressable
                      key={account.id}
                      style={[
                        styles.chip,
                        { borderColor: theme.border },
                        accountId === account.id && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                      ]}
                      onPress={() => setAccountId(account.id)}
                    >
                      <Text style={[styles.chipLabel, { color: theme.text }]}>{account.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              </>
              ) : null}

              {type === 'expense' && accountCards.length > 0 ? (
                <>
                  <Text style={[styles.blockTitle, { color: theme.text }]}>Tarjeta</Text>
                  <Text style={[styles.bannerHint, { color: theme.textMuted, marginBottom: 6 }]}>
                    La compra queda en esta tarjeta. El saldo se mueve en la cuenta elegida.
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    {accountCards.map((card) => (
                      <Pressable
                        key={card.id}
                        style={[
                          styles.chip,
                          { borderColor: theme.border },
                          cardId === card.id && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                        ]}
                        onPress={() => setCardId(card.id)}
                      >
                        <Text style={[styles.chipLabel, { color: theme.text }]}>
                          {card.alias} · {card.last4}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <View style={styles.dateCompactRow}>
                <Pressable
                  style={[
                    styles.dateChip,
                    { borderColor: theme.border },
                    occurredAtInput === todayInput && {
                      borderColor: theme.primary,
                      backgroundColor: `${theme.primary}20`,
                    },
                  ]}
                  onPress={() => applyPresetDay(0)}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      { color: occurredAtInput === todayInput ? theme.primary : theme.text },
                    ]}
                  >
                    Hoy
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.dateChip,
                    { borderColor: theme.border },
                    occurredAtInput === yesterdayInput && {
                      borderColor: theme.primary,
                      backgroundColor: `${theme.primary}20`,
                    },
                  ]}
                  onPress={() => applyPresetDay(-1)}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      { color: occurredAtInput === yesterdayInput ? theme.primary : theme.text },
                    ]}
                  >
                    Ayer
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.datePickerButton, { borderColor: theme.border }]}
                  onPress={() => {
                    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
                    setShowCalendar(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={16} color={theme.textMuted} />
                  <Text style={[styles.dateInput, { color: theme.text }]}>{formatDateLabel(selectedDate)}</Text>
                </Pressable>
              </View>
              </>
              ) : null}
            </ScrollView>
          )}

          {step === 'amount' && showAmountEntry ? (
          <Animated.View
            pointerEvents={keyboardVisible ? 'none' : 'auto'}
            style={[
              styles.keypad,
              { paddingBottom: Math.max(insets.bottom, 8) },
              {
                opacity: keypadAnim,
                height: keypadAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, keypadExpandedHeight],
                }),
                marginTop: keypadAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 8],
                }),
              },
            ]}
          >
              {keypad.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.key, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => appendKey(item)}
                >
                  <Text style={[styles.keyLabel, { color: theme.text }]}>{item}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.key, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={clearAmount}
              >
                <Text style={[styles.keyLabel, { color: theme.textMuted }]}>C</Text>
              </Pressable>
              <Pressable
                style={[styles.key, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={backspace}
              >
                <Text style={[styles.keyLabel, { color: theme.textMuted }]}>⌫</Text>
              </Pressable>
              <Pressable style={[styles.key, { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={submit}>
                <Text style={[styles.keyLabel, { color: '#fff' }]}>OK</Text>
              </Pressable>
          </Animated.View>
          ) : null}
        </View>
        <TransactionCurrencyPicker
          open={currencyPickerOpen}
          onClose={() => setCurrencyPickerOpen(false)}
          defaultCurrency={defaultCurrency}
          selectedCurrency={entryCurrency}
          onSelect={(code) => {
            setEntryCurrency(code);
            setAmountRaw((prev) => parseAmountInput(prev, code));
          }}
        />

        <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
          <Pressable style={styles.calendarOverlay} onPress={() => setShowCalendar(false)}>
            <Pressable style={[styles.calendarCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.calendarHeader}>
                <Pressable
                  style={[styles.calendarNavBtn, { borderColor: theme.border }]}
                  onPress={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                >
                  <Ionicons name="chevron-back" size={16} color={theme.text} />
                </Pressable>
                <Text style={[styles.calendarMonth, { color: theme.text }]}>{formatMonthLabel(calendarMonth)}</Text>
                <Pressable
                  style={[styles.calendarNavBtn, { borderColor: theme.border }]}
                  onPress={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                >
                  <Ionicons name="chevron-forward" size={16} color={theme.text} />
                </Pressable>
              </View>

              <View style={styles.weekRow}>
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, idx) => (
                  <Text key={`${label}-${idx}`} style={[styles.weekLabel, { color: theme.textMuted }]}>
                    {label}
                  </Text>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {calendarWeeks.map((week, weekIndex) => {
                  const hasCurrentMonthDay = week.some(
                    (day) => day.getMonth() === calendarMonth.getMonth(),
                  );
                  if (!hasCurrentMonthDay) return null;

                  return (
                    <View key={`week-${weekIndex}`} style={styles.weekDaysRow}>
                      {week.map((day) => {
                        const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                        if (!isCurrentMonth) {
                          return (
                            <View
                              key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                              style={styles.dayCellEmpty}
                            />
                          );
                        }

                        const isSelected = toLocalDateInput(day) === occurredAtInput;
                        return (
                          <Pressable
                            key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                            style={[
                              styles.dayCell,
                              { borderColor: theme.border },
                              isSelected && {
                                backgroundColor: theme.primary,
                                borderColor: theme.primary,
                              },
                            ]}
                            onPress={() => {
                              setOccurredAtInput(toLocalDateInput(day));
                              setShowCalendar(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.dayCellText,
                                { color: isSelected ? '#fff' : theme.text },
                              ]}
                            >
                              {day.getDate()}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        <ConfirmModal
          open={categoryDeleteOpen}
          title="Eliminar categoría"
          message={`¿Eliminar “${category}”? Los movimientos que ya la usan conservan el nombre.`}
          confirmLabel="Eliminar"
          onCancel={() => setCategoryDeleteOpen(false)}
          onConfirm={deleteSelectedCategory}
        />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropSpacer: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 56,
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 16,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerSide: {
    minWidth: 74,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
  },
  fxButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAction: {
    fontSize: 15,
    fontWeight: '600',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginBottom: 10,
  },
  transferPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  transferSlot: {
    flex: 1,
    minHeight: 148,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 6,
  },
  transferIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferKind: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  transferName: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  transferBalance: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  transferPicker: {
    marginBottom: 8,
  },
  transferOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  transferOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferOptionBody: {
    flex: 1,
  },
  transferOptionName: {
    fontSize: 15,
    fontWeight: '700',
  },
  categoryBox: {
    maxWidth: '52%',
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    overflow: 'hidden',
  },
  categoryBoxIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBoxLabelWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  categoryBoxLabel: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
  },
  amountCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  conversionHint: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'right',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  currencyBadgeText: {
    fontWeight: '800',
    fontSize: 14,
  },
  modalCardCategory: {
    height: '86%',
    flexShrink: 1,
  },
  modalCardAmount: {
    height: '92%',
    flexShrink: 1,
  },
  modalCardTransferPick: {
    height: '72%',
    flexShrink: 1,
  },
  stepScroll: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  stepHint: {
    fontSize: 13,
    marginBottom: 14,
  },
  bannerHint: {
    fontSize: 12,
    marginTop: 2,
  },
  modalTitle: { fontWeight: '800', fontSize: 22 },
  scrollContent: {
    paddingBottom: 10,
  },
  blockTitle: { fontWeight: '700', marginBottom: 6, marginTop: 2 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  segment: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  segmentLabel: { fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  amountInputHit: {
    flex: 1,
  },
  amountInput: {
    paddingVertical: 0,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'right',
  },
  chipsRow: { gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipLabel: { fontSize: 12 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  deleteCategoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  deleteCategoryLabel: {
    fontWeight: '700',
    fontSize: 14,
  },
  categoryCell: {
    width: '33.333%',
    paddingHorizontal: 6,
    paddingBottom: 12,
    position: 'relative',
  },
  deleteBadge: {
    position: 'absolute',
    top: 6,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTile: {
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 6,
    minHeight: 112,
  },
  categoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  addCategoryRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  addCategoryInput: { flex: 1, marginBottom: 0 },
  addCategoryButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  dateCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dateChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateChipText: {
    fontWeight: '700',
    fontSize: 12,
  },
  datePickerButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateInput: {
    flex: 1,
    fontWeight: '600',
    fontSize: 13,
    paddingVertical: 0,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarNavBtn: {
    borderWidth: 1,
    borderRadius: 8,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonth: {
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekLabel: {
    width: '13.5%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  daysGrid: {
    gap: 4,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dayCellEmpty: {
    flex: 1,
    paddingVertical: 8,
  },
  dayCellText: {
    fontWeight: '600',
    fontSize: 12,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#94a3b822',
    paddingTop: 10,
    overflow: 'hidden',
  },
  key: {
    width: '31%',
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  keyLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
