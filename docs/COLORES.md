# Paleta de Colores - Sistema de Gastos Personales

## Colores Principales

Esta aplicación utiliza una paleta de colores personalizada aplicada sobre Bootstrap 5.

### Azules (Primary)
- **#5F90A7** - Azul Claro / Light Blue
  - Uso: Success, iconos de ingresos, bordes de cards de ingresos
  - Variable CSS: `--color-primary-light`, `--color-success`

- **#196292** - Azul Principal / Main Blue
  - Uso: Botones primarios, header, elementos principales
  - Variable CSS: `--color-primary`

- **#35587F** - Azul Oscuro / Dark Blue
  - Uso: Hover de botones, degradados
  - Variable CSS: `--color-primary-dark`

### Rojos (Danger/Warning)
- **#D22A4C** - Rojo Principal / Main Red
  - Uso: Gastos, alertas de error, bordes de cards de gastos
  - Variable CSS: `--color-danger`, `--color-warning`

- **#B30029** - Rojo Oscuro / Dark Red
  - Uso: Saldo negativo, alertas importantes
  - Variable CSS: `--color-danger-dark`

### Grises (Neutral)
- **#919191** - Gris Claro / Light Gray
  - Uso: Bordes de inputs, elementos deshabilitados
  - Variable CSS: `--color-gray-light`

- **#606060** - Gris Medio / Medium Gray
  - Uso: Textos secundarios, iconos secundarios
  - Variable CSS: `--color-gray`

- **#3F3F3F** - Gris Oscuro / Dark Gray
  - Uso: Textos principales, nombres de conceptos
  - Variable CSS: `--color-gray-dark`

### Otros
- **#1B32E53** - Color Secundario (no utilizado actualmente)
  - Variable CSS: `--color-secondary`

## Mapeo con Bootstrap

Los colores de Bootstrap se sobrescriben con nuestra paleta:

| Bootstrap Class | Color Aplicado | Hex |
|----------------|----------------|-----|
| `.text-primary` | Azul Principal | #196292 |
| `.text-success` | Azul Claro | #5F90A7 |
| `.text-danger` | Rojo Principal | #D22A4C |
| `.text-warning` | Rojo Oscuro | #B30029 |
| `.text-info` | Azul Claro | #5F90A7 |
| `.text-secondary` | Gris Medio | #606060 |
| `.bg-primary` | Azul Principal | #196292 |
| `.bg-success` | Azul Claro | #5F90A7 |
| `.bg-danger` | Rojo Principal | #D22A4C |
| `.btn-primary` | Azul Principal | #196292 |

## Uso en el Sistema

### Header
- Background: Gradiente de `#196292` a `#35587F`
- Texto: Blanco

### Cards de Resumen
- **Ingresos**:
  - Borde: `#5F90A7` (Azul Claro)
  - Icono y texto: `#5F90A7`

- **Gastos**:
  - Borde: `#D22A4C` (Rojo Principal)
  - Icono y texto: `#D22A4C`

- **Saldo Positivo**:
  - Borde: `#196292` (Azul Principal)
  - Icono y texto: `#196292`

- **Saldo Negativo**:
  - Borde: `#B30029` (Rojo Oscuro)
  - Icono y texto: `#B30029`

### Inputs
- Borde normal: `#919191` (Gris Claro)
- Borde en foco: `#196292` (Azul Principal)
- Cambios sin guardar: `#D22A4C` con fondo rgba(210, 42, 76, 0.1)
- Guardado exitoso: `#5F90A7` (Azul Claro)

### Iconos de Conceptos
Los iconos usan las clases de Bootstrap que se mapean a nuestra paleta:

- **Ingresos**: `text-success` → #5F90A7
- **Alquiler**: `text-primary` → #196292
- **Supermercado**: `text-info` → #5F90A7
- **Nafta/Autos**: `text-warning` → #B30029
- **Gimnasio**: `text-danger` → #D22A4C
- **Seguros**: `text-info` → #5F90A7
- **Otros**: `text-secondary` → #606060

## Ejemplos de Código

### CSS Variables
```css
:root {
    --color-primary: #196292;
    --color-primary-light: #5F90A7;
    --color-primary-dark: #35587F;
    --color-danger: #D22A4C;
    --color-danger-dark: #B30029;
    --color-success: #5F90A7;
    --color-gray-light: #919191;
    --color-gray: #606060;
    --color-gray-dark: #3F3F3F;
}
```

### Uso en HTML
```html
<!-- Usa las clases estándar de Bootstrap -->
<div class="text-primary">Texto azul principal</div>
<div class="text-success">Texto azul claro (ingresos)</div>
<div class="text-danger">Texto rojo (gastos)</div>
<button class="btn btn-primary">Botón azul</button>
```

### Uso en JavaScript
```javascript
// Los colores se aplican automáticamente con las clases de Bootstrap
icon.className = 'bi bi-cash-coin text-success'; // Azul claro
icon.className = 'bi bi-cart-fill text-danger';   // Rojo
```

## Accesibilidad

Todos los colores cumplen con los estándares de contraste WCAG 2.1:

- Texto oscuro (#3F3F3F) sobre fondo claro: ✅ AA
- Texto blanco sobre azul principal (#196292): ✅ AA
- Texto blanco sobre rojo (#D22A4C): ✅ AA
- Iconos con opacidad 0.8 para mejor legibilidad

## Modificación de Colores

Para cambiar los colores del sistema, editar el archivo `assets/css/styles.css` en la sección `:root`:

1. Modificar las variables CSS en la sección `:root`
2. Los cambios se aplicarán automáticamente en toda la aplicación
3. No es necesario modificar HTML ni JavaScript
