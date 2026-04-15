# Cifra — finanzas personales, single-user

## Stack
PHP+MySQL | Bootstrap5 | DataTables | PWA | `php -S localhost:8000`
DB: gastos_personales — config/database.php

## DB
```
conceptos:           tipo(ingreso|gasto), activo, permite_multiples, categoria_id, cuenta_id_default, moneda(ARS|USD)
registros_mensuales: concepto_id, importe, mes, anio, fecha, pagado, fecha_vencimiento, cuenta_id — sin UNIQUE
categorias:          nombre, color(hex), icono(BS), orden, activo
cuentas:             nombre, banco, tipo(cuenta_corriente|caja_ahorro|billetera), color(hex), saldo_actual, fecha_saldo, activo, moneda(ARS|USD)
movimientos_cuenta:  tipo(ingreso|pago_gasto|transferencia|extraccion), cuenta_origen_id, cuenta_destino_id, importe, fecha, descripcion, registro_id?
```

## Cuentas del usuario
1=Entre Ríos (cuenta_corriente, ARS) | 2=Santander (caja_ahorro, USD) | 3=Personal Pay (billetera, ARS) | 4=Efectivo (billetera, ARS, #22c55e)

## Multi-moneda (ARS/USD)
- `conceptos.moneda` y `cuentas.moneda` ENUM('ARS','USD') — cada concepto opera en su moneda
- `formatearMoneda(valor, moneda='ARS')` → `$` o `U$D` según moneda
- API resumen devuelve `resumen.ARS` y `resumen.USD` — acceder siempre como `app.datos.resumen?.ARS || {defaults}`
- Error 422 de saldo muestra el símbolo correcto según `concepto_moneda`
- `crearFilaFormNuevoRegistro(conceptoId, moneda, cuentaDefault)`: selector inline filtra solo cuentas de la misma moneda
- `agregarRegistroMultiple()`: lee `cuenta_id` del selector inline antes de POST

## APIs (api/)
```
gastos_api.php      GET ?mes&anio | POST | PATCH {registro_id, pagado|fecha|fecha_vencimiento|cuenta_id} | DELETE {registro_id}
conceptos_api.php   GET | POST | PUT {cuenta_id_default} | DELETE
categorias_api.php  GET | POST | PUT | DELETE
cuentas_api.php     GET ?mes&anio → cuentas+total_pagado_mes | POST | PUT {id,saldo_actual}
movimientos_api.php GET | POST transferencia | POST extraccion
```

## Circuito saldo (gastos_api.php) — COMPLETO Y VERIFICADO
- POST permite_multiples=1 (pagado=1): INSERT registro + movimiento `pago_gasto` + saldo_actual−importe — en transacción
- POST permite_multiples=0 (nuevo): INSERT con pagado=0, aplica cuenta_id_default — sin movimiento
- PATCH pagado=1: valida saldo 422 → INSERT movimiento + saldo−importe
- PATCH pagado=0: elimina movimiento + saldo+importe
- PATCH cuenta_id (ya pagado): valida saldo nueva cuenta → ajusta ambas cuentas + migra movimiento
- DELETE: busca movimiento por registro_id → restaura saldo + DELETE movimiento + DELETE registro — en transacción
- Gastos sin cuenta_id: no generan movimiento ni tocan saldo
- Ingresos cobrados: tipo `ingreso`, cuenta_destino_id, saldo+importe; al revertir saldo−importe

## Frontend (app.js)
- Estado: `app.{mesActual, anioActual, datos, guardandoCambios, dtGastos, categorias[], cuentas[], categoriasColapsadas(Set), categoriaFiltrada}`
- `categoriaFiltrada`: null = todo visible; catId = solo esa categoría visible (mobile)
- `categoriasColapsadas`: collapse desktop (el CSS solo afecta mobile pero la lógica vive en JS)
- DataTables: ordering:false; drawCallback inyecta `<tr.categoria-header>` + llama `aplicarFiltroCategoria()`
- Input: neutral→rojo→pulso→verde 2s | `guardandoCambios` previene saves concurrentes
- Dark mode: localStorage('cifra-theme') | Fechas: `formatearFechaCorta()` → dd/mm/yy
- Sugerencias: SMVM←dtos.gob.ar | Elena/Spotify←hardcoded | YouTube←USD×dolarapi.com
- `guardarCuentaRegistro()`: tras PATCH actualiza `app.datos` en memoria (evita re-render que revierte selección)

## Layout — pantalla principal
- Filtro mes/año: Bootstrap collapse, default contraído, localStorage('cifra-filtro-abierto')
- Topbar sticky: `#saldoFiltroHeader` = total_cuentas − gastos_pendientes_mes (siempre ≤ total cuentas) | `#totalCuentasTopbar` = suma saldos reales
- Topbar stats mobile: solo "Disponible" visible; botón `#btnStatsMore` (`.topbar-more-btn`) abre dropdown flotante (`position:absolute`) con USD Disp. + Cuentas — NO inline, no corre el layout. Desktop: los 3 siempre visibles. Cierre con clic fuera via `_cerrarStatsExtra()`.
- Card Gastos: header colapsable → muestra Pagados (`#gastosPagadosHeader`) + Por pagar (`#gastosPorPagarHeader`); total en `#totalGastosHeader`
- FAB `.fab` bottom-right z-index:1039 → #modalGastoRapido (permite_multiples=1) — estilos en `<style>` de index.php, NO inline

## Sticky stack mobile (≤991px)
Tres capas apiladas en scroll, calculadas en JS `_setStickyOffsets()` al cargar y en resize:
```
.header          position:sticky; top:0;                      z-index:1040
.cifra-topbar    position:sticky; top:var(--header-height);   z-index:1035
#catNav          position:sticky; top:var(--sticky-nav-top);  z-index:1025
```
- `--header-height` = offsetHeight de `.header`
- `--sticky-nav-top` = offsetHeight de `.header` + `.cifra-topbar`
- `_setStickyOffsets()` registrado en `DOMContentLoaded` y `resize`

## Nav de categorías mobile (#catNav)
- `<div id="catNav" class="cat-nav-wrap d-md-none">` — hermano anterior a la card gastos, dentro de `#contenidoPrincipal`
- Chips horizontales con scroll; **filtro radio**: un chip activo a la vez
- `seleccionarCategoria(catId)`: toggle `app.categoriaFiltrada`; llama `aplicarFiltroCategoria()`
- `aplicarFiltroCategoria()`: muestra solo filas de `data-categoria-id === categoriaFiltrada`; oculta headers de categoría cuando filtro activo (`.cat-fila-oculta`)
- "Sin categoría" siempre al final; `.cat-chip.activa` = chip seleccionado
- Scroll automático al inicio de `#contenidoPrincipal` al activar filtro (con offset sticky)
- En mobile: headers de categoría NO son clickeables (no colapsan); chevron oculto vía CSS
- En desktop: headers siguen siendo clickeables → `toggleCategoria(catId)` (collapse)

## Hamburguesa
Resumen | Cuentas | — | Ingresos | Vencimientos | — | Movimientos | — | Conceptos
Resumen/Cuentas → modales | Vencimientos → modal+badges | Ingresos → modal unificado

## Modales — reglas generales
- Todos: `modal-dialog-scrollable` (header/footer fijos, body scrolleable)
- NO usar border-success/danger/primary en cards ni bg-success/danger en headers
- Fuentes responsivas: `clamp()` en valores monetarios grandes

## Resumen modal
- Ingresos: clicable → collapse `#resumenIngresosDetalle` con items individuales — `renderizarResumenIngresos()`
- Solo muestra: Disponible (ingresos−gastos_pagados) — SIN Pendiente ni Proyección
- Barras por categoría: `renderizarResumenCategorias()` | Lista pendientes: `renderizarResumenPendientes()`
- Tooltips ⓘ en todos los valores numéricos (Bootstrap, trigger hover+focus)
- `saldo_disponible = ingresos − gastos_pagados` | barra progreso 4px (pctPagado)

## Cuentas modal
- `renderizarCuentas()` → #cardCuentas (sin wrapper .card)
- Por cuenta: dot-lg + nombre + tipo | solo saldo real (sin asignado/diferencia)
- `crearSelectorCuenta()` → .cuenta-wrap (fila simple) / .cuenta-wrap-detalle (múltiple)
- Validación saldo HTTP 422 al marcar pagado Y al reasignar cuenta en gasto ya pagado
- Alta: "Nueva cuenta" en footer → form inline `.nueva-cuenta-form`
- Transferencia: #modalTransferencia | Extracción: solo no-billetera
- `total_pagado_mes`: JOIN conceptos filtrando `tipo='gasto'` (si no, suma ingresos — bug histórico)

## Ingresos modal
- Layout dos líneas por ítem:
  - Línea 1 `.ingreso-linea1`: nombre + btn-edit-ingreso + importe (input)
  - Línea 2 `.ingreso-linea2`: select cuenta (flex:1) + input fecha (7.5rem fijo)
- Wrapper `.ingreso-body` (flex-direction:column) al lado de `.btn-pagado`
- `renderizarModalIngresos()` en app.js

## Vencimientos (permite_multiples=0)
- `.vencimiento-wrap` → span dd/mm/yy + input[date] oculto; click → showPicker()
- Mobile: flex-basis:100% en .concepto-nombre → nueva línea

## Detalle múltiple (permite_multiples=1)
- POST siempre pagado=1, sin fecha_vencimiento
- Cols: [pagado+fecha + .cuenta-wrap-detalle | descripción | importe | trash]
- Form: [fecha | descripción | importe | +] | Labels `.form-field-label` (0.58rem uppercase)
- Badge contador `.badge-count` a la izquierda de la flecha
- Selector de cuenta inline en el form: filtra cuentas por moneda del concepto

## Categorías
- Header desktop: chevron (colapsar) + dot + ícono + label + total (color inline)
- Header mobile: sin chevron (no colapsa); solo dot + ícono + label + total
- `.categoria-header-label`: 0.72rem | `.categoria-header-total`: 0.8rem
- Edit: todo en `.cat-nombre-edit` con `d-flex flex-wrap` (nombre+orden+botones), colspan="2" — evita overflow mobile

## Movimientos modal
- Layout flex por fila: fecha(dd/mm/yy)+hora(hh:mm) | tipo+cuenta | descripción+importe
- Sin tabla, diseño responsive puro flex

## Login (login.php)
- Logo Montserrat + barra degradé índigo→verde + card shadow
- Inputs con ícono `position:absolute` (`.login-field` + `.login-field-icon`) — NO usar Bootstrap input-group (causa solapamiento con autofill del browser en mobile)
- Toggle ojo: `.btn-eye` con `position:absolute` right dentro de `.login-field-pass` — NO en input-group
- Foco inputs en índigo | btn-ingresar con gradiente + microanimación hover
- Auth: siempre setea remember cookie al login (single-user, sin checkbox) — `cifra_set_remember_cookie()` incondicionalmente
- Al entrar a login.php ya autenticado (sesión o cookie válida) → redirect inmediato a index.php

## PWA / Deploy
- SW: HTML network-first, assets cache-first | CACHE_NAME formato: `cifra-YYYYMMDD-N`
- **Bump CACHE_NAME en sw.js cada vez que cambie CSS o JS** — fuerza re-descarga en todos los dispositivos
- **Bump APP_VERSION en index.php en cada deploy** (cada vez que se suben archivos al FTP) — se muestra en el menú como `v...`
- Si hay varios bumps en el mismo día, incrementar el sufijo: `-1`, `-2`, etc. (aplica a ambos)
- SW registration: `{ updateViaCache: 'none' }` — el browser siempre busca sw.js fresco ignorando HTTP cache
- Auto-reload: listener `controllerchange` en app.js recarga la página cuando activa un SW nuevo
- `.htaccess`: `Cache-Control: no-cache, no-store` para sw.js — el servidor tampoco lo cachea
- Deploy FTP: index.php siempre | app.js si JS cambió | styles.css si CSS cambió | sw.js si hay bump | .htaccess si es la primera vez
- Play Store: TWA via PWABuilder (USD 25, HTTPS) | App Store: Capacitor.js (USD 99/año)
- Monetización: multi-tenant + suscripciones | IA descartada (privacidad)
- Android: para limpiar caché de SW → Chrome → ⋮ → Configuración del sitio → Almacenamiento → Borrar
