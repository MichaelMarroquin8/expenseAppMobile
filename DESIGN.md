---
name: ExpenseApp
description: Escritorio de saldo para el libro de finanzas personales.
colors:
  statement-blue: "#2563EB"
  statement-blue-wash: "#2563EB20"
  statement-paper: "#F5F7FB"
  statement-ink: "#0F172A"
  statement-muted: "#64748B"
  statement-line: "#E2E8F0"
  surface-white: "#FFFFFF"
  card-wash: "#F8FAFC"
  confirmed-green: "#10B981"
  pending-amber: "#F59E0B"
  rejected-red: "#EF4444"
  night-statement: "#020617"
  night-surface: "#0B1220"
  night-card: "#111827"
  night-text: "#E2E8F0"
  night-muted: "#94A3B8"
  night-line: "#1E293B"
  signal-clear: "#60A5FA"
  confirmed-green-night: "#34D399"
  pending-amber-night: "#FBBF24"
  rejected-red-night: "#F87171"
  scrim: "rgba(2, 6, 23, 0.72)"
typography:
  display:
    fontFamily: "Roboto, sans-serif"
    fontSize: "34px"
    fontWeight: 800
  headline:
    fontFamily: "Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  title:
    fontFamily: "Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  body:
    fontFamily: "Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
rounded:
  control: "12px"
  slot: "16px"
  tab: "18px"
  container: "20px"
  fab: "31px"
  pill: "999px"
spacing:
  tight: "8px"
  stack: "12px"
  page: "16px"
  dialog: "20px"
  gutter: "24px"
components:
  button-primary:
    backgroundColor: "{colors.statement-blue}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-primary-night:
    backgroundColor: "{colors.signal-clear}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.statement-ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.statement-ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.statement-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  chip-selected:
    backgroundColor: "{colors.statement-blue-wash}"
    textColor: "{colors.statement-blue}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.statement-ink}"
    rounded: "{rounded.container}"
    padding: "16px"
  card-night:
    backgroundColor: "{colors.night-card}"
    textColor: "{colors.night-text}"
    rounded: "{rounded.container}"
    padding: "16px"
  nav:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.statement-muted}"
    rounded: "{rounded.tab}"
    height: "58px"
  nav-active:
    backgroundColor: "{colors.statement-line}"
    textColor: "{colors.statement-blue}"
    rounded: "{rounded.slot}"
    height: "32px"
    width: "56px"
  fab:
    backgroundColor: "{colors.statement-blue}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.fab}"
    size: "62px"
    width: "62px"
    height: "62px"
---

# Design System: ExpenseApp

## Overview

**Creative North Star: "El escritorio de saldo"**

El escritorio de saldo es una mesa de trabajo para mirar el mes: saldo, cuentas, presupuestos y el movimiento, en una sola columna de teléfono. La voz es de herramienta sobria. El radio amplio de las tarjetas y el lavado de blanco a gris claro son el gesto táctil. No hay oro, no hay un oscuro de lujo y no hay adorno «premium».

La densidad es de extracto, no de campaña. El número grande es el saldo. Los títulos de sección quedan un escalón abajo. Tinta azul marca la acción, la pestaña activa y el filtro elegido. Verde confirmado, Ámbar pendiente y Rojo rechazado nombran estados del dinero. El resto de la pantalla es papel, tinta y línea.

De noche es el mismo escritorio: Noche de extracto, Tarjeta de noche, Texto de noche y Señal clara. Cambia el valor, no la geometría ni el nombre de los estados. La barra y el botón de agregar flotan sobre el contenido. Las tarjetas en reposo no flotan.

**Key Characteristics:**

- Una columna de teléfono, con padding de página 16.
- Tarjeta de radio 20, filete de 1 px y, en claro, lavado de #FFFFFF a #F8FAFC.
- Controles de radio 12. La píldora queda en chips y barras de progreso.
- Sombra estructural solo en lo levantado. Hoy la lleva el botón de agregar.
- La noche repite la geometría con tokens propios.

## Colors

La paleta es un extracto: un azul de tinta, papel frío, y tres colores que solo nombran el estado del dinero. El esquema de noche usa los mismos oficios con otros valores.

### Primary

- **Tinta azul** (`statement-blue`): la acción principal, el botón de agregar, la pestaña activa y el chip elegido. En claro es el único acento de marca.
- **Lavado de tinta** (`statement-blue-wash`): el fondo del chip elegido. Es Tinta azul con alfa, no un segundo azul.
- **Señal clara** (`signal-clear`): el mismo oficio de noche. Botones llenos, pestaña activa y chip elegido cuando el esquema es oscuro.

### Neutral

