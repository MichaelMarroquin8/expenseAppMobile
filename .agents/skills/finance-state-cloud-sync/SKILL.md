---
name: finance-state-cloud-sync
description: Gestiona cambios en el modelo de dominio, estado global con Zustand, persistencia local en AsyncStorage y sincronización en la nube con Firebase Firestore en ExpenseApp. Úsala cuando modifiques src/domain/models.ts, src/store/useFinanceStore.ts, src/backend/cloudSync.ts o src/features/auth/AuthProvider.tsx.
---

# Finance State & Cloud Sync (`ExpenseApp`)

Guía para evolucionar el estado financiero garantizando consistencia entre Zustand, `AsyncStorage` (`expenseapp-storage-v2`) y Firebase Firestore (`users/{uid}/finance/main`).

## Archivos del Ecosistema de Datos

1. `src/domain/models.ts`: Interfaces de dominio (`Transaction`, `FinanceAccount`, `Budget`, `SavingsGoal`, `PaymentCard`, `SmsDetection`, `AppSettings`).
2. `src/store/useFinanceStore.ts`: Store Zustand con middleware `persist`, `merge` de hidratación, `partialize` y cálculo de balances (`applyAccountMovement`).
3. `src/backend/cloudSync.ts`: Interfaz `FinanceCloudSnapshot`, `loadCloudSnapshot` y `saveCloudSnapshot`.
4. `src/features/auth/AuthProvider.tsx`: `extractSnapshot`, hidratación inicial al iniciar sesión y suscripción con debounce (`900ms`) para subir cambios a Firestore.

## Flujo Obligatorio al Añadir o Modificar Propiedades del Estado

Cada vez que agregues o modifiques una entidad o propiedad en el estado global, **debes actualizar los 4 puntos en orden**:

1. **Modelo (`src/domain/models.ts`)**:
   - Define o actualiza la interfaz TypeScript. Prefiere campos opcionales (`campo?: tipo`) si el dato no existía en versiones previas guardadas en dispositivos o Firestore.

2. **Store y Persistencia Local (`src/store/useFinanceStore.ts`)**:
   - Añade la propiedad y sus acciones en `FinanceState`.
   - Define su valor por defecto en el estado inicial.
   - **Hidratación segura (`merge`)**: Sanitiza el valor proveniente de `persistedState` (ej. verificando `Array.isArray(...)` o usando `coerceBoolean` para evitar crashes por tipos corruptos en `AsyncStorage`).
   - **Serialización (`partialize`)**: Incluye explícitamente la nueva clave en el objeto devuelto por `partialize`.

3. **Contrato Cloud (`src/backend/cloudSync.ts`)**:
   - Añade la propiedad en `FinanceCloudSnapshot`.

4. **Sincronización en Auth (`src/features/auth/AuthProvider.tsx`)**:
   - Incluye la propiedad en `extractSnapshot()`.
   - En el bloque `onAuthStateChanged` donde se aplica `useFinanceStore.setState({ ...cloud, ... })`, asegura un fallback seguro si el documento en Firestore de un usuario antiguo aún no tiene esa propiedad.

## Reglas de Integridad Financiera

- **Movimientos de cuentas (`applyAccountMovement`)**:
  - Al crear (`addTransaction`) o eliminar (`deleteTransaction`) una transacción con `accountId` (y `destinationAccountId` en `transfer`), actualiza siempre el balance de las cuentas afectadas usando `applyAccountMovement(state.accounts, tx, 'apply' | 'revert')`.
  - Si modificas `updateTransaction` para permitir cambiar `amount`, `type` o `accountId`, primero revierte el movimiento anterior y luego aplica el nuevo.
- **Prevención de loops de sincronización**:
  - En `AuthProvider.tsx`, `syncPausedRef.current = true` debe mantenerse activo mientras se hidrata el store desde `loadCloudSnapshot` para no disparar un `saveCloudSnapshot` innecesario.
- **Categorías protegidas**:
  - No permitas eliminar las categorías base `'Otros'`, `'Salario'` ni `'Otros ingresos'`.
