import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, Theme } from './tokens';
import { useFinanceStore } from '../../store/useFinanceStore';

interface ThemeContextValue {
  theme: Theme;
  activeMode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  activeMode: 'light',
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preferredScheme = useFinanceStore((state) => state.settings.colorScheme);

  const activeMode: 'light' | 'dark' = useMemo(() => {
    if (preferredScheme === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
    return preferredScheme;
  }, [preferredScheme, systemScheme]);

  const value = useMemo(
    () => ({
      theme: activeMode === 'dark' ? darkTheme : lightTheme,
      activeMode,
    }),
    [activeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);
