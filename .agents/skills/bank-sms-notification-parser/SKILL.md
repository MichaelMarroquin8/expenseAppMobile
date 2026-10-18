---
name: bank-sms-notification-parser
description: Agrega, ajusta y depura reglas de parseo de SMS bancarios (Bancolombia, Nu, BBVA, Nequi, etc.), correos de notificación y notificaciones de Google Wallet/Pay en ExpenseApp. Úsala cuando trabajes con src/domain/smsParser.ts, src/domain/notificationParser.ts, src/features/sms/, extracción de montos en COP/USD/MXN, comercios, últimos 4 dígitos o deduplicación de transacciones.
---

# Bank SMS & Wallet Notification Parser (`ExpenseApp`)

Guía para extender y depurar el motor heurístico de detección de transacciones por SMS, email y notificaciones de billetera en `ExpenseApp`.

## Archivos Clave

- `src/domain/smsParser.ts`: Parseo de SMS y correos (`parseSms`, `guessCategory`, `isLikelyDuplicate`).
- `src/domain/notificationParser.ts`: Parseo de notificaciones de Google Wallet / Google Pay (`parseWalletNotification`).
- `src/domain/models.ts`: Contrato `SmsDetection` y `Transaction`.
- `src/store/useFinanceStore.ts`: Acciones `processSmsBatch`, `processNotificationBatch`, `acceptSms`, `discardSms`.

## Flujo de Trabajo para Agregar o Ajustar un Banco / Formato

1. **Identificar canal y remitente confiable**:
   - En `src/domain/smsParser.ts`, verifica `BANCOLOMBIA_SHORT_CODES`, `BANCOLOMBIA_EMAIL_PATTERN` o `BANK_PATTERNS`.
   - En `src/domain/notificationParser.ts`, verifica `WALLET_PACKAGES` (sincronizado con `WalletNotificationListenerService.kt`).

2. **Reglas de parseo de montos (`COP` vs `USD`/`MXN`)**:
   - **Crítico en `COP`**: Los mensajes en pesos colombianos suelen usar `.` como separador de miles (`$45.000` o `$1.250.000`) o `,` para centavos (`$45.000,00`).
   - En `notificationParser.ts`, si la última parte tras `.` tiene exactamente 3 dígitos y no hay `,`, trátalo como separador de miles (`45.000` -> `45000`).
   - Verifica que `smsParser.ts` y `notificationParser.ts` mantengan consistencia al normalizar montos sin multiplicar ni dividir por 1000 accidentalmente.

3. **Extracción de Comercio (`merchant`) y Tarjeta (`last4`)**:
   - Extrae siempre los últimos 4 dígitos (`*1234`, `•••• 1234`, `terminación 1234`) para que `useFinanceStore` haga match automático con `state.cards.find((c) => c.last4 === parsed.last4)`.
   - Limpia prefijos genéricos del comercio (`Google Wallet`, `Pago`, espacios múltiples) y limita la longitud a 45-60 caracteres.

4. **Categorización automática (`guessCategory`)**:
   - Añade patrones en `CATEGORY_RULES` dentro de `src/domain/smsParser.ts` usando nombres de categorías que existan en `defaultTransactionCategories` (`Comida`, `Transporte`, `Supermercado`, `Entretenimiento`, `Servicios`, `Otros`).

5. **Deduplicación (`isLikelyDuplicate`)**:
   - El `id` determinístico se genera con `hashMessage`. No incluyas timestamps variables de lectura si el mensaje no trae fecha propia, o romperás la deduplicación por `id`.
   - Además del `id`, se compara contra `existingTransactions` por mismo monto (`Math.abs(tx.amount - candidate.amount) < 0.01`), mismo día y coincidencia parcial de `merchant`.

## Checklist de Validación

- [ ] Probar el parser con montos enteros en miles (`$45.000`, `$1.200.000`) y con decimales (`$12.50`, `$45.000,50`).
- [ ] Verificar que `last4` extraiga exactamente 4 dígitos numéricos o `undefined`.
- [ ] Confirmar que `isLikelyDuplicate` marque `duplicate: true` si el mismo mensaje se procesa dos veces.
- [ ] Asegurar que `acceptSms` en `useFinanceStore.ts` cree un `Transaction` válido con `source: 'sms' | 'notification'`.
