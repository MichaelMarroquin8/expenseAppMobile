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
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { formatAmountInput, getCurrencyFractionDigits, parseAmountInput } from '../../core/utils/format';
import { useFinanceStore } from '../../store/useFinanceStore';

interface QuickAddTransactionModalProps {
  open: boolean;
  onClose: () => void;
  initialType?: 'income' | 'expense';
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

const CATEGORY_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  Comida: 'fast-food-outline',
  Transporte: 'car-outline',
  Supermercado: 'basket-outline',
  Entretenimiento: 'game-controller-outline',
  Servicios: 'flash-outline',
  Salario: 'cash-outline',
  Otros: 'apps-outline',
};

export function QuickAddTransactionModal({
  open,
  onClose,
  initialType = 'expense',
}: QuickAddTransactionModalProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const currency = useFinanceStore((state) => state.settings.currency);
  const categories = useFinanceStore((state) => state.transactionCategories);
  const categoryIcons = useFinanceStore((state) => state.categoryIcons);
  const accounts = useFinanceStore((state) => state.accounts);
  const addTransactionCategory = useFinanceStore((state) => state.addTransactionCategory);
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const amountInputRef = useRef<TextInput>(null);

  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(initialType);
  const [amountRaw, setAmountRaw] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Comida');
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [destinationAccountId, setDestinationAccountId] = useState<string | undefined>(undefined);
  const [newCategory, setNewCategory] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [occurredAtInput, setOccurredAtInput] = useState(toLocalDateInput(new Date()));
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const keypadAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!open) return;
    const startType: 'income' | 'expense' = initialType;
    setType(startType);
    setAmountRaw('');
    setMerchant('');
    setNewCategory('');
    setCategory(startType === 'income' ? 'Salario' : 'Comida');
    setAccountId(accounts[0]?.id);
    setDestinationAccountId(accounts[1]?.id ?? accounts[0]?.id);
    setOccurredAtInput(toLocalDateInput(new Date()));
    setCalendarMonth(new Date());
    setShowCalendar(false);
    setTimeout(() => amountInputRef.current?.focus(), 100);
  }, [open, initialType, accounts]);

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

  const sortedCategories = useMemo(() => categories.slice().sort((a, b) => a.localeCompare(b)), [categories]);

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const submit = () => {
    const amount = Number(amountRaw);
    const normalizedMerchant =
      merchant.trim() || (type === 'transfer' ? 'Transferencia' : type === 'income' ? 'Ingreso' : category);
    if (Number.isNaN(amount) || amount <= 0) return;
    if (type === 'transfer' && (!accountId || !destinationAccountId || accountId === destinationAccountId)) return;
    if (type !== 'transfer' && !accountId) return;
    const selectedDate = parseLocalDateInput(occurredAtInput) ?? new Date();
    const now = new Date();
    const occurredAt = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      0,
    ).toISOString();

    addTransaction({
      type,
      amount,
      currency,
      category: type === 'transfer' ? 'Transferencia' : category,
      tags: [],
      paymentMethod: 'transfer',
      merchant: normalizedMerchant,
      accountId,
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
    const existing = categories.find((item) => item.toLowerCase() === normalized.toLowerCase());
    addTransactionCategory(normalized);
    setCategory(existing ?? normalized);
    setNewCategory('');
  };

  const fractionDigits = getCurrencyFractionDigits(currency);
  const keypadExpandedHeight = 280 + Math.max(insets.bottom, 8);
  const keypad = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00', '.'];
  const appendKey = (key: string) => {
    setAmountRaw((prev) => {
      if (key === '.' && fractionDigits === 0) return prev;
      if (key === '.' && prev.includes('.')) return prev;
      if ((key === '0' || key === '00') && (!prev || prev === '0')) return prev === '0' ? prev : '0';
      const next = `${prev}${key}`;
      return parseAmountInput(next, currency);
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
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
        <Pressable style={styles.backdropPressable} onPress={close} />
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.header}>
            <Pressable onPress={close}>
              <Text style={[styles.headerAction, { color: theme.textMuted }]}>Cancelar</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Agregar</Text>
            <Pressable onPress={submit}>
              <Text style={[styles.headerAction, { color: theme.primary }]}>Guardar</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.segmentRow}>
              {(['expense', 'income', 'transfer'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setType(option)}
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

            <TextInput
              ref={amountInputRef}
              value={formatAmountInput(amountRaw, currency)}
              onChangeText={() => {}}
              onFocus={() => Keyboard.dismiss()}
              placeholder="Monto"
              placeholderTextColor={theme.textMuted}
              style={[styles.amountInput, { color: theme.text, borderColor: theme.border }]}
              showSoftInputOnFocus={false}
            />
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder={type === 'transfer' ? 'Nota opcional de transferencia' : 'Comercio o descripción'}
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <Text style={[styles.blockTitle, { color: theme.text }]}>Fecha del movimiento</Text>
            <View style={styles.dateQuickRow}>
              <Pressable
                style={[styles.dateChip, { borderColor: theme.border }]}
                onPress={() => applyPresetDay(0)}
              >
                <Text style={[styles.dateChipText, { color: theme.text }]}>Hoy</Text>
              </Pressable>
              <Pressable
                style={[styles.dateChip, { borderColor: theme.border }]}
                onPress={() => applyPresetDay(-1)}
              >
                <Text style={[styles.dateChipText, { color: theme.text }]}>Ayer</Text>
              </Pressable>
            </View>
            <View style={styles.datePickerRow}>
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

            <Text style={[styles.blockTitle, { color: theme.text }]}>
              {type === 'expense' ? 'Sale de' : type === 'income' ? 'Entra a' : 'Cuenta origen'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {accounts.map((account) => (
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

            {type === 'transfer' ? (
              <>
                <Text style={[styles.blockTitle, { color: theme.text }]}>Cuenta destino</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  {accounts.map((account) => (
                    <Pressable
                      key={account.id}
                      style={[
                        styles.chip,
                        { borderColor: theme.border },
                        destinationAccountId === account.id && {
                          borderColor: theme.primary,
                          backgroundColor: `${theme.primary}20`,
                        },
                      ]}
                      onPress={() => setDestinationAccountId(account.id)}
                    >
                      <Text style={[styles.chipLabel, { color: theme.text }]}>{account.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={[styles.blockTitle, { color: theme.text }]}>Categoría</Text>
                <View style={styles.categoryGrid}>
                  {sortedCategories.map((item) => (
                    <Pressable
                      key={item}
                      style={[
                        styles.categoryTile,
                        { borderColor: theme.border },
                        item === category && { borderColor: theme.primary, backgroundColor: `${theme.primary}20` },
                      ]}
                      onPress={() => setCategory(item)}
                    >
                      <View style={[styles.categoryIconWrap, { backgroundColor: `${theme.textMuted}22` }]}>
                        <Ionicons
                          name={
                            (categoryIcons[item] as keyof typeof Ionicons.glyphMap | undefined) ??
                            CATEGORY_ICON_MAP[item] ??
                            'ellipse-outline'
                          }
                          size={18}
                          color={item === category ? theme.primary : theme.textMuted}
                        />
                      </View>
                      <Text style={[styles.categoryLabel, { color: theme.text }]} numberOfLines={2}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
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
              </>
            )}
          </ScrollView>

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
        </View>
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
                {calendarWeeks.map((week, weekIndex) => (
                  <View key={`week-${weekIndex}`} style={styles.weekDaysRow}>
                    {week.map((day) => {
                      const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                      const isSelected = toLocalDateInput(day) === occurredAtInput;
                      return (
                        <Pressable
                          key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                          style={[
                            styles.dayCell,
                            { borderColor: theme.border },
                            isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                          ]}
                          onPress={() => {
                            setOccurredAtInput(toLocalDateInput(day));
                            setShowCalendar(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dayCellText,
                              {
                                color: isSelected ? '#fff' : isCurrentMonth ? theme.text : theme.textMuted,
                              },
                            ]}
                          >
                            {day.getDate()}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000066',
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
  headerAction: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 70,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
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
  amountInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'right',
  },
  chipsRow: { gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipLabel: { fontSize: 12 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 8,
  },
  categoryTile: {
    width: '23%',
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 86,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  addCategoryRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  addCategoryInput: { flex: 1, marginBottom: 0 },
  addCategoryButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  dateQuickRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dateChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateChipText: {
    fontWeight: '600',
    fontSize: 12,
  },
  datePickerRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  datePickerButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
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
