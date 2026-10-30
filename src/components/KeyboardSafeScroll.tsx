import React, { forwardRef, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  View,
  type KeyboardEvent,
  type ScrollViewProps,
} from 'react-native';

type MeasurableInput = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

const focusedInput = (): MeasurableInput | null => {
  const input = TextInput.State.currentlyFocusedInput() as MeasurableInput | null;
  if (!input || typeof input.measureInWindow !== 'function') return null;
  return input;
};

/**
 * Empuja el contenido hacia arriba cuando aparece el teclado y deja
 * el campo enfocado visible, con espacio para seguir bajando.
 */
export const KeyboardSafeScroll = forwardRef<ScrollView, ScrollViewProps>(function KeyboardSafeScroll(
  { children, contentContainerStyle, onScroll, onTouchStart, style, ...rest },
  forwardedRef,
) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef(0);
  const focusedBeforeTouch = useRef<MeasurableInput | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const scrollFocusedIntoView = () => {
    const input = focusedInput();
    const top = keyboardTop.current;
    if (!input || top <= 0) return;
    input.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height + 28 - top;
      // No subir el campo por encima de la barra: si no, se corta.
      const maxShift = y - 88;
      const shift = Math.min(overlap, maxShift);
      if (shift > 8) {
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollY.current + shift),
          animated: true,
        });
      }
    });
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      const windowHeight = Dimensions.get('window').height;
      const height = Math.max(0, event.endCoordinates.height);
      const screenY = event.endCoordinates.screenY;
      const expectedTop = windowHeight - height;
      // En Android a veces screenY llega casi en 0 y el formulario se dispara hacia arriba.
      const top =
        screenY > windowHeight * 0.35 && screenY < windowHeight ? screenY : expectedTop;
      keyboardTop.current = top;
      const covered = Math.min(Math.max(0, windowHeight - top), windowHeight * 0.5);
      setKeyboardInset(covered);
      setTimeout(scrollFocusedIntoView, Platform.OS === 'ios' ? 50 : 120);
    };

    const onHide = () => {
      keyboardTop.current = 0;
      setKeyboardInset(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <ScrollView
      {...rest}
      ref={(node) => {
        scrollRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      style={[{ flex: 1 }, style]}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={(event) => {
        scrollY.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      onTouchStart={(event) => {
        focusedBeforeTouch.current = focusedInput();
        onTouchStart?.(event);
        setTimeout(() => {
          const next = focusedInput();
          if (next && next !== focusedBeforeTouch.current && keyboardTop.current > 0) {
            scrollFocusedIntoView();
          }
        }, 90);
      }}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
      {keyboardInset > 0 ? <View style={{ height: keyboardInset }} /> : null}
    </ScrollView>
  );
});
