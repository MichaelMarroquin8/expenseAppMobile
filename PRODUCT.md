# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Cualquier persona que lleve sus finanzas personales. El caso que el producto cubre hoy es Colombia: Bancolombia, Nu, Nequi, Daviplata, BBVA y Google Wallet. Ese caso no es el límite del producto. Qué países, bancos o idiomas vienen después queda sin decidir.

El trabajo es mantener un libro propio de dinero: ingresos, gastos, transferencias, cuentas, tarjetas, presupuestos, metas, inversiones y deudas por cobrar. No hay libro compartido ni varios usuarios sobre los mismos datos.

## Product Purpose

ExpenseApp es el libro de finanzas personales en el teléfono. Existe para que una persona registre, revise y organice su dinero en un solo lugar. El éxito es un libro completo y usable: no solo una lista de gastos.

## Positioning

La tesis es el sistema completo de finanzas personales: cuentas, tarjetas, presupuestos, metas de ahorro, inversiones y deudas, junto con el movimiento. La captura automática desde SMS y notificaciones es una función de ese sistema, no la tesis. Un tracker que solo anota gastos, o que solo lee SMS, no ocupa este lugar.

## Operating Context

- El uso real es en un teléfono Android, en vertical. iOS y web pueden ejecutar la misma interfaz; no deciden el diseño ni las capacidades nativas.
- La interfaz está en español.
- Los movimientos entran a mano. En Android también pueden entrar desde SMS y desde notificaciones de las apps bancarias y de Google Wallet que el usuario tenga activas.
- Los datos viven primero en el dispositivo. Si hay sesión, se sincronizan con Firebase Firestore.
- La moneda predeterminada de una instalación nueva es COP. Un movimiento puede registrarse en otra moneda y guardarse con su tasa.

## Capabilities and Constraints

Lo que el producto hace hoy:

- Libro de ingresos, gastos y transferencias, con categoría, comercio, nota, etiquetas y detalle.
- Cuentas (efectivo, débito, crédito, virtual, banco, billetera, inversión, por cobrar, por pagar, broker) con saldo y últimos 4 dígitos para emparejar avisos.
- Tarjetas de crédito y débito, con cupo, día de corte y día de pago.
- Presupuestos por categoría y mes, metas de ahorro, tenencias de inversión con cotización, y deudas por cobrar con abonos.
- Categorías, insights y reportes.
- Tema claro, oscuro o según el sistema.
- Sesión opcional con correo, Google, Facebook o Apple, vía Firebase. Sin sesión la app sigue en local.
- En Android, lectura de SMS y escucha de notificaciones. Requiere un development build; no corre en Expo Go. Los presets actuales son Google Wallet / Pay, Bancolombia, Nu, Nequi, BBVA y Daviplata.
- Paquete `com.michart.ExpenseApp`. Stack ya resuelto por el repo: Expo, React Native y TypeScript.

Restricciones que el trabajo futuro preserva:

- Android manda el diseño y las capacidades nativas. La captura por SMS y notificaciones es solo de Android.
- No se inventan bancos, mercados, precios, testimonios ni cobertura que el producto no tenga.
- La voz de marca, el nombre comercial «ExpenseApp Pro» del onboarding y un estándar de accesibilidad propio no están decididos. El nombre que ya publica la app es ExpenseApp.

## Evidence on Hand

- La app en `src/`, con navegación, dominio y pantallas ya construidas.
- Icono, icono adaptativo, splash y favicon en `assets/`.
- No hay testimonios, casos, prensa, precios ni ficha de tienda confirmados. El trabajo futuro no los fabrica.

## Product Principles

1. El libro completo manda: cuentas, tarjetas, presupuestos, metas, inversiones y deudas cuentan tanto como el movimiento.
2. La captura automática llena el libro. No define el producto.
3. La experiencia se decide para Android. iOS y web reciben la misma interfaz.
4. Colombia es el caso que existe hoy. No se presenta como techo del producto ni se inventan otros mercados.
5. Los datos viven primero en el dispositivo. La nube es una sesión opcional.
