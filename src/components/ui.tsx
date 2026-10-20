import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../core/theme/ThemeProvider';

export function Screen({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: theme.background }]}>
      {children}
    </SafeAreaView>
  );
}

export function PremiumCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { activeMode, theme } = useAppTheme();
  if (activeMode === 'dark') {
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
        {children}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#FFFFFF', '#F8FAFC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: theme.border }, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

type ConfirmTone = 'danger' | 'primary';

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  icon = 'trash-outline',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { theme } = useAppTheme();
  const accent = tone === 'danger' ? theme.danger : theme.primary;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.confirmBackdrop} onPress={onCancel}>
        <Pressable
          style={[styles.confirmCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => undefined}
        >
          <View style={[styles.confirmIcon, { backgroundColor: `${accent}22` }]}>
            <Ionicons name={icon} size={22} color={accent} />
          </View>
          <Text style={[styles.confirmTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.confirmMessage, { color: theme.textMuted }]}>{message}</Text>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={onCancel}
              style={[styles.confirmButton, styles.confirmCancel, { borderColor: theme.border }]}
            >
              <Text style={[styles.confirmButtonText, { color: theme.text }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={onConfirm}
              style={[styles.confirmButton, { backgroundColor: accent }]}
            >
              <Text style={[styles.confirmButtonText, styles.confirmConfirmText]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  confirmBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  confirmCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  confirmIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  confirmMessage: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
  confirmCancel: {
    borderWidth: 1,
  },
  confirmButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  confirmConfirmText: {
    color: '#fff',
  },
});
