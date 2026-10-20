import { Ionicons } from "@expo/vector-icons";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DashboardScreen } from "../../features/dashboard/DashboardScreen";
import { TransactionsScreen } from "../../features/transactions/TransactionsScreen";
import { InsightsScreen } from "../../features/insights/InsightsScreen";
import { BudgetsScreen } from "../../features/budgets/BudgetsScreen";
import { SmsInboxScreen } from "../../features/sms/SmsInboxScreen";
import { SettingsScreen } from "../../features/settings/SettingsScreen";
import { GoalsScreen } from "../../features/goals/GoalsScreen";
import { ReportsScreen } from "../../features/reports/ReportsScreen";
import { CardsScreen } from "../../features/cards/CardsScreen";
import { CardDetailScreen } from "../../features/cards/CardDetailScreen";
import { AccountsScreen } from "../../features/accounts/AccountsScreen";
import { AccountDetailScreen } from "../../features/accounts/AccountDetailScreen";
import { AccountFormScreen } from "../../features/accounts/AccountFormScreen";
import { CategoriesScreen } from "../../features/categories";
import { CurrencySelectScreen } from "../../features/settings/CurrencySelectScreen";
import { useAppTheme } from "../../core/theme/ThemeProvider";
import { QuickAddTransactionModal } from "../../features/transactions/QuickAddTransactionModal";
import { TransactionDetailScreen } from "../../features/transactions/TransactionDetailScreen";

type RootStackParamList = {
  Tabs: undefined;
  Goals: undefined;
  Reports: undefined;
  Cards: undefined;
  CardDetail: { cardId: string };
  Accounts: undefined;
  AccountDetail: { accountId: string };
  AccountForm: { accountId?: string } | undefined;
  Categories: undefined;
  Budgets: undefined;
  CurrencySelect: undefined;
  TransactionDetail: { transactionId: string };
};

export type TabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Insights: undefined;
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
          // Evita que React Navigation sume el inset otra vez y deje un hueco bajo la barra.
          safeAreaInsets: { top: 0, bottom: 0 },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarButton: ({
            style,
            pressColor: _pressColor,
            pressOpacity: _pressOpacity,
            hoverEffect: _hoverEffect,
            onPress,
            ...rest
          }) => (
            <Pressable
              {...rest}
              android_ripple={null}
              style={style}
              onPress={(event) => {
                // En web el tab es un <a href>. Sin cancelar la navegación nativa,
                // el navegador recarga la página y la app vuelve al dashboard.
                if (Platform.OS === "web" && event != null && "preventDefault" in event) {
                  const webEvent = event as unknown as {
                    metaKey?: boolean;
                    altKey?: boolean;
                    ctrlKey?: boolean;
                    shiftKey?: boolean;
                    button?: number;
                    preventDefault: () => void;
                  };
                  const hasModifier =
                    webEvent.metaKey ||
                    webEvent.altKey ||
                    webEvent.ctrlKey ||
                    webEvent.shiftKey;
                  const isLeftClick = webEvent.button == null || webEvent.button === 0;
                  if (hasModifier || !isLeftClick) {
                    return;
                  }
                  webEvent.preventDefault();
                }
                onPress?.(event);
              }}
            />
          ),
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            height: 58 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
            margin: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            position: "absolute",
            elevation: 0,
          },
          tabBarIcon: ({ color, focused, size }) => {
            const map: Record<
              keyof TabParamList,
              keyof typeof Ionicons.glyphMap
            > = {
              Dashboard: focused ? "grid" : "grid-outline",
              Transactions: focused
                ? "swap-horizontal"
                : "swap-horizontal-outline",
              Insights: focused ? "pie-chart" : "pie-chart-outline",
              Sms: focused
                ? "chatbubble-ellipses"
                : "chatbubble-ellipses-outline",
              Settings: focused ? "settings" : "settings-outline",
            };
            return (
              <View
                style={[
                  styles.tabIconSlot,
                  focused && { backgroundColor: theme.border },
                ]}
              >
                <Ionicons
                  name={map[route.name as keyof TabParamList]}
                  size={size}
                  color={color}
                />
              </View>
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
          name="Insights"
          component={InsightsScreen}
          options={{ title: "Gráficos" }}
        />
        <Tab.Screen
          name="Sms"
          component={SmsInboxScreen}
          options={{ title: "Inbox" }}
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
          name="CardDetail"
          component={CardDetailScreen}
          options={{ title: "Tarjeta", headerTitleAlign: "center" }}
        />
        <Stack.Screen
          name="Accounts"
          component={AccountsScreen}
          options={{ title: "Cuentas" }}
        />
        <Stack.Screen
          name="AccountDetail"
          component={AccountDetailScreen}
          options={{ title: "Detalles", headerTitleAlign: "center" }}
        />
        <Stack.Screen
          name="AccountForm"
          component={AccountFormScreen}
          options={({ route }) => ({
            headerTitleAlign: "center",
            title:
              route.params && "accountId" in route.params && route.params.accountId
                ? "Editar"
                : "Nueva cuenta",
          })}
        />
        <Stack.Screen
          name="Categories"
          component={CategoriesScreen}
          options={{ title: "Categorías" }}
        />
        <Stack.Screen
          name="Budgets"
          component={BudgetsScreen}
          options={{ title: "Presupuestos" }}
        />
        <Stack.Screen
          name="CurrencySelect"
          component={CurrencySelectScreen}
          options={{ headerShown: false, title: "Seleccionar" }}
        />
        <Stack.Screen
          name="TransactionDetail"
          component={TransactionDetailScreen}
          options={{ title: "Detalles", headerTitleAlign: "center" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    flex: 1,
  },
  tabIconSlot: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