- **Fondo de extracto** (`statement-paper`): el lienzo de la pantalla en claro, detrás de las tarjetas.
- **Superficie** (`surface-white`): barra, diálogos y el anillo del botón de agregar en claro.
- **Lavado de tarjeta** (`card-wash`): el extremo del degradado de la tarjeta clara. Sale de Superficie y llega aquí.
- **Texto de extracto** (`statement-ink`): cifras, títulos y cuerpo en claro.
- **Texto secundario** (`statement-muted`): subtítulos, metadatos, placeholders y pestañas en reposo.
- **Línea de extracto** (`statement-line`): filetes de tarjeta, campo y chip, y el fondo de la pestaña activa.
- **Noche de extracto** (`night-statement`): el lienzo de noche.
- **Superficie de noche** (`night-surface`): barra y cabeceras de noche, y el anillo del botón de agregar cuando el esquema es oscuro.
- **Tarjeta de noche** (`night-card`): la tarjeta oscura. Va plana, sin el lavado de la tarjeta clara.
- **Texto de noche** (`night-text`): cifras y títulos sobre Tarjeta de noche.
- **Texto secundario de noche** (`night-muted`): metadatos en el esquema oscuro.
- **Línea de noche** (`night-line`): filetes cuando el esquema es oscuro.
- **Velo** (`scrim`): el fondo del diálogo de confirmación.

### Status

- **Verde confirmado** (`confirmed-green` de día, `confirmed-green-night` de noche): ingreso, ahorro y estado a salvo.
- **Ámbar pendiente** (`pending-amber` de día, `pending-amber-night` de noche): aviso y presupuesto en guardia.
- **Rojo rechazado** (`rejected-red` de día, `rejected-red-night` de noche): gasto que rebasa, error y la confirmación destructiva.

**The One Ink Rule.** Tinta azul, y de noche Señal clara, es el único acento de marca. Marca la acción principal, la pestaña activa y el chip elegido. No pinta fondos de pantalla ni títulos.

**The Statement Status Rule.** Verde confirmado, Ámbar pendiente y Rojo rechazado nombran un estado del dinero. No decoran cabeceras ni espacios vacíos.

## Typography

**Display Font:** Roboto (la cara de sistema en Android; la app no carga una familia de marca)
**Body Font:** Roboto (sans-serif de sistema)
**Label/Mono Font:** la misma Roboto. No hay mono de marca.

**Character:** Cifras pesadas sobre una cara neutra. El saldo se lee primero. Las etiquetas se quedan cortas y en seminegrita, sin una segunda personalidad.

### Hierarchy

- **Display** (800, 34px): la cifra de saldo en el escritorio. En pantallas más justas la misma función baja a 30px o 28px, siempre en peso 800.
- **Headline** (700, 18px): el título de sección al entrar a una pantalla, y el título del diálogo.
- **Title** (700, 16px): el título dentro de una tarjeta o de un bloque de formulario.
- **Body** (400, 14px, line-height 20px): mensajes y notas. La nota secundaria recurrente es 13px con line-height 18px.
- **Label** (600, 12px): la etiqueta sobre un campo, el metadato y el texto de un chip. Un kicker en mayúsculas, cuando aparece, suma un tracking de 0.4.

**The Balance Rule.** El tipo más grande es una cifra de dinero (34, peso 800). El título de sección se queda en 18, peso 700, y no compite con el saldo.

## Layout

Una columna de teléfono, en vertical. El padding de página es 16. Las tarjetas se apilan con 12 de separación. Dentro de la tarjeta el padding es 16. Los chips se separan 8.

La pantalla respeta el inset superior. La barra de pestañas es absoluta, altura 58 más el inset inferior, y el contenido deja un colchón inferior grande (en torno a 170, o el inset más 170) para que la última fila no quede bajo la barra ni bajo el botón de agregar. Ese botón se ancla a la derecha, a 22 del borde, y su base es el inset inferior más 46, con un mínimo de 56.

No hay rejilla de varias columnas ni puntos de quiebre. Las filas de filtros que no caben se desplazan en horizontal.

**The Phone Column Rule.** La pantalla es una columna con padding 16. El contenido deja aire abajo para la barra y el botón de agregar. No se abre un segundo rail en el teléfono.

## Elevation & Depth

El sistema es híbrido. En reposo, la profundidad es un filete de 1 px y, en claro, el lavado de la tarjeta. La sombra es estructural: pertenece a lo que está levantado y puede repetirse en otras superficies elevadas. Hoy solo el botón de agregar la usa. La barra de pestañas va a ras (elevation 0).

El diálogo no proyecta sombra. Se separa con el velo y con su propio filete.

### Shadow Vocabulary

- **Sombra de acción** (`0 4px 10px rgba(0, 0, 0, 0.22)`, elevation 8): el botón de agregar, y cualquier superficie que de verdad esté levantada.

**The Border At Rest Rule.** Una superficie en reposo se separa con una línea de 1 px. El lavado de la tarjeta clara es tono, no elevación.

**The Structural Shadow Rule.** La sombra (desplazamiento 4, radio 10, opacidad 0.22, elevation 8) es estructural y puede repetirse en otras superficies levantadas. No se aplica a una tarjeta en reposo. Hoy la lleva el botón de agregar.

## Shapes

Dos radios hacen el escritorio. El contenedor (tarjeta y diálogo) es amplio, 20. El control (botón, campo, fila seleccionable) es 12. La píldora, radio 999, es el chip y la barra de progreso (8 de alto en el escritorio, 10 en presupuestos y metas). La barra de pestañas redondea solo las esquinas superiores (18). El botón de agregar es un círculo de 62 con un anillo de 4 px del color de la superficie, para recortarse de la barra.

