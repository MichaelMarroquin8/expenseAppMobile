---
name: android-native-bridge-expo
description: Crea, mantiene y depura módulos nativos Android en Kotlin para React Native y Expo Development Build en ExpenseApp. Úsala cuando trabajes en android/app/src/main/java/com/michart/ExpenseApp/, AndroidManifest.xml, BancolombiaSmsBridge, NotificationBridge, WalletNotificationListenerService o sus wrappers TypeScript en src/features/sms/.
---

# Android Native Bridge & Expo Dev Client (`ExpenseApp`)

Guía para desarrollar y mantener los puentes nativos Kotlin (`ReactContextBaseJavaModule`) y servicios Android (`NotificationListenerService`, `ContentResolver` de SMS) en `ExpenseApp`.

## Arquitectura Nativa Actual

- **Paquete Android**: `com.michart.ExpenseApp` (`android/app/src/main/java/com/michart/ExpenseApp/`)
- **Módulos registrados en `MainApplication.kt`**:
  1. `BancolombiaSmsBridgeModule.kt` + `BancolombiaSmsBridgePackage.kt`: Lee `content://sms/inbox` filtrando por remitentes y fecha.
  2. `NotificationBridgeModule.kt` + `NotificationBridgePackage.kt` + `WalletNotificationListenerService.kt`: Escucha notificaciones de paquetes de billetera (`com.google.android.apps.walletnfcrel`, `com.google.android.gms`, `com.google.android.apps.nbu.paisa.user`), las guarda en `SharedPreferences` (`expenseapp_wallet_notifications`) y emite eventos `WalletNotificationCaptured` a JS.
- **Wrappers JS/TS**:
  - `src/features/sms/androidSmsAuto.ts`
  - `src/features/sms/androidNotificationAuto.ts`

## Reglas para Modificar o Crear Módulos Nativos Kotlin

1. **Seguridad de Hilos y Ciclo de Vida**:
   - Todo método expuesto con `@ReactMethod` que retorne datos a JS debe usar `Promise` y envolver su cuerpo en `try { ... } catch (e: Exception) { promise.reject("CODIGO_ERROR", e.message, e) }`.
   - Al consultar `ContentResolver.query(...)`, usa siempre `cursor?.use { c -> ... }` para evitar fugas de memoria/cursores abiertos.
   - Si emites eventos en tiempo real con `RCTDeviceEventEmitter`, verifica primero `if (!ctx.hasActiveReactInstance()) return` y mantén siempre un buffer en `SharedPreferences` por si la app estaba en background sin instancia JS activa.

2. **Tipos en el Bridge (Kotlin <-> JS)**:
   - Los timestamps (`Long` en Kotlin) deben enviarse a JS como `Double` (`row.putDouble("date", date.toDouble())`) y leerse desde `ReadableMap` con `params.getDouble("sinceTimestamp").toLong()`, ya que el bridge estándar de React Native no transporta `Long` de 64 bits directamente.
   - Implementa `addListener(eventName: String?)` y `removeListeners(count: Int)` en cualquier módulo que use `NativeEventEmitter` en TypeScript.

3. **Degradación Elegante en JS (`Platform.OS === 'android'`)**:
   - En los archivos `.ts`, nunca llames a `NativeModules.<Nombre>` directamente desde los componentes UI.
   - Expón siempre un helper `isAndroid...Available(): boolean` que valide `Platform.OS === 'android' && Boolean(NATIVE_MODULE?.metodo)` para que la app no falle en iOS, Web o Expo Go.

4. **Permisos y `AndroidManifest.xml`**:
   - Si añades permisos o servicios en `android/app/src/main/AndroidManifest.xml`, sincroniza también los permisos correspondientes en `app.json` (`expo.android.permissions`).
   - Recuerda que cualquier cambio en código Kotlin o `AndroidManifest.xml` requiere recompilar el cliente de desarrollo con `npx expo run:android`.
