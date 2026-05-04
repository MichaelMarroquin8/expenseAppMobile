import { Ionicons } from "@expo/vector-icons";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DashboardScreen } from "../../features/dashboard/DashboardScreen";
import { TransactionsScreen } from "../../features/transactions/TransactionsScreen";
import { BudgetsScreen } from "../../features/budgets/BudgetsScreen";
import { SmsInboxScreen } from "../../features/sms/SmsInboxScreen";
import { SettingsScreen } from "../../features/settings/SettingsScreen";
import { GoalsScreen } from "../../features/goals/GoalsScreen";
import { ReportsScreen } from "../../features/reports/ReportsScreen";
import { CardsScreen } from "../../features/cards/CardsScreen";
import { useAppTheme } from "../../core/theme/ThemeProvider";

type RootStackParamList = {
  Tabs: undefined;
  Goals: undefined;
  Reports: undefined;
  Cards: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Budgets: undefined;
  Sms: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: 64 + Math.max(insets.bottom - 6, 0),
          paddingBottom: Math.max(insets.bottom - 2, 8),
          paddingTop: 6,
          marginBottom: 5,
          borderRadius: 18,
          position: "absolute",
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<
            keyof TabParamList,
            keyof typeof Ionicons.glyphMap
          > = {
            Dashboard: "grid-outline",
            Transactions: "swap-horizontal-outline",
            Budgets: "pie-chart-outline",
            Sms: "chatbubble-ellipses-outline",
            Settings: "settings-outline",
          };
          return (
            <Ionicons
              name={map[route.name as keyof TabParamList]}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "Inicio" }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: "Movs" }}
      />
      <Tab.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{ title: "Presupuestos" }}
      />
      <Tab.Screen
        name="Sms"
        component={SmsInboxScreen}
        options={{ title: "SMS" }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Más" }}
      />
    </Tab.Navigator>
  );
}

export function MainNavigator() {
  const { activeMode, theme } = useAppTheme();
  return (
    <NavigationContainer
      theme={{
        ...(activeMode === "dark" ? DarkTheme : DefaultTheme),
        colors: {
          ...(activeMode === "dark" ? DarkTheme.colors : DefaultTheme.colors),
          background: theme.background,
          card: theme.surface,
          border: theme.border,
          text: theme.text,
          primary: theme.primary,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Goals"
          component={GoalsScreen}
          options={{ title: "Metas" }}
        />
        <Stack.Screen
          name="Reports"
          component={ReportsScreen}
          options={{ title: "Reportes" }}
        />
        <Stack.Screen
          name="Cards"
          component={CardsScreen}
          options={{ title: "Tarjetas" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
