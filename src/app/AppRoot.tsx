import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { AuthScreen } from '../features/auth/AuthScreen';
import { MainNavigator } from './navigation/MainNavigator';
import { AppThemeProvider, useAppTheme } from '../core/theme/ThemeProvider';
import { useFinanceStore } from '../store/useFinanceStore';

function RootSwitch() {
  const onboardingDone = useFinanceStore((state) => state.onboardingDone);
  const { activeMode } = useAppTheme();
  const { user, loading, isConfigured } = useAuth();

  return (
    <>
      {loading ? null : isConfigured && !user ? <AuthScreen /> : onboardingDone ? <MainNavigator /> : <OnboardingScreen />}
      <StatusBar style={activeMode === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export function AppRoot() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppThemeProvider>
          <RootSwitch />
        </AppThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
