import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { darkTheme } from '../core/theme/tokens';

/** Mismo fondo que el splash nativo en app.json y colors.xml. */
export const SPLASH_BACKGROUND = '#011230';

export function BootScreen() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator color={darkTheme.success} size="small" />
      <Text style={styles.title}>Preparando tus finanzas</Text>
      <Text style={styles.subtitle}>
        {slow
          ? 'Sigue en curso. Si la red va lenta, puede tardar un poco más.'
          : 'Sincronizando tu información.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: SPLASH_BACKGROUND,
  },
  logo: {
    width: 168,
    height: 168,
    marginBottom: 8,
  },
  title: {
    marginTop: 18,
    color: darkTheme.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: darkTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
