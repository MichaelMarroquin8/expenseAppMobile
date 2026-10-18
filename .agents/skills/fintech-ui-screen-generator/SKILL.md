---
name: fintech-ui-screen-generator
description: Crea y modifica pantallas, modales y componentes visuales en ExpenseApp siguiendo el sistema de diseño fintech, soporte de tema claro/oscuro, formateo de monedas y navegación React Navigation. Úsala cuando trabajes en src/features/*, src/components/ui.tsx, src/core/theme/, src/core/utils/format.ts o src/app/navigation/MainNavigator.tsx.
---

# Fintech UI & Screen Generator (`ExpenseApp`)

Guía de estilo, componentes base y patrones de UX para construir o editar pantallas e interfaces dentro de `ExpenseApp`.

## Primitivas y Sistema de Diseño

- **Tema (`src/core/theme/ThemeProvider.tsx` y `tokens.ts`)**:
  - Nunca uses colores hexadecimales fijos para fondos, textos o bordes de contenedores. Consume siempre `const { theme, activeMode } = useAppTheme();`.
  - Tokens disponibles en `theme`: `background`, `surface`, `card`, `text`, `textMuted`, `primary`, `success`, `warning`, `danger`, `border`.
- **Componentes Base (`src/components/ui.tsx`)**:
  - Envuelve cada pantalla principal en `<Screen>...</Screen>` (maneja `SafeAreaView` y `theme.background`).
  - Usa `<PremiumCard style={...}>` para tarjetas o bloques de información (aplica `LinearGradient` en modo claro y superficie con borde en modo oscuro).
  - Usa `<SectionTitle title="..." subtitle="..." />` para encabezados de sección consistentes.
- **Iconografía**:
  - Usa `Ionicons` de `@expo/vector-icons`. Para categorías, consulta `categoryIcons` desde `useFinanceStore` con fallback a `'pricetag-outline'`.

## Formateo de Dinero, Inputs y Fechas (`src/core/utils/format.ts`)

- **Mostrar montos**: Usa siempre `formatMoney(amount, settings.currency)` (respeta `0` decimales en `COP`/`CLP` y `2` decimales en `USD`/`MXN`/`EUR`).
- **Inputs numéricos de montos**:
  - En el estado local del input guarda el valor limpio retornado por `parseAmountInput(text, currency)`.
  - En la prop `value` del `<TextInput>` muestra el valor formateado con `formatAmountInput(rawAmount, currency)` y usa `keyboardType="numeric"`.
- **Fechas**: Usa `formatShortDate(isoDate)` para listas de movimientos y `monthKey(date)` (`YYYY-MM`) para presupuestos mensuales.

## Reglas de Arquitectura en Pantallas (`src/features/*`)

1. **Separación UI vs Dominio**:
   - Los componentes en `src/features/*` solo leen selectores de `useFinanceStore` y disparan acciones del store. No mutan balances ni escriben en `AsyncStorage` o Firebase directamente.
2. **Espaciado para el TabBar flotante y botón QuickAdd**:
   - Las pantallas dentro de `Tab.Navigator` (`Dashboard`, `Transactions`, `Insights`, `Sms`, `Settings`) conviven con una barra inferior flotante y el botón flotante `+` (`quickAddButton`). Añade `paddingBottom: 110` (o similar) al `contentContainerStyle` del `ScrollView`/`FlatList` principal para que ningún contenido quede oculto.
   - `BudgetsScreen` vive en el stack secundario (`Más → Presupuestos`), no en tabs.
3. **Registro en Navegación (`src/app/navigation/MainNavigator.tsx`)**:
   - Si agregas una pantalla secundaria, regístrala en `RootStackParamList` y como `<Stack.Screen>` en `MainNavigator.tsx`, añadiendo su acceso desde `SettingsScreen.tsx` o `DashboardScreen.tsx`.
   - Toda la interfaz de usuario y textos visibles deben estar en **español** con copy financiero claro.
