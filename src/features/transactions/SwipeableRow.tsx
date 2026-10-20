import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppTheme } from '../../core/theme/ThemeProvider';

const ACTION_WIDTH = 78;
const ACTIONS_WIDTH = ACTION_WIDTH * 2;

interface SwipeableRowProps {
  children: React.ReactNode;
  backgroundColor: string;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpened?: (close: () => void) => void;
}

const clamp = (value: number) => Math.min(0, Math.max(-ACTIONS_WIDTH, value));

export function SwipeableRow({
  children,
  backgroundColor,
  onPress,
  onEdit,
  onDelete,
  onOpened,
}: SwipeableRowProps) {
  const { theme } = useAppTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const live = useRef(0);
  const onOpenedRef = useRef(onOpened);
  const onPressRef = useRef(onPress);
  const onEditRef = useRef(onEdit);
  const onDeleteRef = useRef(onDelete);
  onOpenedRef.current = onOpened;
  onPressRef.current = onPress;
  onEditRef.current = onEdit;
  onDeleteRef.current = onDelete;

  const snapToRef = useRef<(open: boolean) => void>(() => undefined);
  const close = useRef(() => snapToRef.current(false)).current;

  snapToRef.current = (open: boolean) => {
    const to = open ? -ACTIONS_WIDTH : 0;
    offset.current = to;
    live.current = to;
    Animated.spring(translateX, {
      toValue: to,
      useNativeDriver: false,
      bounciness: 0,
      speed: 20,
    }).start();
    if (open) onOpenedRef.current?.(close);
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          offset.current = value;
          live.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const next = clamp(offset.current + gesture.dx);
        live.current = next;
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const projected = offset.current + gesture.dx;
        const shouldOpen = projected < -ACTIONS_WIDTH * 0.35 || gesture.vx < -0.45;
        snapToRef.current(shouldOpen && gesture.vx <= 0.45);
      },
      onPanResponderTerminate: () => {
        snapToRef.current(live.current < -ACTIONS_WIDTH / 2);
      },
    }),
  ).current;

  const handlePress = () => {
    if (offset.current < -8) {
      close();
      return;
    }
    onPressRef.current();
  };

  return (
    <View style={styles.host}>
      <View style={[styles.actions, { backgroundColor }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Editar"
          onPress={() => {
            close();
            onEditRef.current();
          }}
          style={styles.action}
        >
          <Ionicons name="create-outline" size={18} color={theme.primary} />
          <Text style={[styles.actionText, { color: theme.primary }]}>Editar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Eliminar"
          onPress={() => {
            close();
            onDeleteRef.current();
          }}
          style={styles.action}
        >
          <Ionicons name="trash-outline" size={18} color={theme.danger} />
          <Text style={[styles.actionText, { color: theme.danger }]}>Eliminar</Text>
        </Pressable>
      </View>
      <Animated.View
        style={[styles.front, { backgroundColor, transform: [{ translateX }] }]}
        {...pan.panHandlers}
      >
        <Pressable
          android_ripple={null}
          onPress={handlePress}
          style={[styles.frontPress, { borderBottomColor: theme.border }]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    overflow: 'hidden',
    marginHorizontal: -16,
  },
  actions: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionText: {
    fontWeight: '700',
    fontSize: 12,
  },
  front: {
    width: '100%',
  },
  frontPress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
