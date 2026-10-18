import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { MainNavigator } from './navigation/MainNavigator';
import { AppThemeProvider, useAppTheme } from '../core/theme/ThemeProvider';
import { CaptureBridgeProvider } from '../features/sms/CaptureBridgeProvider';
import { useFinanceStore } from '../store/useFinanceStore';

function RootSwitch() {
  const onboardingDone = useFinanceStore((state) => state.onboardingDone);
  const { activeMode } = useAppTheme();
  const { loading } = useAuth();

  return (
    <>
      {loading ? null : onboardingDone ? <MainNavigator /> : <OnboardingScreen />}
      <StatusBar style={activeMode === 'dark' ? 'light' : 'dark'} />
    </>
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
