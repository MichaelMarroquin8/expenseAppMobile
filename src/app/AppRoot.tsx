import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { BootScreen, SPLASH_BACKGROUND } from './BootScreen';
import { MainNavigator } from './navigation/MainNavigator';
import { AppThemeProvider, useAppTheme } from '../core/theme/ThemeProvider';
import { CaptureBridgeProvider } from '../features/sms/CaptureBridgeProvider';
import { useFinanceStore } from '../store/useFinanceStore';

void SplashScreen.preventAutoHideAsync();

function RootSwitch() {
  const onboardingDone = useFinanceStore((state) => state.onboardingDone);
  const { activeMode, theme } = useAppTheme();
  const { loading } = useAuth();
  const [hydrated, setHydrated] = useState(() => useFinanceStore.persist.hasHydrated());

  useEffect(() => {
    if (useFinanceStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useFinanceStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  const [bootTimedOut, setBootTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBootTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  const booting = (loading || !hydrated) && !bootTimedOut;

  return (
    <View style={[styles.root, { backgroundColor: booting ? SPLASH_BACKGROUND : theme.background }]}>
      {booting ? <BootScreen /> : onboardingDone ? <MainNavigator /> : <OnboardingScreen />}
      <StatusBar style={booting || activeMode === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

export function AppRoot() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppThemeProvider>
          <CaptureBridgeProvider>
            <RootSwitch />
          </CaptureBridgeProvider>
        </AppThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