**The Two Radii Rule.** Controles (botón, campo, botón de diálogo) usan radio 12. Contenedores (tarjeta, diálogo) usan radio 20. La píldora (999) es para chips y barras de progreso.

## Components

Los controles se sienten suaves por el radio y por la tarjeta, y secos en todo lo demás: sin rebote, sin degradado en el botón, sin un segundo adorno.

### Buttons

- **Shape:** esquinas de control (12).
- **Primary:** fondo Tinta azul, texto blanco, peso 700, tamaño 15, padding vertical 12. De noche el fondo pasa a Señal clara y el texto sigue blanco. Si la acción está ocupada, la opacidad baja a 0.7.
- **Hover / Focus:** muchos controles anulan el ripple. No hay un color de hover distinto. El foco visible sigue el filete de Tinta azul, el mismo gesto del chip elegido.
- **Outline:** filete de 1 px en Línea de extracto, texto Texto de extracto, el mismo radio y el mismo padding. Es la cancelación del diálogo.
- **Texto:** una acción suelta en peso 700, tamaño 14, sin fondo. El tono de aviso usa Ámbar pendiente.

### Chips

- **Style:** píldora, filete de 1 px, padding 8 por 12, texto en Label (12, peso 600). En reposo el fondo es transparente y el texto es Texto de extracto.
- **State:** elegido, el filete y el texto pasan a Tinta azul (Señal clara de noche) y el fondo es Lavado de tinta.

### Cards / Containers

- **Corner Style:** contenedor (20).
- **Background:** en claro, lavado diagonal de Superficie a Lavado de tarjeta. De noche, Tarjeta de noche plana.
- **Shadow Strategy:** ninguna en reposo. Ver Elevation & Depth.
- **Border:** 1 px, Línea de extracto o Línea de noche.
- **Internal Padding:** 16. Una tarjeta de lista puede ir a ras y dejar el padding en cada fila (16 horizontal, 14 vertical), con un filete entre filas.

### Inputs / Fields

- **Style:** filete de 1 px, sin relleno propio, radio de control, padding 10 por 12. La etiqueta va arriba, en Label, color Texto secundario, a 6 del campo.
- **Focus:** el filete pasa a Tinta azul. El placeholder es Texto secundario.
- **Error / Disabled:** el error es un texto de 12, peso 600, en Rojo rechazado, bajo el campo. No hay un estilo de campo deshabilitado distinto del ocupado (opacidad 0.7).

### Navigation

Cinco destinos en la barra inferior: Inicio, Movs, Gráficos, Inbox, Más. Superficie blanca, filete superior en Línea de extracto, esquinas superiores a 18, elevation 0. El icono activo se sienta en una cápsula de 56 por 32, radio 16, fondo Línea de extracto, y el icono en Tinta azul. El resto va en Texto secundario. La cápsula y el icono cambian con Señal clara y Línea de noche en el esquema oscuro. Encima de la barra, a la derecha, vive el botón de agregar.

### Agregar

El botón de agregar es la única superficie levantada. Círculo de 62, fondo Tinta azul (Señal clara de noche), icono de suma en blanco a 30, anillo de 4 px en el color de la superficie, y la Sombra de acción. Abre el registro rápido. Es la acción primaria de la barra, una sola.

### Dialog

El diálogo de confirmación entra en fade. Velo a pantalla completa, tarjeta de superficie con radio 20, padding 20 y filete de 1 px. El icono va en un pozo de 44, circular, con el acento al 13 % de opacidad. Título en Headline peso 800. Mensaje en Body, color secundario. Dos botones en fila, separados 10: outline para cancelar y lleno para confirmar. El tono destructivo usa Rojo rechazado; el tono de acción usa Tinta azul.

**The Soft Card Rule.** El gesto táctil es la tarjeta: radio 20 y, en claro, el lavado de blanco a #F8FAFC. El botón no lleva ese lavado ni un rebote.

## Do's and Don'ts

### Do:

- **Do** usar Tinta azul solo en la acción principal, la pestaña activa y el chip elegido. De noche, ese oficio es Señal clara.
- **Do** dejar las tarjetas en reposo con radio 20, padding 16 y filete de 1 px. En claro, el lavado va de #FFFFFF a #F8FAFC. De noche, la tarjeta es plana.
- **Do** reservar el tipo de 34 / 800 para una cifra de dinero y el de 18 / 700 para el título de sección.
- **Do** tratar la noche como el mismo escritorio, con Noche de extracto, Tarjeta de noche, Texto de noche y Señal clara.
- **Do** repetir la Sombra de acción solo en una superficie que de verdad esté levantada.

### Don't:

- **Don't** añadir oro, un oscuro de lujo ni adorno «premium».
- **Don't** poner degradado en botones. El lavado pertenece a la tarjeta clara.
- **Don't** sombrear una tarjeta en reposo.
- **Don't** cargar una serifa de marca ni un segundo acento.
- **Don't** usar la píldora en botones o tarjetas.
