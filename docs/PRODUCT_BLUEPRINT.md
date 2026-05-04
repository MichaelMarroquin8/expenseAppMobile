# ExpenseApp Pro - Definicion de producto y arquitectura

## 1) Definicion completa del producto
- **Propuesta de valor:** app de finanzas personales con UX tipo fintech, foco en claridad, automatizacion (SMS) y accion (presupuesto/metas).
- **Usuarios objetivo:** empleados con ingresos fijos/variables, freelancers, usuarios con 1-3 tarjetas y necesidad de control diario.
- **JTBD principal:** "Quiero saber en que gasto, anticipar excesos y ahorrar sin friccion".
- **Pilares funcionales:** dashboard, transacciones, presupuestos, metas, reportes, tarjetas, deteccion SMS, onboarding y preferencias.
- **Metrica norte:** porcentaje de usuarios con registro semanal + confirmacion de SMS + al menos una meta activa.

## 2) Arquitectura recomendada
- **Frontend-first modular:** `domain` (modelos/reglas), `store` (estado y casos de uso), `features` (UI por modulo), `core` (tema/utils).
- **Clean-ish architecture para RN:** UI desacoplada del origen de datos mediante acciones del store.
- **Persistencia local:** `AsyncStorage` con versionado de schema.
- **Backend-ready:** interfaces de repositorio para migrar a API sin rehacer pantallas.

## 3) Stack recomendado para React Native (Expo)
- Expo + React Native + TypeScript estricto.
- React Navigation (stack + bottom tabs).
- Zustand + persist middleware.
- AsyncStorage para offline/local.
- Expo Linear Gradient + sistema de design tokens.
- Testing recomendado: Jest + React Native Testing Library + Detox (fase posterior).

## 4) Estructura de carpetas
- `src/app`: composicion raiz, navegacion.
- `src/core`: tema, utilidades compartidas.
- `src/domain`: entidades y logica de parseo SMS.
- `src/store`: estado global y acciones.
- `src/features/*`: modulos UI por bounded context.
- `src/components`: primitives reutilizables.

## 5) Entidades/modelos principales
- `Transaction`: ingreso/gasto, categoria/subcategoria, metodo, comercio, fecha, recurrencia, fuente.
- `Budget`: limite global o por categoria por mes.
- `SavingsGoal`: meta, monto objetivo, progreso, aportes auto.
- `PaymentCard`: alias, banco, tipo, ultimos4, cupo/corte/pago opcionales.
- `SmsDetection`: mensaje parseado, match de tarjeta, estado pendiente/aceptado/descartado, bandera de duplicado.
- `AppSettings`: moneda, tema, recordatorios.

## 6) Flujos de usuario
- **Onboarding:** bienvenida -> valor -> entrar al dashboard.
- **Transaccion manual:** crear -> categorizar -> guardar -> reflejo inmediato en dashboard/reportes.
- **SMS:** procesar mensajes -> detectar -> revisar pendiente -> confirmar/descartar.
- **Presupuesto:** revisar consumo -> alerta visual por umbral.
- **Meta:** aportar manualmente -> progreso visual.
- **Reportes:** revisar balance y tendencias semanales.

## 7) Modulos de la app (frontend actual)
- Dashboard financiero.
- Gestion de transacciones (crear/eliminar, busqueda simple).
- Presupuestos (global y por categoria).
- Metas de ahorro.
- Reportes basicos.
- Tarjetas/metodos de pago (datos no sensibles).
- Deteccion SMS demo con confirmacion manual y deduplicacion.
- Configuracion (tema, moneda, recordatorios) y accesos a modulos avanzados.

## 8) Roadmap por fases
- **Fase 1 (actual):** frontend completo + estado local + UX premium + reglas SMS heuristicas.
- **Fase 2:** autenticacion real, sync nube, notificaciones, exportacion CSV/PDF.
- **Fase 3:** motor de reglas avanzado (ML light), OCR de tickets, insights inteligentes.
- **Fase 4:** open banking/aggregators (segun pais), multi-dispositivo y seguridad reforzada.

## 9) Riesgos tecnicos y decisiones importantes
- **Lectura SMS real:** en Expo Managed no existe lectura inbox directa multiplataforma; requiere modulo nativo Android.
- **Privacidad financiera:** almacenar solo metadatos de tarjeta y cifrar datos sensibles locales.
- **Escalabilidad de estado:** mantener acciones de dominio en store y evitar logica en componentes.
- **Migracion backend:** definir contractos/repositories para reducir deuda tecnica al conectar API.

## 10) Claves para UX premium (no CRUD basico)
- Design tokens consistentes, espaciado amplio y tipografia jerarquica.
- Microinteracciones (feedback al confirmar SMS, estados vacios pulidos, skeletons en fases siguientes).
- Visualizaciones simples y legibles enfocadas en decisiones.
- Copy financiero claro ("ahorro", "riesgo", "alerta") y no solo datos crudos.
- Performance: listas ligeras, memoizacion y render por modulo.
