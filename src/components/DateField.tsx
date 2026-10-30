import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../core/theme/ThemeProvider';
import { dateInputToIso, formatCalendarDate } from '../core/utils/format';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const toDateInput = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const parseDateInput = (input: string): Date => {
  const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return new Date();
  }
  return parsed;
};

const buildCalendarDays = (baseMonth: Date): Date[] => {
  const year = baseMonth.getFullYear();
  const month = baseMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const leading = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - leading);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

export function DateField({
  value,
  onChange,
  accessibilityLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
}) {
  const { theme } = useAppTheme();
  const selected = parseDateInput(value);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  const weeks = useMemo(() => {
    const days = buildCalendarDays(visibleMonth);
    const grouped: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      grouped.push(days.slice(index, index + 7));
    }
    return grouped;
  }, [visibleMonth]);

  const iso = dateInputToIso(value);
  const label = iso ? formatCalendarDate(iso) : 'Elegir fecha';
  const monthLabel = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(visibleMonth);

  const openCalendar = () => {
    const current = parseDateInput(value);
    setVisibleMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    setOpen(true);
  };

  const shiftMonth = (delta: number) => {
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <>
      <Pressable
        onPress={openCalendar}
        style={[styles.field, { borderColor: theme.border, backgroundColor: theme.surface }]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons name="calendar-outline" size={18} color={theme.primary} />
        <Text style={[styles.fieldText, { color: theme.text }]}>{label}</Text>
        <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => undefined}
          >
            <View style={styles.header}>
              <Pressable
                onPress={() => shiftMonth(-12)}
                style={[styles.navBtn, { borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel="Año anterior"
              >
                <Ionicons name="play-back" size={14} color={theme.text} />
              </Pressable>
              <Pressable
                onPress={() => shiftMonth(-1)}
                style={[styles.navBtn, { borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel="Mes anterior"
              >
                <Ionicons name="chevron-back" size={16} color={theme.text} />
              </Pressable>
              <Text style={[styles.month, { color: theme.text }]}>{monthLabel}</Text>
              <Pressable
                onPress={() => shiftMonth(1)}
                style={[styles.navBtn, { borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
              >
                <Ionicons name="chevron-forward" size={16} color={theme.text} />
              </Pressable>
              <Pressable
                onPress={() => shiftMonth(12)}
                style={[styles.navBtn, { borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel="Año siguiente"
              >
                <Ionicons name="play-forward" size={14} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((day, index) => (
                <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: theme.textMuted }]}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {weeks.map((week, weekIndex) => {
                const hasCurrentMonth = week.some((day) => day.getMonth() === visibleMonth.getMonth());
                if (!hasCurrentMonth) return null;
                return (
                  <View key={`week-${weekIndex}`} style={styles.week}>
                    {week.map((day) => {
                      const inMonth = day.getMonth() === visibleMonth.getMonth();
                      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                      if (!inMonth) return <View key={key} style={styles.empty} />;
                      const selectedDay = toDateInput(day) === toDateInput(selected);
                      return (
                        <Pressable
                          key={key}
                          onPress={() => {
                            onChange(toDateInput(day));
                            setOpen(false);
                          }}
                          style={[
                            styles.day,
                            { borderColor: theme.border },
                            selectedDay && { backgroundColor: theme.primary, borderColor: theme.primary },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={formatCalendarDate(dateInputToIso(toDateInput(day)) ?? day.toISOString())}
                        >
                          <Text style={[styles.dayText, { color: selectedDay ? '#fff' : theme.text }]}>
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
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldText: { flex: 1, fontWeight: '700', fontSize: 15 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 10,
  },
  navBtn: {
    borderWidth: 1,
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    textTransform: 'capitalize',
    fontSize: 14,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: { gap: 4 },
  week: {
    flexDirection: 'row',
    gap: 4,
  },
  day: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  empty: { flex: 1, paddingVertical: 8 },
  dayText: { fontWeight: '700', fontSize: 13 },
});
