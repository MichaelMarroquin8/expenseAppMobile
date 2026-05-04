import { Ionicons } from "@expo/vector-icons";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DashboardScreen } from "../../features/dashboard/DashboardScreen";
import { TransactionsScreen } from "../../features/transactions/TransactionsScreen";
import { BudgetsScreen } from "../../features/budgets/BudgetsScreen";
import { SmsInboxScreen } from "../../features/sms/SmsInboxScreen";
import { SettingsScreen } from "../../features/settings/SettingsScreen";
import { GoalsScreen } from "../../features/goals/GoalsScreen";
import { ReportsScreen } from "../../features/reports/ReportsScreen";
import { CardsScreen } from "../../features/cards/CardsScreen";
import { AccountsScreen } from "../../features/accounts/AccountsScreen";
import { useAppTheme } from "../../core/theme/ThemeProvider";
import { QuickAddTransactionModal } from "../../features/transactions/QuickAddTransactionModal";

type RootStackParamList = {
  Tabs: undefined;
  Goals: undefined;
  Reports: undefined;
  Cards: undefined;
  Accounts: undefined;
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  return (
    <View style={styles.tabsContainer}>
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
            marginHorizontal: 10,
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

      <Pressable
        style={[
          styles.quickAddButton,
          {
            bottom: Math.max(insets.bottom + 46, 56),
            backgroundColor: theme.primary,
            borderColor: theme.surface,
          },
        ]}
        onPress={() => setQuickAddOpen(true)}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>

      <QuickAddTransactionModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
    </View>
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
        <Stack.Screen
          name="Accounts"
          component={AccountsScreen}
          options={{ title: "Cuentas" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    flex: 1,
  },
  quickAddButton: {
    position: "absolute",
    right: 22,
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
