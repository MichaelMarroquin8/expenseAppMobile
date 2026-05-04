import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { MainNavigator } from './navigation/MainNavigator';
import { AppThemeProvider, useAppTheme } from '../core/theme/ThemeProvider';
import { useFinanceStore } from '../store/useFinanceStore';

function RootSwitch() {
  const onboardingDone = useFinanceStore((state) => state.onboardingDone);
  const { activeMode } = useAppTheme();

  return (
    <>
      {onboardingDone ? <MainNavigator /> : <OnboardingScreen />}
      <StatusBar style={activeMode === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export function AppRoot() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <RootSwitch />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
