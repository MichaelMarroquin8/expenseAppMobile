# Auto SMS Android - Fase B (Native Bridge)

Este proyecto ya tiene Fase A en frontend:
- Boton "Activar Auto Android"
- Solicitud de permisos SMS
- Sincronizacion periodica
- Parseo y confirmacion en bandeja

Para completar Fase B (lectura real inbox), crea un modulo nativo Android llamado `BancolombiaSmsBridge` con este contrato:

## Contrato esperado por JS

Metodo:

`listRecentBySenders({ senders: string[], sinceTimestamp?: number, limit?: number }) => Promise<Array<{ address: string, body: string, date: number }>>`

## Implementacion sugerida

1. Crear modulo nativo Java/Kotlin en Android.
2. Usar `ContentResolver` contra `content://sms/inbox`.
3. Filtrar por `address IN (85540, 85784)`.
4. Ordenar por `date DESC`.
5. Limitar por `limit`.
6. Mapear resultados al formato esperado y devolver como `WritableArray`.

Consulta SQL orientativa:

- projection: `address`, `body`, `date`
- selection: `address = ? OR address = ?`
- selectionArgs: `["85540", "85784"]`
- sortOrder: `date DESC LIMIT 50`

## Requisitos de build

- Development Build Android (Expo Go no soporta este bridge).
- Permisos en manifest:
  - `android.permission.READ_SMS`
  - `android.permission.RECEIVE_SMS`

## Flujo final

1. Usuario activa Auto Android.
2. App pide permisos SMS.
3. Bridge devuelve mensajes reales.
4. JS parsea, deduplica y crea pendientes de confirmacion.
5. Usuario confirma/descarta movimientos.
